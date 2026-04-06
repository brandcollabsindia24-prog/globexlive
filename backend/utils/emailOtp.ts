import crypto from "crypto"
import nodemailer from "nodemailer"

const OTP_EXPIRY_MINUTES = 10
const OTP_RESEND_COOLDOWN_SECONDS = 180

let cachedTransporter: nodemailer.Transporter | null = null

export type OtpAction = "registration" | "login" | "reset"

export function generateEmailOtp() {
  return crypto.randomInt(100000, 1000000).toString()
}

export function hashEmailOtp(otp: string) {
  return crypto.createHash("sha256").update(otp).digest("hex")
}

export function createOtpExpiry() {
  return new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)
}

export function isOtpExpired(expiresAt?: Date | null) {
  return !expiresAt || expiresAt.getTime() < Date.now()
}

export function getOtpRetryAfterSeconds(lastSentAt?: Date | null) {
  if (!lastSentAt) return 0

  const elapsedMs = Date.now() - lastSentAt.getTime()
  const remainingMs = OTP_RESEND_COOLDOWN_SECONDS * 1000 - elapsedMs

  if (remainingMs <= 0) return 0
  return Math.ceil(remainingMs / 1000)
}

function getTransporter() {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    return null
  }

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === "true" || port === 465,
      auth: {
        user,
        pass,
      },
    })
  }

  return cachedTransporter
}

export async function sendOtpEmail(params: {
  email: string
  name?: string
  otp: string
  action: OtpAction
}) {
  const { email, name, otp, action } = params
  const displayName = name?.trim() || "there"
  const subject = action === "registration"
    ? "Verify your email address"
    : action === "login"
      ? "Your login verification code"
      : "Your password reset code"

  const text = action === "registration"
    ? `Hi ${displayName}, your verification code is ${otp}. It expires in 10 minutes.`
    : action === "login"
      ? `Hi ${displayName}, your login verification code is ${otp}. It expires in 10 minutes.`
      : `Hi ${displayName}, your password reset code is ${otp}. It expires in 10 minutes.`

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
      <h2>${subject}</h2>
      <p>Hi ${displayName},</p>
      <p>Your one-time verification code is:</p>
      <div style="font-size: 28px; font-weight: 700; letter-spacing: 6px; padding: 12px 16px; background: #f3f4f6; display: inline-block; border-radius: 12px;">${otp}</div>
      <p>This code expires in 10 minutes.</p>
    </div>
  `

  const transporter = getTransporter()

  if (!transporter) {
    console.log(`[OTP:${action}] ${email} -> ${otp}`)
    return
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER

  await transporter.sendMail({
    from,
    to: email,
    subject,
    text,
    html,
  })
}