import express from "express";
import { submitContact } from "../controllers/contactController";

const router = express.Router();

router.post("/submit", submitContact);

export default router;
