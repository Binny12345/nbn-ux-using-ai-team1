'use client'

interface ContextBannerProps {
  contextSummary: string | null
}

export function ContextBanner({ contextSummary }: { contextSummary: string | null }) {
  return (
    <div className="mx-auto mb-4 max-w-md rounded-md border border-zinc-800 bg-white px-4 py-3 text-sm text-zinc-600">
      {contextSummary ? (
        <>
          <p className="mb-1 font-medium text-zinc-700">Shared context for this project</p>
          <p>{contextSummary}</p>
        </>
      ) : (
        <p>No shared context yet. Contributions from you and your teammates will appear here.</p>
      )}
    </div>
  )
}