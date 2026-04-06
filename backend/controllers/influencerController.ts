import Influencer from "../models/Influencer"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import {
  createOtpExpiry,
  generateEmailOtp,
  getOtpRetryAfterSeconds,
  hashEmailOtp,
  isOtpExpired,
  sendOtpEmail,
} from "../utils/emailOtp"

function sanitizeInfluencer(influencer: any) {
  return {
    id: influencer._id,
    name: influencer.name,
    email: influencer.email,
    role: influencer.role || "influencer",
    emailVerified: Boolean(influencer.emailVerified),
  }
}

export const registerInfluencer = async (req: any, res: any) => {
  try {
    const { name, email, password } = req.body

    const existing = await Influencer.findOne({ email })

    if (existing && existing.emailVerified) {
      return res.status(400).json({ message: "Email already exists" })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const otp = generateEmailOtp()
    const emailOtpHash = hashEmailOtp(otp)
    const emailOtpExpiresAt = createOtpExpiry()
    const emailOtpSentAt = new Date()

    let influencer

    if (existing) {
      existing.name = name
      existing.password = hashedPassword
      existing.emailVerified = false
      existing.emailOtpHash = emailOtpHash
      existing.emailOtpExpiresAt = emailOtpExpiresAt
      existing.emailOtpSentAt = emailOtpSentAt
      influencer = await existing.save()
    } else {
      influencer = await Influencer.create({
        name,
        email,
        password: hashedPassword,
        emailVerified: false,
        emailOtpHash,
        emailOtpExpiresAt,
        emailOtpSentAt
      })
    }

    await sendOtpEmail({
      email: influencer.email,
      name: influencer.name,
      otp,
      action: "registration",
    })

    res.status(201).json({
      message: "Influencer registered. Check your email for the OTP.",
      requiresEmailVerification: true,
      influencer: sanitizeInfluencer(influencer)
    })

  } catch (error) {
    res.status(500).json({ message: "Server error" })
  }
}

export const loginInfluencer = async (req: any, res: any) => {
  try {
    const { email, password, otp } = req.body

    const influencer = await Influencer.findOne({ email })

    if (!influencer) {
      return res.status(400).json({ message: "Invalid credentials" })
    }

    const isMatch = await bcrypt.compare(password, influencer.password)

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" })
    }

    if (!influencer.emailVerified) {
      if (!otp) {
        const retryAfterSeconds = getOtpRetryAfterSeconds(influencer.emailOtpSentAt)
        if (retryAfterSeconds > 0) {
          return res.status(429).json({
            message: `Please wait ${retryAfterSeconds} seconds before requesting a new OTP.`,
            retryAfterSeconds,
          })
        }

        const loginOtp = generateEmailOtp()
        influencer.emailOtpHash = hashEmailOtp(loginOtp)
        influencer.emailOtpExpiresAt = createOtpExpiry()
        influencer.emailOtpSentAt = new Date()
        await influencer.save()

        await sendOtpEmail({
          email: influencer.email,
          name: influencer.name,
          otp: loginOtp,
          action: "login",
        })

        return res.status(202).json({
          message: "We sent a verification code to your email. Enter it to finish login.",
          requiresEmailVerification: true,
          email: influencer.email,
        })
      }

      if (isOtpExpired(influencer.emailOtpExpiresAt) || hashEmailOtp(otp) !== influencer.emailOtpHash) {
        return res.status(400).json({ message: "Invalid or expired OTP" })
      }

      influencer.emailVerified = true
      influencer.emailOtpHash = null
      influencer.emailOtpExpiresAt = null
      influencer.emailOtpSentAt = null
      await influencer.save()
    }

    const token = jwt.sign(
      { id: influencer._id, role: "influencer" },
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" }
    )

    res.json({
      token,
      user: sanitizeInfluencer(influencer)
    })

  } catch (error) {
    res.status(500).json({ message: "Server error" })
  }
}

export const verifyInfluencerEmail = async (req: any, res: any) => {
  try {
    const { email, otp } = req.body

    const influencer = await Influencer.findOne({ email })

    if (!influencer) {
      return res.status(400).json({ message: "Account not found" })
    }

    if (influencer.emailVerified) {
      return res.status(200).json({ message: "Email already verified" })
    }

    if (isOtpExpired(influencer.emailOtpExpiresAt) || hashEmailOtp(otp) !== influencer.emailOtpHash) {
      return res.status(400).json({ message: "Invalid or expired OTP" })
    }

    influencer.emailVerified = true
    influencer.emailOtpHash = null
    influencer.emailOtpExpiresAt = null
    influencer.emailOtpSentAt = null
    await influencer.save()

    return res.status(200).json({ message: "Email verified successfully" })
  } catch (error) {
    res.status(500).json({ message: "Server error" })
  }
}

export const requestInfluencerPasswordReset = async (req: any, res: any) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ message: "Email is required" })
    }

    const influencer = await Influencer.findOne({ email })

    if (!influencer) {
      return res.status(200).json({ message: "If this email exists, an OTP has been sent." })
    }

    const retryAfterSeconds = getOtpRetryAfterSeconds(influencer.emailOtpSentAt)
    if (retryAfterSeconds > 0) {
      return res.status(429).json({
        message: `Please wait ${retryAfterSeconds} seconds before requesting a new OTP.`,
        retryAfterSeconds,
      })
    }

    const otp = generateEmailOtp()
    influencer.emailOtpHash = hashEmailOtp(otp)
    influencer.emailOtpExpiresAt = createOtpExpiry()
    influencer.emailOtpSentAt = new Date()
    await influencer.save()

    await sendOtpEmail({
      email: influencer.email,
      name: influencer.name,
      otp,
      action: "reset",
    })

    return res.status(200).json({ message: "Password reset OTP sent to your email." })
  } catch (error) {
    return res.status(500).json({ message: "Server error" })
  }
}

export const resetInfluencerPassword = async (req: any, res: any) => {
  try {
    const { email, otp, newPassword } = req.body

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: "Email, OTP and new password are required" })
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" })
    }

    const influencer = await Influencer.findOne({ email })

    if (!influencer) {
      return res.status(400).json({ message: "Account not found" })
    }

    if (isOtpExpired(influencer.emailOtpExpiresAt) || hashEmailOtp(otp) !== influencer.emailOtpHash) {
      return res.status(400).json({ message: "Invalid or expired OTP" })
    }

    influencer.password = await bcrypt.hash(newPassword, 10)
    influencer.emailVerified = true
    influencer.emailOtpHash = null
    influencer.emailOtpExpiresAt = null
    influencer.emailOtpSentAt = null
    await influencer.save()

    return res.status(200).json({ message: "Password reset successful. Please login." })
  } catch (error) {
    return res.status(500).json({ message: "Server error" })
  }
}