import OpenAI from 'openai'
import { env } from '../config/env.js'
import { badGateway } from '../lib/httpError.js'

const client = new OpenAI({ apiKey: env.openai.apiKey })

const MAX_WORDS = 15

/**
 * The overlay-text prompt. Edit `buildPrompt` freely  it's the creative knob.
 * Dynamic vars: product name/website/description + the GIF's description, so the
 * joke is tied to whatever meme we picked.
 */
function buildPrompt({ name, website, description, gifDescription }) {
  return `You write the text overlay caption for a short UGC-style promo video 
the kind of relatable, first-person caption people put over a reaction GIF on
TikTok/Reels.

The video shows this GIF of a person reacting: "${gifDescription}"
The product being promoted:
- Name: ${name}
- Website: ${website}
- What it does: ${description}

Write ONE caption in that casual, self-deprecating, relatable voice. Style it
like these examples (note the lowercase, "me when..." / "when you're..." /
"pov:" framing, and how the product drops in casually):
- "when you're just eatin chill but ${website} casually drops your macros"
- "me acting like i know my calories so i just ${website} and let it handle it"
- "me when i'm still logging meals manually instead of using ${website}"

Rules:
- Hard limit: ${MAX_WORDS} words or fewer.
- Casual lowercase, like a real person typed it. No hashtags, no emojis, no quotes.
- First person / relatable framing ("me when", "when you're", "pov:", "nobody:").
- The joke should fit the GIF's reaction, and ${name} (or ${website}) is the
  effortless fix. One line only.
Return only the caption, nothing else.`
}

/**
 * Generates the funny promo overlay line for a product + GIF understanding.
 *
 * @param {{ name: string, website: string, description: string }} product
 * @param {{ description?: string }} understanding  // from the vision service
 * @returns {Promise<string>}
 */
export async function generateOverlayLine(product, understanding) {
  const prompt = buildPrompt({
    name: product.name,
    website: product.website,
    description: product.description,
    gifDescription: understanding?.description ?? 'a funny reaction GIF',
  })

  let completion
  try {
    completion = await client.chat.completions.create({
      model: env.openai.model,
      temperature: 0.9, // we want playful, not safe
      messages: [{ role: 'user', content: prompt }],
    })
  } catch (err) {
    throw badGateway(`OpenAI copy request failed: ${err.message}`)
  }

  const raw = completion.choices[0]?.message?.content ?? ''
  return clamp(raw)
}

/** Strips stray quotes/whitespace and enforces the word cap as a safety net. */
function clamp(text) {
  const line = text.trim().replace(/^["']|["']$/g, '').split('\n')[0].trim()
  const words = line.split(/\s+/)
  return words.length <= MAX_WORDS ? line : words.slice(0, MAX_WORDS).join(' ')
}
