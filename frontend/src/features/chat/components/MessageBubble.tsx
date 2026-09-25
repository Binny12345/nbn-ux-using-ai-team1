import type { ChatMessage } from '../types'

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.sender === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
          isUser
            ? 'bg-zinc-900 text-white rounded-br-sm'
            : 'bg-zinc-100 text-zinc-900 rounded-bl-sm'
        }`}
      >
        <p>{message.content}</p>
        <p className={`mt-1 text-[10px] ${isUser ? 'text-zinc-300' : 'text-zinc-400'}`}>
          {message.failed
            ? 'Not sent'
            : message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}