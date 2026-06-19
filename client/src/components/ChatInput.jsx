import { useEffect, useRef, useState } from 'react'
import { SendIcon } from './icons.jsx'

/**
 * Auto-growing message composer. Enter sends, Shift+Enter adds a newline.
 * Controlled internally; lifts the text up via `onSend`.
 */
export function ChatInput({ onSend, disabled, value, onValueChange }) {
  const [internal, setInternal] = useState('')
  const text = value !== undefined ? value : internal
  const setText = onValueChange || setInternal
  const taRef = useRef(null)

  // Grow with content, capped so it never eats the viewport.
  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`
  }, [text])

  const submit = () => {
    if (!text.trim() || disabled) return
    onSend(text)
    setText('')
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="border-t border-border bg-bg px-4 py-3 sm:px-6">
      <div className="mx-auto flex w-full max-w-2xl items-end gap-2">
        <div className="card flex flex-1 items-end px-3 py-2 focus-within:border-accent">
          <textarea
            ref={taRef}
            rows={1}
            value={text}
            disabled={disabled}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Describe your product and paste its URL…"
            className="max-h-40 w-full resize-none bg-transparent text-sm leading-relaxed text-content placeholder:text-muted focus:outline-none disabled:opacity-50"
          />
        </div>
        <button
          onClick={submit}
          disabled={disabled || !text.trim()}
          className="btn-accent h-[42px] w-[42px] !px-0"
          aria-label="Send message"
        >
          <SendIcon />
        </button>
      </div>
  
    </div>
  )
}
