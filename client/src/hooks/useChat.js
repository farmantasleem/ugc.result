import { useCallback, useRef, useState } from 'react'
import { PIPELINE_STAGES } from '../data/mockPipeline.js'
import { renderUgcVideo } from '../lib/api.js'

/**
 * Owns the chat transcript and drives the backend video pipeline.
 *
 * Message shape:
 *   { id, role: 'user' | 'assistant', kind: 'text' | 'pipeline' | 'video', ... }
 *
 * Flow: post the query, walk the pipeline stages for feedback while the request
 * is in flight (holding on the last stage), then drop in the final video  or an
 * error bubble if the render fails.
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

  const sendMessage = useCallback(
    async (text) => {
      const trimmed = text.trim()
      if (!trimmed || isBusy) return

      setIsBusy(true)

      const userMsg = { id: nextId(), role: 'user', kind: 'text', text: trimmed }
      const pipelineId = nextId()
      const pipelineMsg = {
        id: pipelineId,
        role: 'assistant',
        kind: 'pipeline',
        stages: PIPELINE_STAGES,
        activeStage: 0,
        done: false,
      }
      setMessages((prev) => [...prev, userMsg, pipelineMsg])

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
        const data = await renderUgcVideo(trimmed)
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
      } finally {
        setIsBusy(false)
      }
    },
    [isBusy, updateMessage],
  )

  const reset = useCallback(() => {
    clearTimers()
    setMessages([])
    setIsBusy(false)
  }, [])

  return { messages, isBusy, sendMessage, reset }
}
