import { initializeApp, getApps, cert, type App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

export { FieldValue }

function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0]!

  const encodedKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64
  if (!encodedKey) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY_BASE64 is not set')
  }

  return initializeApp({
    credential: cert(JSON.parse(Buffer.from(encodedKey, 'base64').toString('utf8'))),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  })
}

export const adminApp = getAdminApp()
export const adminAuth = getAuth(adminApp)
export const adminDb = getFirestore(adminApp)
