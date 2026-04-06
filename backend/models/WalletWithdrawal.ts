import mongoose from "mongoose";

const walletWithdrawalSchema = new mongoose.Schema(
  {
    influencerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Influencer",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "paid"],
      default: "pending",
    },
    note: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

walletWithdrawalSchema.index({ influencerId: 1, createdAt: -1 });

export default mongoose.models.WalletWithdrawal ||
  mongoose.model("WalletWithdrawal", walletWithdrawalSchema);
