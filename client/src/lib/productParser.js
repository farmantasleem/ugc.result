/**
 * Lightweight, dependency-free extraction of product details from a user's
 * chat message. This is intentionally heuristic  in the full app the backend
 * (and an LLM) would read the URL and return structured data. Keeping the same
 * shape here means the UI won't change when that lands.
 *
 * @typedef {Object} ParsedProduct
 * @property {string|null} name   Best-guess product name
 * @property {string|null} url    First URL found (normalized with protocol)
 * @property {string|null} domain Hostname of the URL, if any
 */

const URL_REGEX = /\b((?:https?:\/\/)?(?:[\w-]+\.)+[a-z]{2,}(?:\/[^\s]*)?)\b/i

/** @returns {ParsedProduct} */
export function parseProduct(message) {
  const url = extractUrl(message)
  return {
    name: extractName(message, url),
    url,
    domain: url ? safeHostname(url) : null,
  }
}

function extractUrl(message) {
  const match = message.match(URL_REGEX)
  if (!match) return null
  const raw = match[1]
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
}

function safeHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

/**
 * Tries, in order: an explicit "building X" / "I'm building X" phrase, then a
 * capitalized word, then the domain's second-level name as a fallback.
 */
function extractName(message, url) {
  const building = message.match(
    /(?:building|launching|making|created?|call(?:ed)?)\s+([A-Z][\w.-]*)/,
  )
  if (building) return building[1]

  const capitalized = message.match(/\b([A-Z][a-zA-Z]{2,})\b/)
  if (capitalized && !/^https?$/i.test(capitalized[1])) return capitalized[1]

  if (url) {
    const host = safeHostname(url)
    if (host) {
      const base = host.split('.')[0]
      return base.charAt(0).toUpperCase() + base.slice(1)
    }
  }
  return null
}
