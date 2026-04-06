import express from "express"
import {
	loginBrand,
	registerBrand,
	requestBrandPasswordReset,
	resetBrandPassword,
	verifyBrandEmail,
} from "../controllers/brandController"

const router = express.Router()

router.post("/register", registerBrand)
router.post("/login", loginBrand)
router.post("/verify-email", verifyBrandEmail)
router.post("/forgot-password", requestBrandPasswordReset)
router.post("/reset-password", resetBrandPassword)

export default router