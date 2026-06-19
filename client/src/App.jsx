import { useState } from 'react'
import { Header } from './components/Header.jsx'
import { MessageList } from './components/MessageList.jsx'
import { ChatInput } from './components/ChatInput.jsx'
import { useChat } from './hooks/useChat.js'

export default function App() {
  const { messages, isBusy, sendMessage, reset } = useChat()
  const [draft, setDraft] = useState('')

  // Clicking an example fills the composer so the user can tweak before sending.
  const pickSuggestion = (text) => setDraft(text)

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col border-x border-border">
      <Header onReset={reset} canReset={messages.length > 0} />

      <main className="flex-1 overflow-y-auto">
        <MessageList messages={messages} onPickSuggestion={pickSuggestion} />
      </main>

      <ChatInput
        onSend={sendMessage}
        disabled={isBusy}
        value={draft}
        onValueChange={setDraft}
      />
    </div>
  )
}
