import OpenAI from 'openai'
import { env } from '../config/env.js'
import { badGateway } from '../lib/httpError.js'

const client = new OpenAI({ apiKey: env.openai.apiKey })

const SYSTEM_PROMPT = `You analyze meme/reaction GIFs for a short-form video editor.
You are given ONE image that is a grid of frames sampled from a single GIF,
read in temporal order: left-to-right, then top-to-bottom. Treat them as one
animation, not separate images.

Return STRICT JSON with this shape:
{
  "description": string,    // one sentence: what happens in the GIF
  "subject": string,        // the main character/object (e.g. "a cat", "Michael Scott")
  "subjectType": string,    // "human" | "animal" | "other"
  "hasText": boolean,       // true if the GIF has baked-in text/captions/subtitles
  "mood": string,           // dominant emotion/vibe (e.g. "excited", "deadpan")
  "tags": string[],         // 3-6 lowercase keywords for matching this to a product
  "isMeme": boolean,        // true if it's a recognizable meme/reaction
  "captionIdeas": string[]  // 1-3 short overlay text ideas this GIF would suit
}
Respond with JSON only, no prose.`

/**
 * Sends the contact sheet to the vision model and parses a structured
 * understanding of the GIF.
 *
 * @param {Buffer} pngBuffer
 * @returns {Promise<object>}
 */
export async function understandSheet(pngBuffer) {
  const dataUrl = `data:image/png;base64,${pngBuffer.toString('base64')}`

  let completion
  try {
    completion = await client.chat.completions.create({
      model: env.openai.model,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze this GIF (grid of sampled frames).' },
            // detail:low keeps token cost minimal  we only need the gist.
            { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } },
          ],
        },
      ],
    })
  } catch (err) {
    throw badGateway(`OpenAI vision request failed: ${err.message}`)
  }

  const raw = completion.choices[0]?.message?.content ?? '{}'
  try {
    return JSON.parse(raw)
  } catch {
    throw badGateway('OpenAI returned non-JSON content')
  }
}
