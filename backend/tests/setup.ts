import { vi } from 'vitest'
import type { AuthUser, VerifyToken } from '../src/middleware/auth'

// Prevent Firebase Admin from initializing during unit tests.
// createApp() accepts a mock verifyToken so adminAuth.verifyIdToken is never called,
// but the module is still imported at load time — this stub prevents the SDK from throwing.
vi.mock('../src/lib/firebase', () => ({
  adminApp: {},
  adminAuth: { verifyIdToken: vi.fn() },
  adminDb: { collection: vi.fn(), runTransaction: vi.fn(), batch: vi.fn() },
  FieldValue: { serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP') },
}))

/**
 * Reusable auth mocks for unit tests.
 * Inject via createApp({ verifyToken: mockVerifyToken }).
 *
 * Default behavior: rejects (unauthenticated).
 * Override per-test: vi.mocked(mockVerifyToken).mockResolvedValue(mockUser)
 */
export const mockUser: AuthUser = {
  uid: 'test-uid',
  email: 'test@example.com',
  claims: {},
}

export const mockVerifyToken: VerifyToken = vi
  .fn()
  .mockRejectedValue(new Error('No token configured for this test'))
