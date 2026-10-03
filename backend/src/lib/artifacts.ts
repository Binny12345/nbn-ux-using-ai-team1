import { adminDb } from './firebase'
import { HttpError } from './errors'

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN

export interface ArtifactBrief {
  id: string
  fileName: string
  contentType: string
  uploadedBy: string
  role: string
  source: string
}

// Lightweight metadata only — no blob fetch. Used on every chat turn so the
// AI always knows what files exist, without the cost of fetching content.
export async function listProjectArtifacts(projectId: string): Promise<ArtifactBrief[]> {
  const snap = await adminDb
    .collection('projects')
    .doc(projectId)
    .collection('artifacts')
    .orderBy('createdAt', 'desc')
    .get()

  return snap.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      fileName: data.fileName as string,
      contentType: data.contentType as string,
      uploadedBy: data.uploadedBy as string,
      role: data.role as string,
      source: (data.source as string) ?? 'upload',
    }
  })
}

// Fetches and decodes a single markdown artifact's text content, by filename,
// within a project. Used only when a /file(name) reference appears in a chat
// message — not run on every turn.
export async function fetchArtifactContentByName(
  projectId: string,
  fileName: string
): Promise<string | null> {
  if (!BLOB_TOKEN) throw HttpError.internal('BLOB_READ_WRITE_TOKEN is not set')

  const snap = await adminDb
    .collection('projects')
    .doc(projectId)
    .collection('artifacts')
    .where('fileName', '==', fileName)
    .limit(1)
    .get()

  if (snap.empty) return null

  const data = snap.docs[0]!.data()

  // Only markdown content can be meaningfully injected as text right now.
  // Other file types are listed by name but not read.
  if (data.contentType !== 'text/markdown') return null

  const blobRes = await fetch(data.blobUrl, {
    headers: { Authorization: `Bearer ${BLOB_TOKEN}` },
  })
  if (!blobRes.ok) return null

  return await blobRes.text()
}

// Parses /file(name) references out of a user message. Supports multiple
// references in one message. Returns the distinct filenames requested.
export function extractFileReferences(message: string): string[] {
  const pattern = /\/file\(([^)]+)\)/g
  const names = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = pattern.exec(message)) !== null) {
    const name = match[1]?.trim()
    if (name) names.add(name)
  }
  return [...names]
}