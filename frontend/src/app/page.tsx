import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Home',
  description:
    'Shared context for your team’s AI. Decisions, constraints, and requirements live in the project — not trapped in individual chats.',
}

const features = [
  {
    title: 'Project as source of truth',
    body: 'Decisions, constraints, and requirements live in the project — not buried in one person’s chat history.',
  },
  {
    title: 'Every AI session starts informed',
    body: 'When a teammate joins, their AI already knows the background, objectives, and prior decisions. No starting from zero.',
  },
  {
    title: 'Full attribution',
    body: 'Every contribution is traceable — who added what, from which conversation, and when. No guessing where a decision came from.',
  },
]

export default function LandingPage() {
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'App'

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-12 px-6 py-16">
      <div className="max-w-2xl space-y-5 text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          Shared AI context for teams
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          {appName}
        </h1>
        <p className="mx-auto max-w-xl text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
          Normal AI chats trap knowledge inside individual conversations. We turn the
          project into the source of truth so everyone’s AI works from the same background,
          decisions, and constraints, with full traceability.
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <Link
          href="/auth/signin"
          className="inline-flex items-center justify-center rounded-md bg-black px-6 py-2.5 text-sm font-medium text-white shadow transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Sign in
        </Link>
        <Link
          href="/auth/signup"
          className="inline-flex items-center justify-center rounded-md border border-zinc-200 bg-white px-6 py-2.5 text-sm font-medium shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        >
          Create account
        </Link>
      </div>

      <div className="grid max-w-4xl gap-6 sm:grid-cols-3">
        {features.map((f) => (
          <div
            key={f.title}
            className="rounded-lg border border-zinc-200 p-5 text-left dark:border-zinc-800"
          >
            <h2 className="text-sm font-semibold">{f.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {f.body}
            </p>
          </div>
        ))}
      </div>
    </main>
  )
}