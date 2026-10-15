interface TypingIndicatorProps {
  /** Optional visible text next to the dots, e.g. for long-running /generate requests. */
  label?: string
}

export function TypingIndicator({ label }: TypingIndicatorProps) {
  return (
    <div className="flex gap-3" role="status">
      <div
        aria-hidden="true"
        className="from-marketing-primary to-marketing-primary-dark flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white shadow-[0_2px_8px_rgba(26,108,255,0.3)]"
      >
        AI
      </div>
      <div className="border-marketing-border bg-marketing-card flex items-center gap-1.5 rounded-2xl rounded-bl-[4px] border-[1.5px] px-4 py-3.5">
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            aria-hidden="true"
            className="typing-dot bg-marketing-primary size-2 rounded-full"
            style={{ animationDelay: `${dot * 0.16}s` }}
          />
        ))}
        {label ? (
          <span className="text-marketing-muted-light ml-1.5 text-sm">{label}</span>
        ) : (
          <span className="sr-only">AI is responding</span>
        )}
      </div>
    </div>
  )
}