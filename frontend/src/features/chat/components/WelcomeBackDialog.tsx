'use client'

interface WelcomeBackDialogProps {
  userName: string
  projectName: string
  lastActivity: Date
  lastTopic: string | null
  onContinue: () => void
  onStartNew: () => void
}

function formatWhen(date: Date) {
  const day = date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
  const time = date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
  return `${day} · ${time}`
}

function snippet(text: string, max = 120) {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max).trimEnd()}…` : clean
}

export function WelcomeBackDialog({
  userName,
  projectName,
  lastActivity,
  lastTopic,
  onContinue,
  onStartNew,
}: WelcomeBackDialogProps) {
  const firstName = userName.split(' ')[0] || userName

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[rgba(10,25,55,0.58)] p-5 backdrop-blur-[7px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
    >
      <div className="bg-marketing-card w-full max-w-lg overflow-hidden rounded-3xl shadow-[0_28px_80px_rgba(5,31,79,0.28)]">
        <div className="px-7 pt-7 pb-5">
          <div className="bg-marketing-primary mb-5 flex size-11 items-center justify-center rounded-xl text-sm font-bold text-white">
            AI
          </div>
          <p className="text-marketing-primary mb-1 text-sm font-semibold">
            Welcome back, {firstName}
          </p>
          <h2 id="welcome-title" className="text-marketing-fg text-2xl font-bold tracking-tight">
            Pick up where you left off
          </h2>
          <p className="text-marketing-muted mt-2 text-sm leading-6">
            Your previous workspace is ready, including the files and conversation context from
            your last visit.
          </p>
          <div className="border-marketing-border bg-marketing-bg mt-5 rounded-2xl border p-4">
            <div className="flex items-center justify-between gap-4">
              <span className="text-marketing-fg truncate text-sm font-semibold">
                {projectName}
              </span>
              <span className="text-marketing-muted-light shrink-0 text-xs">
                {formatWhen(lastActivity)}
              </span>
            </div>
            {lastTopic && (
              <p className="text-marketing-muted mt-2 text-sm leading-5">
                Last discussed: “{snippet(lastTopic)}”
              </p>
            )}
          </div>
        </div>
        <div className="border-marketing-border bg-marketing-bg flex flex-col-reverse gap-2 border-t px-7 py-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onStartNew}
            className="border-marketing-border text-marketing-muted hover:bg-marketing-field-bg bg-marketing-card rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors"
          >
            Start new session
          </button>
          <button
            type="button"
            autoFocus
            onClick={onContinue}
            className="bg-marketing-primary hover:bg-marketing-primary-dark rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors"
          >
            Continue session
          </button>
        </div>
      </div>
    </div>
  )
}