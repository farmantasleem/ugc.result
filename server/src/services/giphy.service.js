import { env } from '../config/env.js'
import { badRequest, badGateway } from '../lib/httpError.js'

const SEARCH_URL = 'https://api.giphy.com/v1/gifs/search'
const TOP_POOL = 25 // pick randomly from the top N (relevant) results
const LIMIT = 50

/**
 * Remembers recently returned GIF ids so the same one doesn't repeat across
 * calls within a run. Bounded so it can't grow forever. Swap for Redis later.
 */
const recent = new Set()
const REMEMBER = 60
function remember(id) {
  recent.add(id)
  if (recent.size > REMEMBER) recent.delete(recent.values().next().value)
}

// Broad reaction terms to fall back on when the specific ones return nothing.
const FALLBACK_TERMS = ['excited person', 'happy reaction', 'funny reaction', 'reaction']

/**
 * Finds a fitting, varied GIF for a set of candidate search terms. Tries the
 * terms (shuffled) and then broad fallbacks, stopping at the first that returns
 * results, then picks randomly from the top (skipping recently used)  relevant
 * but not repetitive, and resilient to over-specific phrases that match nothing.
 *
 * @param {string[]} terms  reaction phrases (e.g. ["mind blown", "tired person"])
 * @returns {Promise<{ id, gifUrl, title, query }>}
 */
export async function findGif(terms) {
  const provided = terms?.filter(Boolean) ?? []
  // Specific terms first (shuffled for variety), then broad fallbacks.
  const queue = [...shuffle(provided), ...FALLBACK_TERMS]

  for (const query of queue) {
    const results = await searchGiphy(query)
    if (results.length === 0) continue

    const pick = chooseFresh(results.slice(0, TOP_POOL)) ?? results[0]
    remember(pick.id)
    return {
      id: pick.id,
      // Smaller rendition keeps frame extraction fast; ~200px is plenty for vision.
      gifUrl: pick.images?.downsized?.url ?? pick.images?.original?.url,
      title: pick.title ?? '',
      query,
    }
  }

  throw badRequest(`No GIFs found for any of: ${queue.join(', ')}`)
}

/** One Giphy search. Returns the results array (possibly empty). */
async function searchGiphy(query) {
  const params = new URLSearchParams({
    api_key: env.giphy.apiKey,
    q: query,
    limit: String(LIMIT),
    rating: env.giphy.rating,
    bundle: 'messaging_non_clips', // self-contained GIFs, no clipped video
    lang: 'en',
  })
  try {
    const res = await fetch(`${SEARCH_URL}?${params}`)
    if (!res.ok) throw new Error(`Giphy returned ${res.status}`)
    const payload = await res.json()
    return payload?.data ?? []
  } catch (err) {
    throw badGateway(`Giphy search failed: ${err.message}`)
  }
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

/**
 * Pick from a pool, skipping recently used and biasing toward the TOP of the
 * list. Giphy ranks by popularity, so the front is where the recognizable "top"
 * memes are  we want those, while keeping some variety.
 */
function chooseFresh(pool) {
  const fresh = pool.filter((g) => !recent.has(g.id))
  const from = fresh.length ? fresh : pool
  // min of two randoms skews toward 0 → favors the more popular front results.
  const index = Math.floor(Math.min(Math.random(), Math.random()) * from.length)
  return from[index]
}
