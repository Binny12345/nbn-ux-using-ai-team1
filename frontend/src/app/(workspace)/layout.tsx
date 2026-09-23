import { redirect } from 'next/navigation'
import { getServerSession } from '@/actions/auth.actions'

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession()
  if (!session) redirect('/auth/signin')

  return <div className="h-screen overflow-hidden bg-zinc-950">{children}</div>
}