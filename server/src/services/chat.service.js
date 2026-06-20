import OpenAI from 'openai'
import { env } from '../config/env.js'
import { badGateway } from '../lib/httpError.js'

const client = new OpenAI({ apiKey: env.openai.apiKey })

/**
 * The conversational front of the app. It chats normally until it understands
 * the user actually wants a UGC video and has shared a product page  at that
 * point the model calls the `create_ugc_video` tool, and that tool call is our
 * signal to fire the (separate, heavy) render pipeline on the client.
 */
const SYSTEM_PROMPT = `You are the friendly assistant for a tool that makes short
UGC-style promo videos for products. Keep replies warm, brief, and casual (a
sentence or two, light emoji is fine).

What you can do: make a fun, relatable UGC promo video for a product from its
website. If asked what you do, say exactly that.

How the conversation should go:
- Greet and chat naturally. Answer questions about what you can do.
- When the user wants a video, ask them for their product page  a website is
  all you need.
- A bare domain like "result.dev", "notion.so", or "calai.app" IS a valid
  product page. Never ask for a "full" or "https://" URL  just use what they
  gave you. Only ask again if they gave you no website at all.
- As soon as the user has named a product website AND wants a video, call the
  create_ugc_video tool with that website. Don't call it just because a link
  appeared in passing  only when they actually want the video made.
- Never claim you've made the video yourself; the tool handles that.`

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'create_ugc_video',
      description:
        'Start creating the UGC promo video. Call this once the user has named ' +
        'a product website AND wants the video made. A bare domain like ' +
        '"result.dev" counts  do not wait for a fuller URL.',
      parameters: {
        type: 'object',
        properties: {
          product_url: {
            type: 'string',
            description:
              'The product website the user gave, exactly as provided ' +
              '(e.g. "result.dev"). A bare domain is fine; no https:// required.',
          },
        },
        required: ['product_url'],
      },
    },
  },
]

/**
 * Runs one conversational turn.
 *
 * @param {Array<{ role: 'user' | 'assistant', content: string }>} history
 * @returns {Promise<{ reply: string, action: 'chat' | 'render', productUrl: string | null }>}
 */
export async function chatTurn(history) {
  let completion
  try {
    completion = await client.chat.completions.create({
      model: env.openai.model,
      temperature: 0.7,
      tools: TOOLS,
      tool_choice: 'auto',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history],
    })
  } catch (err) {
    throw badGateway(`OpenAI chat request failed: ${err.message}`)
  }

  const message = completion.choices[0]?.message
  const toolCall = message?.tool_calls?.find((t) => t.function?.name === 'create_ugc_video')

  if (toolCall) {
    const productUrl = parseProductUrl(toolCall.function.arguments)
    return {
      reply: message.content?.trim() || "On it  building your video now 🎬",
      action: 'render',
      productUrl,
    }
  }

  return {
    reply: message?.content?.trim() || "Hey! 👋 Tell me about your product whenever you're ready.",
    action: 'chat',
    productUrl: null,
  }
}

/** Tool arguments arrive as a JSON string; pull the URL out defensively. */
function parseProductUrl(args) {
  try {
    return JSON.parse(args ?? '{}').product_url ?? null
  } catch {
    return null
  }
}
