# Firestore Schema

## Overview

All collections use the typed collection pattern — see `frontend/src/lib/firebase/firestore.ts`.
Security rules are in `firebase/firestore.rules`.

When adding a new collection, use the `/firebase-collection` Claude Code skill.

## Schema versioning

Every document in every collection **must** include a `_schemaVersion` field:

```typescript
_schemaVersion: 1  // increment when doing a breaking schema change
```

This enables **lazy migration** — when a document is read, check `_schemaVersion` and migrate on the fly if it's behind current. See the `/evolve-schema` skill for the full migration workflow.

**Rules:**
- `_schemaVersion` is always `1` on creation
- Non-breaking changes (adding optional fields with defaults) keep the same version
- Breaking changes (rename, remove, type change) increment the version and require a migration function
- Never remove `_schemaVersion` from a schema

---

## `users` collection

**Path:** `/users/{userId}`
**Access:** Owner-only (user can read/write their own document; admins can read all)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `uid` | `string` | Yes | Firebase Auth UID (same as document ID) |
| `email` | `string` | Yes | User's email address |
| `displayName` | `string \| null` | Yes | Display name from Auth or profile |
| `photoURL` | `string \| null` | Yes | Profile photo URL |
| `role` | `'user' \| 'admin'` | Yes | User role — immutable by user after creation |
| `createdAt` | `Timestamp` | Yes | When the document was created |
| `updatedAt` | `Timestamp` | Yes | When the document was last updated |
| `_schemaVersion` | `1` | Yes | Schema version for lazy migration |

**Creation:** Auto-created by `AuthProvider` on first sign-in via `syncUserProfile()`.
**Deletion:** Hard-delete is disabled in security rules. Use `deletedAt` field for soft-delete.

---

## `projects` collection

**Path:** `/projects/{projectId}`
**Access:** Server-only. Written and read through the Admin SDK (frontend Server Actions and the backend); client SDK access is denied by the default-deny security rule.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Project name |
| `description` | `string` | Yes | Short project description |
| `createdBy` | `string` | Yes | Firebase Auth UID of the creator (always the PM) |
| `memberIds` | `string[]` | Yes | UIDs of all members. Denormalised copy of the `members` subcollection, used to list a user's projects (`array-contains`) |
| `status` | `string` | Yes | `'active'` |
| `updatedAt` | `Timestamp` | Yes | Last update (server timestamp) |

**Creation:** `createProject` Server Action — also creates the creator's `members` document with role `PM`.
**Note:** `_schemaVersion` is not set on this collection yet.

### `members` subcollection

**Path:** `/projects/{projectId}/members/{uid}` (document ID is the member's UID)
**Access:** Server-only.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `role` | `'BA' \| 'UX' \| 'PM' \| 'Dev'` | Yes | The member's role **in this project** (roles are per project) |
| `joinedAt` | `Timestamp` | Yes | When the member was added |

This subcollection is the source of truth for membership and role. Both the frontend (`getUserRoleForProject`) and the backend (`buildProjectContext`, `persistContext`) check it. Only the PM can add members (`addMember` Server Action).

### `context` subcollection

**Path:** `/projects/{projectId}/context/{entryId}` (auto-generated ID)
**Access:** Server-only. Written by the backend `POST /api/chat`; read by the backend (to build the AI prompt) and by the project page (shared-context banner).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `content` | `string` | Yes | The durable fact, decision or requirement extracted from a chat exchange |
| `type` | `'decision' \| 'requirement' \| 'note'` | Yes | What kind of entry it is |
| `contributedBy` | `string` | Yes | UID of the user whose chat produced it. Set by the server from the verified token — never from the request body |
| `role` | `string` | Yes | The contributor's project role at write time (copied from their `members` document) |
| `sourceChatId` | `string` | Yes | The chat session ID the entry was extracted from |
| `status` | `'Active' \| 'Outdated'` | Yes | Only `Active` entries are used as context; `Outdated` is reserved for superseded entries |
| `createdAt` | `Timestamp` | Yes | Server timestamp |

**Design:** append-only — one document per entry, never merged or overwritten, so concurrent writers cannot clobber each other and every entry keeps a single author (attribution).
**Note:** `_schemaVersion` is not set on this collection yet.

### `artifacts` subcollection

**Path:** `/projects/{projectId}/artifacts/{artifactId}` (auto-generated ID)
**Access:** Written only by the backend (`POST` / `DELETE /api/projects/:projectId/artifacts`) through the Admin SDK. Project members may read these documents with the client SDK; the security rules deny all client writes. The file bytes live in Vercel Blob (private store) — this document holds the metadata.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fileName` | `string` | Yes | Display and download name. Uploads keep the original file name. AI-generated files are named from the document's title (`login-page.md`) and get the `name_(2).md` style when that name is already taken in the project. Uploads are not de-duplicated: they keep the same name and the blob path gets a random suffix instead |
| `contentType` | `string` | Yes | MIME type reported at upload |
| `size` | `number` | Yes | File size in bytes |
| `blobUrl` | `string` | Yes | URL of the private blob. Never returned by the list API; fetching it needs the server's blob token |
| `blobPathname` | `string` | Yes | Blob pathname, `projects/{projectId}/{fileName}-{randomSuffix}` |
| `uploadedBy` | `string` | Yes | UID of the user who created the artifact: the uploader, or the user who ran `/generate` for AI-made files. Set by the server from the verified token — never from the request |
| `role` | `string` | Yes | That user's project role at creation time (copied from their `members` document) |
| `source` | `'upload' \| 'ai'` | Yes | How the artifact was produced: `'upload'` for a user-uploaded file (`POST .../artifacts`), `'ai'` for a Markdown file generated by the `/generate` chat command (`POST .../artifacts/generate`). Documents created before this field existed have no `source`; treat a missing value as `'upload'` |
| `createdAt` | `Timestamp` | Yes | Server timestamp |

**Rules:** members read, no client writes (`firebase/firestore.rules`, helper `isProjectMember`). A member reading a document with the client SDK can see `blobUrl` and `blobPathname`; the blob itself stays private, so the URL alone grants no access.
**Deletion:** the delete route removes both the blob and this document (hard delete), unlike the soft-delete convention elsewhere.
**Note:** `_schemaVersion` is not set on this collection yet.

<!-- Add new collection schemas below using the /firebase-collection skill -->
