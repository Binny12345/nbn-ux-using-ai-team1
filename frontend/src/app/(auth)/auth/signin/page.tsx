'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { loginSchema, type LoginInput } from '@/lib/validations/auth'
import { FullPageSpinner } from '@/components/shared/LoadingSpinner'

export default function SignInPage() {
  const router = useRouter()
  const { user, loading, signInWithEmail, signInWithGoogle } = useAuth()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  useEffect(() => {
    if (!loading && user) {
      router.replace('/projects')
    }
  }, [loading, user, router])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('verification') === 'sent') {
      toast.success('Verification email sent. Verify your email, then sign in.')
    }
  }, [])

  if (loading) return <FullPageSpinner />

  const onSubmit = async (data: LoginInput) => {
    try {
      await signInWithEmail(data.email, data.password)
      toast.success('Signed in successfully')
      router.replace('/projects')
      router.refresh()
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('email-not-verified')) {
        toast.error('Please verify your email before signing in.')
      } else {
        toast.error('Invalid email or password')
      }
    }
  }

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle()
      router.replace('/projects')
    } catch {
      toast.error('Google sign-in failed. Please try again.')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="mb-1">
        <h1 className="mb-1 text-xl font-bold text-marketing-fg">Sign in</h1>
        <p className="text-sm text-marketing-muted-light">Enter your credentials to continue</p>
      </div>

      <button
        type="button"
        onClick={handleGoogleSignIn}
        className="flex w-full items-center justify-center gap-3 rounded-xl border-[1.5px] border-marketing-border bg-marketing-card px-4 py-3 text-sm font-semibold text-marketing-fg transition-colors hover:bg-marketing-bg"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        Continue with Google
      </button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-marketing-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-marketing-card px-2 text-marketing-muted-light">or</span>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-xs font-semibold text-marketing-muted">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'email-error' : undefined}
            className="w-full rounded-xl border-[1.5px] border-marketing-border bg-marketing-field-bg px-4 py-3 text-sm text-marketing-fg outline-none transition-all placeholder:text-marketing-muted-light focus:border-marketing-primary focus:bg-marketing-card focus:shadow-[0_0_0_3px_rgba(26,108,255,0.1)] aria-invalid:border-marketing-error aria-invalid:focus:shadow-[0_0_0_3px_rgba(224,59,59,0.1)]"
            placeholder="you@example.com"
            {...register('email')}
          />
          {errors.email && (
            <p id="email-error" className="text-xs text-marketing-error" role="alert">
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-xs font-semibold text-marketing-muted">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'password-error' : undefined}
            className="w-full rounded-xl border-[1.5px] border-marketing-border bg-marketing-field-bg px-4 py-3 text-sm text-marketing-fg outline-none transition-all placeholder:text-marketing-muted-light focus:border-marketing-primary focus:bg-marketing-card focus:shadow-[0_0_0_3px_rgba(26,108,255,0.1)] aria-invalid:border-marketing-error aria-invalid:focus:shadow-[0_0_0_3px_rgba(224,59,59,0.1)]"
            placeholder="••••••••"
            {...register('password')}
          />
          {errors.password && (
            <p id="password-error" className="text-xs text-marketing-error" role="alert">
              {errors.password.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-1 w-full rounded-xl bg-marketing-primary py-3 text-sm font-semibold text-white shadow-[0_2px_10px_rgba(26,108,255,0.28)] transition-colors hover:bg-marketing-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="text-center text-sm text-marketing-muted-light">
        Don&apos;t have an account?{' '}
        <Link href="/auth/signup" className="font-semibold text-marketing-primary underline hover:text-marketing-primary-dark">
          Create one
        </Link>
      </p>
    </div>
  )
}
