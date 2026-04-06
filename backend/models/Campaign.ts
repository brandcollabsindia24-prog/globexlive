import mongoose from "mongoose";

const campaignSchema = new mongoose.Schema(
  {
    brandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    budget: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    timeline: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      default: "",
      trim: true,
    },
    location: {
      type: String,
      default: "",
      trim: true,
    },
    followersRequired: {
      type: Number,
      default: 0,
      min: 0,
    },
    imageFile: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "active", "approved", "in_progress", "completed", "closed"],
      default: "pending",
    },
    applications: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export default mongoose.models.Campaign || mongoose.model("Campaign", campaignSchema);
