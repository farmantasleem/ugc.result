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
  const res = await fetch(`${API_URL}/internal/ugc/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })

  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (body?.error) message = body.error
    } catch {
      /* non-JSON error body  keep the status message */
    }
    throw new Error(message)
  }
  return res.json()
}
