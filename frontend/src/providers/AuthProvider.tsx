'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { getClientAuth, getClientDb } from '@/lib/firebase/client'
import {
  signInWithEmail as fbSignInWithEmail,
  signUpWithEmail as fbSignUpWithEmail,
  signInWithGoogle as fbSignInWithGoogle,
  signOut as fbSignOut,
  getIdToken,
} from '@/lib/firebase/auth'
import type { AuthContextValue } from '@/types/auth'
import type { UserProfile } from '@/types/firestore'

const AuthContext = createContext<AuthContextValue | null>(null)

async function syncUserProfile(user: User): Promise<UserProfile> {
  const profileRef = doc(getClientDb(), 'users', user.uid)
  const snap = await getDoc(profileRef)

  if (!snap.exists()) {
    const newProfile = {
      uid: user.uid,
      email: user.email ?? '',
      displayName: user.displayName,
      photoURL: user.photoURL,
    }
    await setDoc(profileRef, {
      ...newProfile,
      createdAt: serverTimestamp(),
    })
    const createdSnap = await getDoc(profileRef)
    if (!createdSnap.exists()) {
      throw new Error('Failed to create user profile document')
    }
    return createdSnap.data() as UserProfile
  }

  const existing = snap.data() as UserProfile

  if (!existing.displayName && user.displayName) {
    await setDoc(
      profileRef,
      {
        displayName: user.displayName,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    )

    return {
      ...existing,
      displayName: user.displayName,
    }
  }

  return existing
}

async function setSessionCookie(): Promise<void> {
  const token = await getIdToken()
  if (!token) return
  await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })
}

async function clearSessionCookie(): Promise<void> {
  await fetch('/api/auth/session', { method: 'DELETE' })
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getClientAuth(), async (firebaseUser) => {
      if (firebaseUser) {
        // Treat unverified users as unauthenticated so they cannot access
        // protected routes or receive a session cookie before verifying.
        if (!firebaseUser.emailVerified) {
          setUser(null)
          setProfile(null)
          setLoading(false)
          return
        }
        setUser(firebaseUser)
        const userProfile = await syncUserProfile(firebaseUser)
        setProfile(userProfile)
        await setSessionCookie()
      } else {
        setUser(null)
        setProfile(null)
        await clearSessionCookie()
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const signInWithEmail = async (email: string, password: string) => {
    await fbSignInWithEmail(email, password)
    // Ensure server session cookie exists before caller redirects to protected routes.
    await setSessionCookie()
  }

  const signUpWithEmail = async (email: string, password: string, displayName: string) => {
    await fbSignUpWithEmail(email, password, displayName)
  }

  const signInWithGoogle = async () => {
    await fbSignInWithGoogle()
    await setSessionCookie()
  }

  const signOut = async () => {
    // Clear server session cookie first so proxy no longer treats the user as authenticated.
    await clearSessionCookie()
    await fbSignOut()
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }
  return context
}
