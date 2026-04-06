import Brand from "../models/Brand";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  createOtpExpiry,
  generateEmailOtp,
  getOtpRetryAfterSeconds,
  hashEmailOtp,
  isOtpExpired,
  sendOtpEmail,
} from "../utils/emailOtp";

function sanitizeBrand(brand: any) {
  return {
    id: brand._id,
    name: brand.name,
    email: brand.email,
    role: brand.role || "brand",
    emailVerified: Boolean(brand.emailVerified),
  };
}

export const registerBrand = async (req: any, res: any) => {
  try {
    const { name, email, password } = req.body;

    const existing = await Brand.findOne({ email });

    if (existing && existing.emailVerified) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateEmailOtp();
    const emailOtpHash = hashEmailOtp(otp);
    const emailOtpExpiresAt = createOtpExpiry();
    const emailOtpSentAt = new Date();

    let brand;

    if (existing) {
      existing.name = name;
      existing.password = hashedPassword;
      existing.emailVerified = false;
      existing.emailOtpHash = emailOtpHash;
      existing.emailOtpExpiresAt = emailOtpExpiresAt;
      existing.emailOtpSentAt = emailOtpSentAt;
      brand = await existing.save();
    } else {
      brand = await Brand.create({
        name,
        email,
        password: hashedPassword,
        emailVerified: false,
        emailOtpHash,
        emailOtpExpiresAt,
        emailOtpSentAt,
      });
    }

    await sendOtpEmail({
      email: brand.email,
      name: brand.name,
      otp,
      action: "registration",
    });

    res.status(201).json({
      message: "Brand registered. Check your email for the OTP.",
      requiresEmailVerification: true,
      brand: sanitizeBrand(brand),
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

export const loginBrand = async (req: any, res: any) => {
  try {
    const { email, password, otp } = req.body;

    const brand = await Brand.findOne({ email });

    if (!brand) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, brand.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    if (!brand.emailVerified) {
      if (!otp) {
        const retryAfterSeconds = getOtpRetryAfterSeconds(brand.emailOtpSentAt);
        if (retryAfterSeconds > 0) {
          return res.status(429).json({
            message: `Please wait ${retryAfterSeconds} seconds before requesting a new OTP.`,
            retryAfterSeconds,
          });
        }

        const loginOtp = generateEmailOtp();
        brand.emailOtpHash = hashEmailOtp(loginOtp);
        brand.emailOtpExpiresAt = createOtpExpiry();
        brand.emailOtpSentAt = new Date();
        await brand.save();

        await sendOtpEmail({
          email: brand.email,
          name: brand.name,
          otp: loginOtp,
          action: "login",
        });

        return res.status(202).json({
          message: "We sent a verification code to your email. Enter it to finish login.",
          requiresEmailVerification: true,
          email: brand.email,
        });
      }

      if (isOtpExpired(brand.emailOtpExpiresAt) || hashEmailOtp(otp) !== brand.emailOtpHash) {
        return res.status(400).json({ message: "Invalid or expired OTP" });
      }

      brand.emailVerified = true;
      brand.emailOtpHash = null;
      brand.emailOtpExpiresAt = null;
      brand.emailOtpSentAt = null;
      await brand.save();
    }

    const token = jwt.sign(
      { id: brand._id, role: "brand" },
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: sanitizeBrand(brand),
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

export const verifyBrandEmail = async (req: any, res: any) => {
  try {
    const { email, otp } = req.body;

    const brand = await Brand.findOne({ email });

    if (!brand) {
      return res.status(400).json({ message: "Account not found" });
    }

    if (brand.emailVerified) {
      return res.status(200).json({ message: "Email already verified" });
    }

    if (isOtpExpired(brand.emailOtpExpiresAt) || hashEmailOtp(otp) !== brand.emailOtpHash) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    brand.emailVerified = true;
    brand.emailOtpHash = null;
    brand.emailOtpExpiresAt = null;
    brand.emailOtpSentAt = null;
    await brand.save();

    return res.status(200).json({ message: "Email verified successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

export const requestBrandPasswordReset = async (req: any, res: any) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const brand = await Brand.findOne({ email });

    if (!brand) {
      return res.status(200).json({ message: "If this email exists, an OTP has been sent." });
    }

    const retryAfterSeconds = getOtpRetryAfterSeconds(brand.emailOtpSentAt);
    if (retryAfterSeconds > 0) {
      return res.status(429).json({
        message: `Please wait ${retryAfterSeconds} seconds before requesting a new OTP.`,
        retryAfterSeconds,
      });
    }

    const otp = generateEmailOtp();
    brand.emailOtpHash = hashEmailOtp(otp);
    brand.emailOtpExpiresAt = createOtpExpiry();
    brand.emailOtpSentAt = new Date();
    await brand.save();

    await sendOtpEmail({
      email: brand.email,
      name: brand.name,
      otp,
      action: "reset",
    });

    return res.status(200).json({ message: "Password reset OTP sent to your email." });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

export const resetBrandPassword = async (req: any, res: any) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: "Email, OTP and new password are required" });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const brand = await Brand.findOne({ email });

    if (!brand) {
      return res.status(400).json({ message: "Account not found" });
    }

    if (isOtpExpired(brand.emailOtpExpiresAt) || hashEmailOtp(otp) !== brand.emailOtpHash) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    brand.password = await bcrypt.hash(newPassword, 10);
    brand.emailVerified = true;
    brand.emailOtpHash = null;
    brand.emailOtpExpiresAt = null;
    brand.emailOtpSentAt = null;
    await brand.save();

    return res.status(200).json({ message: "Password reset successful. Please login." });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};
