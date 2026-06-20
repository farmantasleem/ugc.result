/**
 * Thin client for the UGC backend. Set VITE_API_URL to point at the server;
 * defaults to the local Fastify dev port.
 */
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

/**
 * Sends the chat query to the backend, which learns the product, picks a meme
 * GIF + background, renders the UGC video, and returns its (ImageKit) URL.
 *
 * @param {string} query
 * @returns {Promise<object>} the render payload (product, gif, line, video, ...)
 */
export async function renderUgcVideo(query) {
  return postJson('/internal/ugc/render', { query })
}

/**
 * Runs one conversational turn. The backend chats until it decides the user
 * wants a video, then returns `action: 'render'` with the product URL.
 *
 * @param {Array<{ role: 'user' | 'assistant', content: string }>} messages
 * @returns {Promise<{ reply: string, action: 'chat' | 'render', productUrl: string | null }>}
 */
export async function chatTurn(messages) {
  return postJson('/internal/ugc/chat', { messages })
}

async function postJson(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const errBody = await res.json()
      if (errBody?.error) message = errBody.error
    } catch {
      /* non-JSON error body  keep the status message */
    }
    throw new Error(message)
  }
  return res.json()
}
