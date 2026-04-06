import mongoose from "mongoose"

const influencerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailOtpHash: {
    type: String,
    default: null
  },
  emailOtpExpiresAt: {
    type: Date,
    default: null
  },
  emailOtpSentAt: {
    type: Date,
    default: null
  },
  role: {
    type: String,
    default: "influencer"
  }
}, { timestamps: true })

export default mongoose.models.Influencer || mongoose.model("Influencer", influencerSchema)