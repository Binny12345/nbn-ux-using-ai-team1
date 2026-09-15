# 15/09/2026 Results:
## Email/password:
- Sign-up with new email/password: Pass, account created, redirected into app
- New user confirmed in Firebase Console (Authentication > Users): Pass
- Sign out, sign back in with same credentials: Pass
- Sign in with wrong password: Pass, error shown, access blocked
- Sign in with non-existent email: Pass, error shown
## Google sign-in:
- Continue with Google, complete OAuth: Pass, redirected into app
- User confirmed in Firebase Console: Pass
- Sign out, sign back in with Google: Pass
## Session handling:
- Refresh page while signed in: Pass, session persists
- Navigate to /auth/signin while already authenticated: Pass, redirects past login
- Sign out: Pass, redirected to login, protected routes no longer accessible
## Protected route gating:
- Navigate directly to a protected route while signed out: Pass, blocked/redirected
## Issue found (not a functional auth failure, but flagging):
- Console shows a "Missing or insufficient permissions" FirebaseError (Firestore, not Auth). Likely the shared project's Firestore security rules aren't fully configured yet. All visible auth functionality still worked, but this needs checking before building further on top of Firestore.
