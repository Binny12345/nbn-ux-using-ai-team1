import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Home',
  description:
    'Shared context for your team’s AI. Decisions, constraints, and requirements live in the project — not trapped in individual chats.',
}

const features = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="3" y="3" width="16" height="16" rx="3" stroke="var(--marketing-primary)" strokeWidth="1.6" />
        <path d="M7 8h8M7 11h5M7 14h6" stroke="var(--marketing-primary)" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
    title: 'Project as source of truth',
    body: 'Decisions, constraints, and requirements live in the project — not buried in one person’s chat history.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="11" cy="11" r="8" stroke="var(--marketing-primary)" strokeWidth="1.6" />
        <path d="M11 7v4.5l3 1.5" stroke="var(--marketing-primary)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Every AI session starts informed',
    body: 'When a teammate joins, their AI already knows the background, objectives, and prior decisions. No starting from zero.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M4 17l4-4 3 3 7-8" stroke="var(--marketing-primary)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="6" cy="6" r="2.5" stroke="var(--marketing-primary)" strokeWidth="1.4" />
        <circle cx="16" cy="6" r="2.5" stroke="var(--marketing-primary)" strokeWidth="1.4" />
        <path d="M8.5 6h5" stroke="var(--marketing-primary)" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
    title: 'Full attribution',
    body: 'Every contribution is traceable — who added what, from which conversation, and when. No guessing where a decision came from.',
  },
]

export default function LandingPage() {
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'NBN UX AI'

  return (
    <div className="min-h-screen bg-marketing-bg">
      <header className="sticky top-0 z-10 flex h-[58px] items-center border-b border-marketing-border bg-marketing-card px-6">
        <div className="mr-auto flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-marketing-primary to-marketing-primary-dark text-xs font-bold text-white">
            AI
          </div>
          <span className="text-sm font-semibold text-marketing-fg">{appName}</span>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/auth/signin"
            className="rounded-xl border border-marketing-border bg-marketing-card px-4 py-2 text-sm font-semibold text-marketing-primary transition-colors hover:bg-marketing-bg"
          >
            Sign in
          </Link>
          <Link
            href="/auth/signup"
            className="rounded-xl bg-marketing-primary px-4 py-2 text-sm font-semibold text-white shadow-[0_2px_10px_rgba(26,108,255,0.28)] transition-colors hover:bg-marketing-primary-hover hover:shadow-[0_4px_16px_rgba(26,108,255,0.38)]"
          >
            Create account
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 pb-16 pt-20 text-center">
        <h1 className="mb-6 text-[clamp(2rem,5vw,3.25rem)] font-bold leading-tight tracking-[-0.02em] text-marketing-fg">
          {appName}
        </h1>
        <p className="mx-auto mb-12 max-w-[580px] text-[1.0625rem] leading-relaxed text-marketing-muted">
          Normal AI chats trap knowledge inside individual conversations. We turn the project into
          the source of truth so everyone&apos;s AI works from the same background, decisions, and
          constraints, with full traceability.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/auth/signup"
            className="flex items-center gap-2 rounded-xl bg-marketing-primary px-7 py-3 text-sm font-semibold text-white shadow-[0_4px_18px_rgba(26,108,255,0.34)] transition-all hover:-translate-y-px hover:bg-marketing-primary-hover hover:shadow-[0_6px_24px_rgba(26,108,255,0.42)]"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1.5v11M1.5 7h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Create account
          </Link>
          <Link
            href="/auth/signin"
            className="flex items-center gap-2 rounded-xl border-[1.5px] border-marketing-border-hover bg-marketing-card px-7 py-3 text-sm font-semibold text-marketing-primary transition-colors hover:bg-marketing-bg"
          >
            Sign in
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M2.5 6.5h8M7 3l3.5 3.5L7 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </div>

      <div className="mx-auto grid max-w-4xl grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-5 px-6 pb-20">
        {features.map((f) => (
          <div
            key={f.title}
            className="group flex flex-col gap-4 rounded-2xl border-[1.5px] border-marketing-border bg-marketing-card p-6 shadow-[0_1px_6px_rgba(26,108,255,0.05)] transition-all hover:border-marketing-border-hover hover:shadow-[0_8px_28px_rgba(26,108,255,0.13)]"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-marketing-field-bg">
              {f.icon}
            </div>
            <div>
              <h2 className="mb-2 text-sm font-bold leading-snug text-marketing-fg">{f.title}</h2>
              <p className="text-sm leading-relaxed text-marketing-muted">{f.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}