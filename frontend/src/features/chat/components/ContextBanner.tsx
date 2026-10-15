'use client'

import type { ContextEntry } from '../types'
import { roleLabel } from '../lib/roleLabels'

export function ContextBanner({ entries }: { entries: ContextEntry[] }) {
  return (
    <div className="border-marketing-border bg-marketing-card text-marketing-fg mx-auto mb-4 w-full max-w-md rounded-2xl border-[1.5px] px-4 py-3 text-sm">
      {entries.length > 0 ? (
        <>
          <p className="text-marketing-fg mb-2 font-semibold">Shared context for this project</p>
          <ul className="context-scroll max-h-48 space-y-3 pr-2">
            {entries.map((entry) => (
              <li key={entry.id}>
                <p className="text-marketing-fg text-xs font-bold">
                  {entry.contributorName ?? 'Teammate'}
                  {entry.role ? ` · ${roleLabel(entry.role)}` : ''} · {entry.type}
                </p>
                <p className="text-marketing-fg mt-0.5">{entry.content}</p>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-marketing-muted">
          No shared context yet. Contributions from you and your teammates will appear here.
        </p>
      )}
    </div>
  )
}