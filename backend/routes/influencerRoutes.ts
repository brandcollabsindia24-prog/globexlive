import express from "express"
import {
	loginInfluencer,
	registerInfluencer,
	requestInfluencerPasswordReset,
	resetInfluencerPassword,
	verifyInfluencerEmail,
} from "../controllers/influencerController"
import {
	getInfluencerProfile,
	getInfluencerProfilesForAdmin,
	getVerifiedInfluencerProfilesForBrand,
	uploadInfluencerProfileImage,
	updateInfluencerVerificationStatus,
	upsertInfluencerProfile,
} from "../controllers/influencerProfileController"
import { protect } from "../middleware/authMiddleware"
import { uploadCampaignImage } from "../middleware/uploadMiddleware"

const router = express.Router()

router.post("/register", registerInfluencer)
router.post("/login", loginInfluencer)
router.post("/verify-email", verifyInfluencerEmail)
router.post("/forgot-password", requestInfluencerPasswordReset)
router.post("/reset-password", resetInfluencerPassword)
router.get("/profile/:userId", protect, getInfluencerProfile)
router.post("/profile/image-upload", protect, uploadCampaignImage.single("image"), uploadInfluencerProfileImage)
router.post("/profile", protect, upsertInfluencerProfile)
router.get("/admin/profiles", protect, getInfluencerProfilesForAdmin)
router.get("/brand/profiles/verified", protect, getVerifiedInfluencerProfilesForBrand)
router.patch("/admin/profiles/:profileId/verification-status", protect, updateInfluencerVerificationStatus)

export default router