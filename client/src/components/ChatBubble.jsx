import { SparkIcon } from './icons.jsx'

/**
 * Layout wrapper for a single turn: avatar + aligned bubble.
 * Content (text, pipeline status, video card) is passed as children so this
 * stays presentational.
 */
export function ChatBubble({ role, children, padded = true }) {
  const isUser = role === 'user'
  return (
    <div
      className={`flex w-full animate-fade-up gap-3 ${
        isUser ? 'flex-row-reverse' : 'flex-row'
      }`}
    >
      <Avatar isUser={isUser} />
      <div
        className={`max-w-[85%] sm:max-w-[75%] ${
          padded
            ? `rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                isUser
                  ? 'bg-accent text-accent-contrast'
                  : 'card text-content'
              }`
            : ''
        }`}
      >
        {children}
      </div>
    </div>
  )
}

function Avatar({ isUser }) {
  if (isUser) {
    return (
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-surface-raised text-xs font-medium text-muted">
        You
      </span>
    )
  }
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-accent-contrast">
      <SparkIcon className="h-4 w-4" />
    </span>
  )
}
