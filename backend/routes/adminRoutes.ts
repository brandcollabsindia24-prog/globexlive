import express from "express";
import {
  loginAdmin,
  getBrands,
  getCampaigns,
  approveCampaign,
  deleteCampaign,
  duplicateCampaign,
  updateCampaignDetails,
  getInfluencerProfiles,
  updateInfluencerVerification,
  getContacts,
} from "../controllers/adminController";
import { protect } from "../middleware/authMiddleware";

const router = express.Router();

router.post("/login", loginAdmin);

// Protected routes - require admin authentication
router.get("/brands", protect, getBrands);
router.get("/campaigns", protect, getCampaigns);
router.patch("/campaigns/:campaignId", protect, updateCampaignDetails);
router.patch("/campaigns/:campaignId/status", protect, approveCampaign);
router.post("/campaigns/:campaignId/duplicate", protect, duplicateCampaign);
router.delete("/campaigns/:campaignId", protect, deleteCampaign);
router.get("/influencer-profiles", protect, getInfluencerProfiles);
router.patch("/influencer-profiles/:profileId/verification", protect, updateInfluencerVerification);
router.get("/contacts", protect, getContacts);

export default router;
