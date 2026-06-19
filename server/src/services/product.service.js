import OpenAI from 'openai'
import { env } from '../config/env.js'
import { badRequest, badGateway } from '../lib/httpError.js'
import { extractUrl, hostnameOf, fetchPageText } from '../lib/webpage.js'

const client = new OpenAI({ apiKey: env.openai.apiKey })

const SYSTEM_PROMPT = `You research products from their website text.
Given the scraped content of a product's homepage, figure out what the product
is and what it does. Ignore navigation, cookie banners, and boilerplate.

Return STRICT JSON:
{
  "name": string,            // the product/brand name
  "description": string,     // 1-2 sentences: what it does and who it's for
  "category": string,        // short label, e.g. "calorie tracker", "note-taking app"
  "gifSearchTerms": string[] // 3-4 search phrases for well-known MEME REACTION GIFs
                             // of a PERSON (real humans, not animals/cartoons) whose
                             // reaction matches this product's vibe. Use popular,
                             // recognizable meme-reaction language  e.g. "side eye",
                             // "skeptical reaction", "mind blown", "shocked face",
                             // "awkward smile", "disappointed sigh", "shut up and take
                             // my money", "happy dance". The GIF must have NO baked-in
                             // text/captions (we add our own). Avoid "cat", "dog",
                             // "quote", "text". NOT the product name.
  "backgroundSearchTerms": string[] // 3-4 stock-photo scene queries for a vertical
                             // background that fits the product's world (NO people,
                             // NO text). E.g. for a calorie app: "healthy food flatlay",
                             // "fresh vegetables", "gym aesthetic". For a notes app:
                             // "clean desk workspace", "minimal office".
}
Respond with JSON only.`

/**
 * Reads the product URL out of a free-text query, scrapes the page, and asks the
 * model what the product is. Everything else in the query is ignored on purpose.
 *
 * @param {string} query  e.g. "I'm building CalAI, a calorie app. calai.app"
 * @returns {Promise<{ name, website, description, category }>}
 */
export async function understandProduct(query) {
  const url = extractUrl(query)
  if (!url) throw badRequest('No product URL found in the query')

  const pageText = await fetchPageText(url)
  const website = hostnameOf(url) ?? url

  let completion
  try {
    completion = await client.chat.completions.create({
      model: env.openai.model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Website: ${website}\n\n${pageText}` },
      ],
    })
  } catch (err) {
    throw badGateway(`OpenAI product request failed: ${err.message}`)
  }

  let parsed
  try {
    parsed = JSON.parse(completion.choices[0]?.message?.content ?? '{}')
  } catch {
    throw badGateway('OpenAI returned non-JSON content for product')
  }

  return {
    name: parsed.name || website,
    website,
    description: parsed.description || '',
    category: parsed.category || '',
    gifSearchTerms: Array.isArray(parsed.gifSearchTerms)
      ? parsed.gifSearchTerms.filter(Boolean)
      : [],
    backgroundSearchTerms: Array.isArray(parsed.backgroundSearchTerms)
      ? parsed.backgroundSearchTerms.filter(Boolean)
      : [],
  }
}
