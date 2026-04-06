import mongoose from "mongoose";

const influencerProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Influencer",
      required: true,
      unique: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    profileImage: {
      type: String,
      default: "",
      trim: true,
    },
    whatsappNumber: {
      type: String,
      default: "",
      trim: true,
    },
    instagramUsername: {
      type: String,
      default: "",
      trim: true,
    },
    instagramFollowers: {
      type: String,
      default: "",
      trim: true,
    },
    engagementRate: {
      type: String,
      default: "",
      trim: true,
    },
    category: {
      type: String,
      default: "",
      trim: true,
    },
    niche: {
      type: String,
      default: "",
      trim: true,
    },
    reelLinks: {
      type: [String],
      default: [],
    },
    pastCollaborations: {
      type: [String],
      default: [],
    },
    profileViews: {
      type: Number,
      default: 0,
      min: 0,
    },
    instagramLink: {
      type: String,
      default: "",
      trim: true,
    },
    youtubeChannel: {
      type: String,
      default: "",
      trim: true,
    },
    youtubeSubscribers: {
      type: String,
      default: "",
      trim: true,
    },
    youtubeLink: {
      type: String,
      default: "",
      trim: true,
    },
    city: {
      type: String,
      default: "",
      trim: true,
    },
    district: {
      type: String,
      default: "",
      trim: true,
    },
    state: {
      type: String,
      default: "",
      trim: true,
    },
    pincode: {
      type: String,
      default: "",
      trim: true,
    },
    verificationStatus: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
  },
  { timestamps: true }
);

export default mongoose.models.InfluencerProfile ||
  mongoose.model("InfluencerProfile", influencerProfileSchema);
