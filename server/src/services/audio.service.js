import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import OpenAI from 'openai'
import { env } from '../config/env.js'
import { AUDIO_DIR, AUDIO_CATALOG } from '../config/paths.js'

const client = new OpenAI({ apiKey: env.openai.apiKey })

let cachedTracks // catalog is static; read + parse once

/** Loads (and caches) the audio catalog from assets/audio/catalog.json. */
async function loadTracks() {
  if (cachedTracks) return cachedTracks
  const raw = await readFile(AUDIO_CATALOG, 'utf8')
  const parsed = JSON.parse(raw)
  cachedTracks = Array.isArray(parsed.tracks) ? parsed.tracks : []
  return cachedTracks
}

/**
 * Picks the trending-audio track that best fits the video's vibe. Uses the
 * model to match the GIF mood + product against each track's description/mood/
 * tags; falls back to a keyword-overlap heuristic if the model is unavailable.
 *
 * @param {object} args
 * @param {{ name?: string, description?: string, category?: string }} [args.product]
 * @param {{ mood?: string, tags?: string[], description?: string }} [args.understanding]
 * @returns {Promise<{ id: string, title: string, mood: string, file: string, path: string, startSec: number, reason: string } | null>}
 */
export async function pickAudio({ product = {}, understanding = {} } = {}) {
  const tracks = await loadTracks()
  if (tracks.length === 0) return null

  let chosen = await pickWithModel(tracks, { product, understanding }).catch(() => null)
  let reason = chosen?.reason ?? 'model pick'

  if (!chosen?.track) {
    chosen = { track: pickByHeuristic(tracks, understanding) }
    reason = 'heuristic fallback'
  }

  const track = chosen.track
  return {
    id: track.id,
    title: track.title,
    mood: track.mood,
    file: track.file,
    path: join(AUDIO_DIR, track.file),
    startSec: Number.isFinite(track.startSec) ? track.startSec : 0,
    reason,
  }
}

/** Asks the model to choose a track id from the catalog. */
async function pickWithModel(tracks, { product, understanding }) {
  const menu = tracks.map((t) => ({
    id: t.id,
    mood: t.mood,
    energy: t.energy,
    description: t.description,
    tags: t.tags,
    goodFor: t.goodFor,
  }))

  const prompt = `You are the music supervisor for a short, funny UGC promo video.
Pick the ONE audio track whose vibe best matches the video.

The video shows a reaction GIF:
- description: ${understanding.description ?? 'a funny reaction GIF'}
- mood: ${understanding.mood ?? 'unknown'}
- tags: ${(understanding.tags ?? []).join(', ') || 'none'}

Promoting this product:
- name: ${product.name ?? 'unknown'}
- category: ${product.category ?? 'unknown'}
- what it does: ${product.description ?? 'unknown'}

Available tracks:
${JSON.stringify(menu, null, 2)}

Return STRICT JSON: { "id": "<one id from the list>", "reason": "<short why>" }.
Respond with JSON only.`

  const completion = await client.chat.completions.create({
    model: env.openai.model,
    temperature: 0.4,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }],
  })

  const parsed = JSON.parse(completion.choices[0]?.message?.content ?? '{}')
  const track = tracks.find((t) => t.id === parsed.id)
  return track ? { track, reason: parsed.reason } : null
}

/** Keyword-overlap fallback: score each track's mood+tags against the GIF mood+tags. */
function pickByHeuristic(tracks, understanding) {
  const wanted = new Set(
    [understanding.mood, ...(understanding.tags ?? [])]
      .filter(Boolean)
      .map((s) => String(s).toLowerCase()),
  )

  let best = tracks[0]
  let bestScore = -1
  for (const t of tracks) {
    const bag = [t.mood, ...(t.tags ?? [])].map((s) => String(s).toLowerCase())
    const score = bag.reduce((n, term) => n + (wanted.has(term) ? 1 : 0), 0)
    if (score > bestScore) {
      bestScore = score
      best = t
    }
  }
  return best
}
