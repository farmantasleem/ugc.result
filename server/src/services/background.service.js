import { env } from '../config/env.js'
import { badRequest, badGateway } from '../lib/httpError.js'

const SEARCH_URL = 'https://api.pexels.com/v1/search'
const TOP_POOL = 15 // pick randomly from the top N (relevant) results
const PER_PAGE = 30

// Broad, safe scenes to fall back on when specific terms return nothing.
const FALLBACK_TERMS = ['aesthetic background', 'minimal gradient', 'soft texture']

/**
 * Remembers recently returned photo ids so backgrounds don't repeat across calls
 * within a run. Bounded. Swap for Redis later.
 */
const recent = new Set()
const REMEMBER = 40
function remember(id) {
  recent.add(id)
  if (recent.size > REMEMBER) recent.delete(recent.values().next().value)
}

/**
 * Finds a fitting vertical (9:16) background photo for a set of scene terms.
 * Tries the terms (shuffled) then broad fallbacks, stopping at the first with
 * results, then picks randomly from the top  relevant, varied, and resilient.
 *
 * @param {string[]} terms  scene queries (e.g. ["healthy food flatlay", "gym"])
 * @returns {Promise<{ id, imageUrl, photographer, query }>}
 */
export async function findBackground(terms) {
  const provided = terms?.filter(Boolean) ?? []
  const queue = [...shuffle(provided), ...FALLBACK_TERMS]

  for (const query of queue) {
    const photos = await searchPexels(query)
    if (photos.length === 0) continue

    const pick = chooseFresh(photos.slice(0, TOP_POOL)) ?? photos[0]
    remember(pick.id)
    return {
      id: pick.id,
      // `portrait` is a ready 800x1200 (9:16-ish) crop; `original` is full res.
      imageUrl: pick.src?.portrait ?? pick.src?.large2x ?? pick.src?.original,
      photographer: pick.photographer ?? '',
      query,
    }
  }

  throw badRequest(`No backgrounds found for any of: ${queue.join(', ')}`)
}

/** One Pexels search for vertical photos. Returns the photos array (maybe empty). */
async function searchPexels(query) {
  const params = new URLSearchParams({
    query,
    orientation: 'portrait', // 9:16 UGC
    per_page: String(PER_PAGE),
  })
  try {
    const res = await fetch(`${SEARCH_URL}?${params}`, {
      headers: { Authorization: env.pexels.apiKey },
    })
    if (!res.ok) throw new Error(`Pexels returned ${res.status}`)
    const payload = await res.json()
    return payload?.photos ?? []
  } catch (err) {
    throw badGateway(`Pexels search failed: ${err.message}`)
  }
}

/** Random pick from a pool, preferring one we haven't used recently. */
function chooseFresh(pool) {
  const fresh = pool.filter((p) => !recent.has(p.id))
  const from = fresh.length ? fresh : pool
  return from[Math.floor(Math.random() * from.length)]
}

/** Fisher-Yates shuffle (copy). */
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
