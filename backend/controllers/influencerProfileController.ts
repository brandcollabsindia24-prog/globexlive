import InfluencerProfile from "../models/InfluencerProfile";

const ensureAdmin = (req: any, res: any) => {
  if (req.user?.role !== "admin") {
    res.status(403).json({ message: "Admin access required" });
    return false;
  }

  return true;
};

export const getInfluencerProfile = async (req: any, res: any) => {
  try {
    const { userId: requestedUserId } = req.params;
    const userId = req.user?.role === "influencer" ? req.user.id : requestedUserId;

    if (!userId) {
      return res.status(400).json({ message: "User id is required" });
    }

    const profile = await InfluencerProfile.findOne({ userId });

    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    return res.status(200).json(profile);
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

export const upsertInfluencerProfile = async (req: any, res: any) => {
  try {
    const {
      userId: requestedUserId,
      fullName,
      email,
      profileImage,
      whatsappNumber,
      instagramUsername,
      instagramFollowers,
      engagementRate,
      category,
      niche,
      reelLinks,
      pastCollaborations,
      instagramLink,
      youtubeChannel,
      youtubeSubscribers,
      youtubeLink,
      city,
      district,
      state,
      pincode,
    } = req.body;

    const userId = req.user?.role === "influencer" ? req.user.id : requestedUserId;

    if (!userId || !fullName || !email || !profileImage || !city || !district || !state || !pincode) {
      return res.status(400).json({ message: "Required fields are missing" });
    }

    const profile = await InfluencerProfile.findOneAndUpdate(
      { userId },
      {
        userId,
        fullName,
        email,
        profileImage,
        whatsappNumber: whatsappNumber || "",
        instagramUsername: instagramUsername || "",
        instagramFollowers: instagramFollowers || "",
        engagementRate: engagementRate || "",
        category: category || "",
        niche: niche || "",
        reelLinks: Array.isArray(reelLinks) ? reelLinks.filter(Boolean) : [],
        pastCollaborations: Array.isArray(pastCollaborations) ? pastCollaborations.filter(Boolean) : [],
        instagramLink: instagramLink || "",
        youtubeChannel: youtubeChannel || "",
        youtubeSubscribers: youtubeSubscribers || "",
        youtubeLink: youtubeLink || "",
        city,
        district,
        state,
        pincode,
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    return res.status(200).json(profile);
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

export const uploadInfluencerProfileImage = async (req: any, res: any) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Image file is required" });
    }

    const imageUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    return res.status(200).json({ imageUrl });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

export const getInfluencerProfilesForAdmin = async (req: any, res: any) => {
  try {
    if (!ensureAdmin(req, res)) {
      return;
    }

    const { status } = req.query;
    const filter: any = {};

    if (status && typeof status === "string") {
      filter.verificationStatus = status;
    }

    const profiles = await InfluencerProfile.find(filter).sort({ createdAt: -1 });
    return res.status(200).json({ profiles });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

export const getVerifiedInfluencerProfilesForBrand = async (req: any, res: any) => {
  try {
    const role = req.user?.role;

    if (role !== "brand" && role !== "admin") {
      return res.status(403).json({ message: "Brand access required" });
    }

    const profiles = await InfluencerProfile.find({ verificationStatus: "Approved" }).sort({ createdAt: -1 });

    return res.status(200).json({ profiles });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

export const updateInfluencerVerificationStatus = async (req: any, res: any) => {
  try {
    if (!ensureAdmin(req, res)) {
      return;
    }

    const { profileId } = req.params;
    const { verificationStatus } = req.body;

    if (!["Pending", "Approved", "Rejected"].includes(verificationStatus)) {
      return res.status(400).json({ message: "Invalid verification status" });
    }

    const profile = await InfluencerProfile.findByIdAndUpdate(
      profileId,
      { verificationStatus },
      { new: true }
    );

    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    return res.status(200).json({ message: "Verification status updated", profile });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};
