import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Authentication',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-marketing-bg">
      <header className="flex h-[58px] shrink-0 items-center border-b border-marketing-border bg-marketing-card px-6">
        <Link
          href="/"
          className="mr-auto flex items-center gap-2 text-sm font-medium text-marketing-muted-light transition-colors hover:text-marketing-primary"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5.5 8 10 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </Link>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-marketing-primary to-marketing-primary-dark text-xs font-bold text-white">
            AI
          </div>
          <span className="text-sm font-semibold text-marketing-fg">
            {process.env.NEXT_PUBLIC_APP_NAME ?? 'NBN UX AI'}
          </span>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-[420px] rounded-2xl border-[1.5px] border-marketing-border bg-marketing-card px-8 py-8 shadow-[0_8px_36px_rgba(26,108,255,0.1)]">
          {children}
        </div>
      </div>
    </div>
  )
}