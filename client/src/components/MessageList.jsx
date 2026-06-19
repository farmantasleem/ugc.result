import { useEffect, useRef } from 'react'
import { ChatBubble } from './ChatBubble.jsx'
import { PipelineStatus } from './PipelineStatus.jsx'
import { VideoCard } from './VideoCard.jsx'
import { EmptyState } from './EmptyState.jsx'

/** Scrollable transcript. Auto-scrolls to the newest message. */
export function MessageList({ messages, onPickSuggestion }) {
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0) {
    return <EmptyState onPickSuggestion={onPickSuggestion} />
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6 sm:px-6">
      {messages.map((msg) => (
        <ChatBubble key={msg.id} role={msg.role}>
          <MessageBody msg={msg} />
        </ChatBubble>
      ))}
      <div ref={endRef} />
    </div>
  )
}

function MessageBody({ msg }) {
  switch (msg.kind) {
    case 'text':
      return <p className="whitespace-pre-wrap break-words">{msg.text}</p>
    case 'pipeline':
      return (
        <PipelineStatus
          stages={msg.stages}
          activeStage={msg.activeStage}
          done={msg.done}
        />
      )
    case 'video':
      return <VideoCard result={msg.result} />
    default:
      return null
  }
}
