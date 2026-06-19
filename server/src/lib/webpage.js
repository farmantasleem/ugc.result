import { badRequest } from './httpError.js'

const URL_REGEX = /\b((?:https?:\/\/)?(?:[\w-]+\.)+[a-z]{2,}(?:\/[^\s]*)?)\b/i

/** Pulls the first URL out of a free-text query and normalizes the protocol. */
export function extractUrl(text) {
  const match = String(text ?? '').match(URL_REGEX)
  if (!match) return null
  const raw = match[1]
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
}

/** Hostname without `www.`, or null if the URL is unparseable. */
export function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

/**
 * Fetches a page and reduces it to plain-ish text the LLM can read: title +
 * meta description up front (they're the densest signal), then visible body
 * text with scripts/styles/markup stripped. Capped so we don't blow tokens.
 */
export async function fetchPageText(url, { maxChars = 6000 } = {}) {
  let res
  try {
    res = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (UGC-Studio bot)' },
    })
  } catch (err) {
    throw badRequest(`Could not fetch product URL: ${err.message}`)
  }
  if (!res.ok) throw badRequest(`Product URL returned ${res.status}`)

  const html = await res.text()
  const title = pick(html, /<title[^>]*>([^<]*)<\/title>/i)
  const metaDesc =
    pick(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ||
    pick(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i)

  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const parts = [
    title && `Title: ${title}`,
    metaDesc && `Meta: ${metaDesc}`,
    body && `Body: ${body}`,
  ].filter(Boolean)

  return parts.join('\n').slice(0, maxChars)
}

function pick(html, regex) {
  const m = html.match(regex)
  return m ? m[1].trim() : ''
}
