













'use client'

import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import styles from './BrandLogin.module.css'
import Footer from '@/components/Footer'
import { saveAuthSession } from '../../../lib/authStorage'

type LoginForm = {
  email: string
  password: string
}

type LoginResponse = {
  token?: string
  user?: { role?: string }
  requiresEmailVerification?: boolean
  message?: string
}

export default function Page() {
  const router = useRouter()
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || `http://${host}:5000`
  const [otp, setOtp] = useState('')
  const [otpRequested, setOtpRequested] = useState(false)
  const [loading, setLoading] = useState(false)
  const [infoMessage, setInfoMessage] = useState('')
  const [resetMode, setResetMode] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetOtp, setResetOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetMessage, setResetMessage] = useState('')
  const [cooldownSeconds, setCooldownSeconds] = useState(0)

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginForm>()

  useEffect(() => {
    if (cooldownSeconds <= 0) return

    const timer = window.setInterval(() => {
      setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [cooldownSeconds])

  const onSubmit = async (data: LoginForm) => {
    try {
      setLoading(true)
      setInfoMessage('')
      const res = await fetch(`${apiBaseUrl}/api/brand/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, otp: otpRequested ? otp : undefined }),
      })

      const json = (await res.json()) as LoginResponse

      if (json.requiresEmailVerification) {
        setOtpRequested(true)
        setInfoMessage(json.message || 'Enter the OTP sent to your email.')
        return
      }

      if (!res.ok) {
        throw new Error(json.message || 'Login failed')
      }

      const { token, user } = json

      // 🔐 Brand role check
      if (!user || user.role !== 'brand') {
        alert('Only brand accounts can login here.')
        return
      }

      if (!token) {
        alert('Login failed: No token received')
        return
      }

      if (typeof window !== 'undefined') {
        saveAuthSession('brand', token, user)
      }

      router.push('/brand/dashboard')
      router.refresh()

    } catch (err: any) {
      alert(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const sendResetOtp = async () => {
    try {
      if (!resetEmail) {
        alert('Please enter your email first')
        return
      }

      setResetLoading(true)
      const res = await fetch(`${apiBaseUrl}/api/brand/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail }),
      })

      const json = await res.json()
      if (!res.ok) {
        if (res.status === 429 && typeof json.retryAfterSeconds === 'number') {
          setCooldownSeconds(json.retryAfterSeconds)
          setResetMessage(`Resend available in ${json.retryAfterSeconds}s.`)
        }
        throw new Error(json.message || 'Unable to send OTP')
      }

      setCooldownSeconds(180)
      setResetMessage('OTP sent to your email. Enter OTP and new password below.')
    } catch (err: any) {
      alert(err.message || 'Unable to send OTP')
    } finally {
      setResetLoading(false)
    }
  }

  const resetPassword = async () => {
    try {
      if (!resetEmail || !resetOtp || !newPassword) {
        alert('Email, OTP and new password are required')
        return
      }

      setResetLoading(true)
      const res = await fetch(`${apiBaseUrl}/api/brand/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail, otp: resetOtp, newPassword }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Password reset failed')

      alert('Password reset successful. Please sign in with your new password.')
      setResetMode(false)
      setResetOtp('')
      setNewPassword('')
      setResetMessage('')
    } catch (err: any) {
      alert(err.message || 'Password reset failed')
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.glowOne} />
      <div className={styles.glowTwo} />

      <div className={styles.shell}>
        <div className={styles.panel}>
          <div>
            <p className={styles.panelBadge}>
              BRAND ACCESS
            </p>
            <h2 className={styles.panelTitle}>
              Run smarter campaigns with creators.
            </h2>
            <p className={styles.panelText}>
              Track applications, review profiles, and launch collaborations from one dashboard.
            </p>
          </div>
          <div className={styles.featureGrid}>
            <div className={styles.featureCard}>Fast campaign setup</div>
            <div className={styles.featureCard}>Verified creators</div>
            <div className={styles.featureCard}>Live analytics</div>
            <div className={styles.featureCard}>Secure payments</div>
          </div>
        </div>

        <div className={styles.card}>
          <p className={styles.badge}>
            BRAND PORTAL
          </p>
          <h1 className={styles.title}>Welcome back</h1>
          <p className={styles.subtitle}>
            Sign in to manage campaigns and track influencer performance.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>Email</label>
              <input
                type="email"
                placeholder="you@brand.com"
                {...register('email', { required: 'Email required' })}
                className={styles.input}
              />
              {errors.email && (
                <p className={styles.error}>{errors.email.message}</p>
              )}
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Password</label>
              <input
                type="password"
                placeholder="Enter password"
                {...register('password', { required: 'Password required' })}
                className={styles.input}
              />
              {errors.password && (
                <p className={styles.error}>{errors.password.message}</p>
              )}
            </div>

            {otpRequested && (
              <div className={styles.field}>
                <label className={styles.label}>Email OTP</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="Enter the 6-digit code"
                  className={styles.input}
                />
              </div>
            )}

            {infoMessage && <p className={styles.subtitle}>{infoMessage}</p>}

            <button
              type="submit"
              className={styles.primaryButton}
              disabled={loading || (otpRequested && otp.length < 6)}
            >
              {loading ? 'Working...' : 'Sign in'}
            </button>

            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => {
                setResetMode((prev) => !prev)
                setResetMessage('')
              }}
              disabled={loading || resetLoading}
            >
              {resetMode ? 'Back to Login' : 'Forgot Password?'}
            </button>
          </form>

          {resetMode && (
            <div className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label}>Reset Email</label>
                <input
                  type="email"
                  placeholder="you@brand.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className={styles.input}
                />
              </div>

              <button
                type="button"
                className={styles.secondaryButton}
                onClick={sendResetOtp}
                disabled={resetLoading || !resetEmail || cooldownSeconds > 0}
              >
                {resetLoading
                  ? 'Sending OTP...'
                  : cooldownSeconds > 0
                    ? `Resend OTP in ${cooldownSeconds}s`
                    : 'Send Reset OTP'}
              </button>

              <div className={styles.field}>
                <label className={styles.label}>OTP</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={resetOtp}
                  onChange={(e) => setResetOtp(e.target.value)}
                  placeholder="Enter OTP"
                  className={styles.input}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>New Password</label>
                <input
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={styles.input}
                />
              </div>

              <button
                type="button"
                className={styles.primaryButton}
                onClick={resetPassword}
                disabled={resetLoading || resetOtp.length < 6 || newPassword.length < 6}
              >
                {resetLoading ? 'Resetting...' : 'Reset Password'}
              </button>

              {resetMessage && <p className={styles.subtitle}>{resetMessage}</p>}
            </div>
          )}

          <p className={styles.footerText}>
            Don't have an account?{' '}
            <Link
              href="/brand/register"
              className={styles.footerLink}
            >
              Register
            </Link>
          </p>
        </div>
      </div>
      <Footer />
    </div>
  )
}