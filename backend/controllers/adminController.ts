import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Admin from "../models/Admin";
import Brand from "../models/Brand";
import Campaign from "../models/Campaign";
import InfluencerProfile from "../models/InfluencerProfile";
import CampaignApplication from "../models/CampaignApplication";
import CampaignMessage from "../models/CampaignMessage";
import Contact from "../models/Contact";

export const loginAdmin = async (req: any, res: any) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const admin = await Admin.findOne({ email: String(email).toLowerCase() });

    if (!admin) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: admin._id, role: "admin" },
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      token,
      user: {
        id: admin._id,
        email: admin.email,
        role: "admin",
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

export const getBrands = async (req: any, res: any) => {
  try {
    const brands = await Brand.find().select("_id brandName email contactNumber");
    const totalBrands = await Brand.countDocuments();
    
    return res.status(200).json({
      totalBrands,
      brands: brands || [],
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

export const getCampaigns = async (req: any, res: any) => {
  try {
    const { brandId } = req.query;
    const filter: any = {};

    if (brandId) {
      filter.brandId = brandId;
    }

    const campaigns = await Campaign.find(filter)
      .populate("brandId", "brandName email")
      .select("_id title budget description status brandId createdAt imageFile category timeline location followersRequired applications");
    
    const totalCampaigns = await Campaign.countDocuments(filter);

    return res.status(200).json({
      totalCampaigns,
      campaigns: campaigns || [],
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

export const approveCampaign = async (req: any, res: any) => {
  try {
    const { campaignId } = req.params;
    const { status } = req.body;

    if (!["pending", "active", "approved", "completed", "closed"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const campaign = await Campaign.findByIdAndUpdate(
      campaignId,
      { status },
      { new: true }
    );

    return res.status(200).json({
      message: `Campaign status updated to ${status}`,
      campaign,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

export const duplicateCampaign = async (req: any, res: any) => {
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ message: "Only admin can duplicate campaigns" });
    }

    const { campaignId } = req.params;
    const original = await Campaign.findById(campaignId);

    if (!original) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    const duplicate = await Campaign.create({
      brandId: original.brandId,
      title: `${original.title} (Copy)`,
      budget: original.budget,
      description: original.description,
      timeline: original.timeline,
      category: original.category || "",
      location: original.location || "",
      followersRequired: Number(original.followersRequired || 0),
      imageFile: original.imageFile || "",
      status: "pending",
      applications: 0,
    });

    return res.status(201).json({
      message: "Campaign duplicated successfully",
      campaign: duplicate,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

export const updateCampaignDetails = async (req: any, res: any) => {
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ message: "Only admin can update campaigns" });
    }

    const { campaignId } = req.params;
    const {
      title,
      budget,
      description,
      timeline,
      category,
      location,
      followersRequired,
      status,
      imageFile,
    } = req.body;

    const allowedStatuses = ["pending", "active", "approved", "completed", "closed"];
    if (status && !allowedStatuses.includes(String(status))) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const updateData: any = {};

    if (title !== undefined) updateData.title = String(title).trim();
    if (budget !== undefined) updateData.budget = Number(budget);
    if (description !== undefined) updateData.description = String(description).trim();
    if (timeline !== undefined) updateData.timeline = String(timeline).trim();
    if (category !== undefined) updateData.category = String(category).trim();
    if (location !== undefined) updateData.location = String(location).trim();
    if (followersRequired !== undefined) updateData.followersRequired = Number(followersRequired);
    if (status !== undefined) updateData.status = String(status).trim();
    if (imageFile !== undefined) updateData.imageFile = String(imageFile).trim();

    if (updateData.budget !== undefined && (!Number.isFinite(updateData.budget) || updateData.budget < 0)) {
      return res.status(400).json({ message: "Budget must be a valid non-negative number" });
    }

    if (
      updateData.followersRequired !== undefined &&
      (!Number.isFinite(updateData.followersRequired) || updateData.followersRequired < 0)
    ) {
      return res.status(400).json({ message: "Followers required must be a valid non-negative number" });
    }

    const campaign = await Campaign.findByIdAndUpdate(campaignId, updateData, { new: true });

    if (!campaign) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    return res.status(200).json({
      message: "Campaign updated successfully",
      campaign,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

export const deleteCampaign = async (req: any, res: any) => {
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ message: "Only admin can delete campaigns" });
    }

    const { campaignId } = req.params;

    const campaign = await Campaign.findById(campaignId).select("_id");
    if (!campaign) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    const applications = await CampaignApplication.find({ campaignId }).select("_id");
    const applicationIds = applications.map((item: any) => item._id);

    await Promise.all([
      CampaignMessage.deleteMany({
        $or: [{ campaignId }, ...(applicationIds.length ? [{ applicationId: { $in: applicationIds } }] : [])],
      }),
      CampaignApplication.deleteMany({ campaignId }),
      Campaign.deleteOne({ _id: campaignId }),
    ]);

    return res.status(200).json({ message: "Campaign deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

export const getInfluencerProfiles = async (req: any, res: any) => {
  try {
    const { verificationStatus } = req.query;
    const filter: any = {};

    if (verificationStatus && verificationStatus !== "all") {
      filter.verificationStatus = verificationStatus;
    }

    const profiles = await InfluencerProfile.find(filter)
      .populate("influencerId", "email")
      .select(
        "_id fullName instagramUsername category verificationStatus instagramFollowers engagementRate createdAt"
      );

    const totalPending = await InfluencerProfile.countDocuments({
      verificationStatus: "Pending",
    });
    const totalApproved = await InfluencerProfile.countDocuments({
      verificationStatus: "Approved",
    });
    const totalRejected = await InfluencerProfile.countDocuments({
      verificationStatus: "Rejected",
    });

    return res.status(200).json({
      totalPending,
      totalApproved,
      totalRejected,
      profiles: profiles || [],
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

export const updateInfluencerVerification = async (req: any, res: any) => {
  try {
    const { profileId } = req.params;
    const { verificationStatus } = req.body; // "Approved" or "Rejected"

    if (!["Approved", "Rejected"].includes(verificationStatus)) {
      return res.status(400).json({ message: "Invalid verification status" });
    }

    const profile = await InfluencerProfile.findByIdAndUpdate(
      profileId,
      { verificationStatus },
      { new: true }
    );

    return res.status(200).json({
      message: `Influencer ${verificationStatus.toLowerCase()} successfully`,
      profile,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

export const getContacts = async (req: any, res: any) => {
  try {
    const { userType } = req.query;
    const filter: any = {};

    if (userType && ["brand", "influencer"].includes(String(userType))) {
      filter.userType = String(userType);
    }

    const contacts = await Contact.find(filter)
      .sort({ createdAt: -1 })
      .select("_id name email whatsapp subject message userType createdAt");

    const totalContacts = await Contact.countDocuments(filter);

    return res.status(200).json({
      totalContacts,
      contacts: contacts || [],
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};
