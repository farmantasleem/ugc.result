import { useCallback, useRef, useState } from 'react'
import { PIPELINE_STAGES } from '../data/mockPipeline.js'
import { chatTurn, renderUgcVideo } from '../lib/api.js'

/**
 * Owns the chat transcript and drives the backend.
 *
 * Every message goes to the chat brain first. It replies normally until it
 * decides the user actually wants a UGC video (and has shared a product URL),
 * at which point it returns `action: 'render'` and we run the video pipeline:
 * walk the pipeline stages for feedback while the request is in flight, then
 * drop in the final video (or an error bubble if the render fails).
 *
 * Message shape:
 *   { id, role: 'user' | 'assistant', kind: 'text' | 'pipeline' | 'video', ... }
 */
let idCounter = 0
const nextId = () => `m-${Date.now()}-${idCounter++}`

export function useChat() {
  const [messages, setMessages] = useState([])
  const [isBusy, setIsBusy] = useState(false)
  const timers = useRef([])

  const updateMessage = useCallback((id, patch) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  }, [])

  const clearTimers = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  // Runs the heavy video pipeline and appends the result (or an error) bubble.
  const runRenderPipeline = useCallback(
    async (query) => {
      const pipelineId = nextId()
      setMessages((prev) => [
        ...prev,
        {
          id: pipelineId,
          role: 'assistant',
          kind: 'pipeline',
          stages: PIPELINE_STAGES,
          activeStage: 0,
          done: false,
        },
      ])

      // Walk the stages for feedback, but hold on the last one until the
      // response arrives (the real render time is unknown up front).
      let elapsed = 0
      PIPELINE_STAGES.slice(0, -1).forEach((stage, index) => {
        elapsed += stage.ms
        timers.current.push(
          setTimeout(() => updateMessage(pipelineId, { activeStage: index + 1 }), elapsed),
        )
      })

      try {
        const data = await renderUgcVideo(query)
        clearTimers()
        updateMessage(pipelineId, { done: true })
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'assistant',
            kind: 'video',
            result: {
              name: data.product?.name || 'your product',
              domain: data.product?.website || null,
              videoUrl: data.video.url,
              durationSec: data.video.durationSec,
              caption: data.line,
            },
          },
        ])
      } catch (err) {
        clearTimers()
        updateMessage(pipelineId, { done: true })
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'assistant',
            kind: 'text',
            text: `⚠️ Couldn't make the video: ${err.message}`,
          },
        ])
      }
    },
    [updateMessage],
  )

  const sendMessage = useCallback(
    async (text) => {
      const trimmed = text.trim()
      if (!trimmed || isBusy) return

      setIsBusy(true)

      const userMsg = { id: nextId(), role: 'user', kind: 'text', text: trimmed }
      // Show an animated "thinking" bubble immediately, then swap it for the
      // reply once the chat API responds.
      const thinkingId = nextId()
      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: thinkingId, role: 'assistant', kind: 'thinking' },
      ])

      // Hand the model the conversation so far, plus this new turn.
      const history = [...toHistory(messages), { role: 'user', content: trimmed }]

      try {
        const { reply, action, productUrl } = await chatTurn(history)

        if (reply) {
          updateMessage(thinkingId, { kind: 'text', text: reply })
        } else {
          setMessages((prev) => prev.filter((m) => m.id !== thinkingId))
        }

        if (action === 'render' && productUrl) {
          await runRenderPipeline(productUrl)
        }
      } catch (err) {
        updateMessage(thinkingId, {
          kind: 'text',
          text: `⚠️ Something went wrong: ${err.message}`,
        })
      } finally {
        setIsBusy(false)
      }
    },
    [isBusy, messages, runRenderPipeline, updateMessage],
  )

  const reset = useCallback(() => {
    clearTimers()
    setMessages([])
    setIsBusy(false)
  }, [])

  return { messages, isBusy, sendMessage, reset }
}

/**
 * Maps the on-screen transcript into the {role, content} list the chat endpoint
 * expects. Pipeline bubbles are skipped; a rendered video becomes a short note
 * so the model remembers it already made one.
 */
function toHistory(messages) {
  return messages
    .map((m) => {
      if (m.kind === 'text') return { role: m.role, content: m.text }
      if (m.kind === 'video') {
        return { role: 'assistant', content: '(made and shared the UGC video)' }
      }
      return null
    })
    .filter(Boolean)
}
