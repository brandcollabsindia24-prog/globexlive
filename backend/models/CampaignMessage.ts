import mongoose from "mongoose";

const campaignMessageSchema = new mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
    },
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CampaignApplication",
      required: true,
    },
    senderRole: {
      type: String,
      enum: ["brand", "influencer", "admin"],
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    message: {
      type: String,
      default: "",
      trim: true,
    },
    fileUrl: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

campaignMessageSchema.index({ applicationId: 1, createdAt: 1 });

export default mongoose.models.CampaignMessage ||
  mongoose.model("CampaignMessage", campaignMessageSchema);
