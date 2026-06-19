import { understandProduct } from '../services/product.service.js'
import { findGif } from '../services/giphy.service.js'
import { findBackground } from '../services/background.service.js'
import { buildContactSheet } from '../services/gifFrames.service.js'
import { understandSheet } from '../services/vision.service.js'
import { generateOverlayLine } from '../services/copy.service.js'
import { pickAudio } from '../services/audio.service.js'
import { assembleVideo } from '../services/assembly.service.js'
import { uploadEnabled, uploadVideo } from '../services/upload.service.js'
import { OUTPUT_DIR, VIDEO_ROUTE_PREFIX } from '../config/paths.js'
import { join } from 'node:path'

const bodySchema = {
  body: {
    type: 'object',
    required: ['query'],
    properties: {
      query: { type: 'string', minLength: 1 }, // product url + free text
      sampleCount: { type: 'integer', minimum: 1, maximum: 9 },
    },
  },
}

/**
 * The UGC pipeline. From a single chat query it learns the product, picks a
 * fitting reaction GIF + background, understands the GIF, and writes a funny
 * overlay line. `/render` additionally assembles the actual MP4.
 *
 * @param {import('fastify').FastifyInstance} app
 */
export default async function ugcRoutes(app) {
  // Picks and understands all the assets (no video render).
  app.post('/internal/ugc/draft', { schema: bodySchema }, async (request) => {
    return publicDraft(await buildDraft(request))
  })

  // Full pipeline: draft + assemble the MP4, returned as a viewable URL.
  app.post('/internal/ugc/render', { schema: bodySchema }, async (request) => {
    const draft = await buildDraft(request)

    const { fileName, durationSec, cutout } = await assembleVideo({
      backgroundUrl: draft.background.url,
      gifUrl: draft.gif.url,
      caption: draft.line,
      outDir: OUTPUT_DIR,
      audioPath: draft.audio?.path,
      audioStartSec: draft.audio?.startSec,
    })

    // Upload to ImageKit if configured; otherwise serve the local copy.
    let videoUrl
    if (uploadEnabled()) {
      videoUrl = await uploadVideo(join(OUTPUT_DIR, fileName), fileName)
    } else {
      videoUrl = `${request.protocol}://${request.host}${VIDEO_ROUTE_PREFIX}${fileName}`
    }

    return { ...publicDraft(draft), video: { url: videoUrl, durationSec, cutout } }
  })
}

/** Drops the server-local audio file path before sending a draft to the client. */
function publicDraft(draft) {
  if (!draft.audio) return draft
  const { path, ...audio } = draft.audio
  return { ...draft, audio }
}

/** Shared asset selection + understanding used by both endpoints. */
async function buildDraft(request) {
  const { query, sampleCount } = request.body

  // 1. Learn the product from its URL (yields GIF + background search terms).
  const product = await understandProduct(query)

  // The background is independent of the GIF, so fetch it in parallel.
  const backgroundPromise = findBackground(product.backgroundSearchTerms)

  // 2-3. Find a GIF and understand it. We want a clean reaction GIF of a person
  // with no baked-in text (we add our own overlay), so re-roll a couple of times
  // if the vision check says otherwise.
  const MAX_ATTEMPTS = 3
  let gif, sheet, understanding
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    gif = await findGif(product.gifSearchTerms)
    sheet = await buildContactSheet(gif.gifUrl, { sampleCount })
    understanding = await understandSheet(sheet.pngBuffer)
    if (isCleanReactionGif(understanding) || attempt === MAX_ATTEMPTS) break
    request.log.info({ gifId: gif.id }, 'gif had text / wrong subject, re-rolling')
  }

  // 4. Write the funny overlay line + pick a mood-matched trending track.
  const line = await generateOverlayLine(product, understanding)
  const audio = await pickAudio({ product, understanding }).catch((err) => {
    request.log.warn({ err }, 'audio pick failed, rendering without music')
    return null
  })
  const background = await backgroundPromise

  return {
    product,
    gif: { id: gif.id, url: gif.gifUrl, title: gif.title, searchedFor: gif.query },
    background: {
      id: background.id,
      url: background.imageUrl,
      photographer: background.photographer,
      searchedFor: background.query,
    },
    understanding,
    line,
    audio,
    frames: { total: sheet.frameCount, sampled: sheet.sampled, grid: sheet.grid },
  }
}

/** We want a real-person reaction GIF with no baked-in text of its own. */
function isCleanReactionGif(u) {
  return !u?.hasText && String(u?.subjectType ?? '').toLowerCase() === 'human'
}
