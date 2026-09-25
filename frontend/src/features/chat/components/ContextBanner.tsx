'use client'

import type { ContextEntry } from '../types'

export function ContextBanner({ entries }: { entries: ContextEntry[] }) {
  return (
    <div className="mx-auto mb-4 max-w-md rounded-md border border-zinc-800 bg-white px-4 py-3 text-sm text-zinc-600">
      {entries.length > 0 ? (
        <>
          <p className="mb-2 font-medium text-zinc-700">Shared context for this project</p>
          <ul className="max-h-48 space-y-2 overflow-y-auto">
            {entries.map((entry) => (
              <li key={entry.id}>
                <p className="text-xs text-zinc-500">
                  {entry.contributorName ?? 'Teammate'}
                  {entry.role ? ` · ${entry.role}` : ''} · {entry.type}
                </p>
                <p>{entry.content}</p>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>No shared context yet. Contributions from you and your teammates will appear here.</p>
      )}
    </div>
  )
}
