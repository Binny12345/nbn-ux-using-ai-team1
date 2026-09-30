import type { ChatMessage } from '../types'

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
}

export function MessageBubble({ message, currentUserName }: { message: ChatMessage; currentUserName: string }) {
  const isUser = message.sender === 'user'

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          isUser
            ? 'bg-marketing-field-bg text-marketing-primary'
            : 'bg-gradient-to-br from-marketing-primary to-marketing-primary-dark text-white shadow-[0_2px_8px_rgba(26,108,255,0.3)]'
        }`}
      >
        {isUser ? initials(currentUserName) : 'AI'}
      </div>
      <div className={`flex max-w-[75%] flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? 'rounded-br-[4px] bg-marketing-primary text-white'
              : 'rounded-bl-[4px] border-[1.5px] border-marketing-border bg-marketing-card text-marketing-fg shadow-[0_1px_6px_rgba(26,108,255,0.06)]'
          }`}
        >
          {message.content}
        </div>
        <span className="text-xs text-marketing-muted-light">
          {message.timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </span>
      </div>
    </div>
  )
}