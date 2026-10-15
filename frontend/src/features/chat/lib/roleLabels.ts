const ROLE_LABELS: Record<string, string> = {
  PM: 'Project Manager',
  BA: 'Business Analyst',
  UX: 'UX Designer',
  DEV: 'Developer',
}

// Full role name for display. Unknown roles (or ones already spelled out) pass through unchanged.
export function roleLabel(role: string): string {
  return ROLE_LABELS[role.trim().toUpperCase()] ?? role
}