import Campaign from "../models/Campaign";
import CampaignApplication from "../models/CampaignApplication";
import CampaignMessage from "../models/CampaignMessage";
import Notification from "../models/Notification";
import WalletWithdrawal from "../models/WalletWithdrawal";
import InfluencerProfile from "../models/InfluencerProfile";
import mongoose from "mongoose";

const APP_STATUSES = ["applied", "shortlisted", "accepted", "rejected", "completed"];
const PROFILE_REQUIRED_FIELDS = ["fullName", "email", "profileImage", "city", "district", "state", "pincode"];

function isInfluencerProfileComplete(profile: any): boolean {
  return PROFILE_REQUIRED_FIELDS.every((field) => String(profile?.[field] || "").trim().length > 0);
}

function extractNumberOfInfluencersFromDescription(description: string): number {
  const source = String(description || "");
  const match = source.match(/Number of Influencers:\s*(\d+)/i);
  const value = Number(match?.[1] || 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export const createCampaign = async (req: any, res: any) => {
  try {
    const { title, budget, description, timeline, imageFile, status, category, location, followersRequired } = req.body;

    if (!title || !budget || !description || !timeline) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const uploadedImageUrl = req.file
      ? `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`
      : "";

    const campaign = await Campaign.create({
      brandId: req.user.id,
      title,
      budget: Number(budget),
      description,
      timeline,
      category: category || "",
      location: location || "",
      followersRequired: Number(followersRequired || 0),
      imageFile: uploadedImageUrl || imageFile || "",
      status: status || "pending",
    });

    return res.status(201).json({
      message: "Campaign created successfully",
      campaign,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

export const getMyCampaigns = async (req: any, res: any) => {
  try {
    const campaigns = await Campaign.find({ brandId: req.user.id }).sort({ createdAt: -1 });

    return res.status(200).json({ campaigns });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

export const getBrandCampaignApplications = async (req: any, res: any) => {
  try {
    const role = req.user?.role;
    if (!role || (role !== "brand" && role !== "admin")) {
      return res.status(403).json({ message: "Only brand or admin can access campaign applicants" });
    }

    const { campaignId } = req.params;
    const { tab } = req.query;

    const campaign = await Campaign.findById(campaignId).select("brandId status budget description");
    if (!campaign) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    if (role === "brand" && String(campaign.brandId) !== String(req.user.id)) {
      return res.status(403).json({ message: "You can view applicants only for your campaigns" });
    }

    const filter: any = { campaignId };
    const tabValue = String(tab || "").trim().toLowerCase();
    if (tabValue === "applied") {
      filter.status = "applied";
    } else if (tabValue === "selected") {
      filter.status = { $in: ["accepted", "shortlisted"] };
    } else if (tabValue === "rejected") {
      filter.status = "rejected";
    }

    const applications = await CampaignApplication.find(filter)
      .populate({
        path: "influencerId",
        select: "name email",
      })
      .sort({ createdAt: -1 });

    const influencerIds = applications
      .map((item: any) => String(item.influencerId?._id || ""))
      .filter(Boolean);

    const profiles = await InfluencerProfile.find({ userId: { $in: influencerIds } }).select(
      "userId fullName profileImage instagramUsername instagramFollowers youtubeChannel youtubeSubscribers engagementRate niche category instagramLink youtubeLink"
    );

    const profileByUserId = new Map<string, any>();
    profiles.forEach((profile: any) => {
      profileByUserId.set(String(profile.userId), profile);
    });

    const enrichedApplications = applications.map((application: any) => {
      const influencer = application.influencerId || {};
      const influencerId = String(influencer._id || "");
      const profile = profileByUserId.get(influencerId);

      return {
        _id: application._id,
        campaignId: application.campaignId,
        influencerId,
        status: application.status,
        paymentStatus: application.paymentStatus || "pending",
        paymentAmount: Number(application.paymentAmount || 0),
        contentSubmission: {
          postLink: application.contentSubmission?.postLink || "",
          screenshotLink: application.contentSubmission?.screenshotLink || "",
          note: application.contentSubmission?.note || "",
          approvalStatus: application.contentSubmission?.approvalStatus || "not_submitted",
          submittedAt: application.contentSubmission?.submittedAt || null,
        },
        createdAt: application.createdAt,
        influencer: {
          name: profile?.fullName || influencer.name || "Unknown Influencer",
          email: influencer.email || "",
          instagramUsername: profile?.instagramUsername || "",
          instagramFollowers: profile?.instagramFollowers || "",
          youtubeChannel: profile?.youtubeChannel || "",
          youtubeSubscribers: profile?.youtubeSubscribers || "",
          engagementRate: profile?.engagementRate || "",
          niche: profile?.niche || profile?.category || "",
          category: profile?.category || "",
          profileImage: profile?.profileImage || "",
          instagramLink: profile?.instagramLink || "",
          youtubeLink: profile?.youtubeLink || "",
        },
      };
    });

    const numberOfInfluencers = extractNumberOfInfluencersFromDescription(String(campaign.description || ""));
    const campaignBudget = Number(campaign.budget || 0);
    const pricePerInfluencer =
      numberOfInfluencers > 0 ? Number((campaignBudget / numberOfInfluencers).toFixed(2)) : 0;

    return res.status(200).json({
      campaign: {
        _id: campaign._id,
        status: campaign.status,
        budget: campaignBudget,
        numberOfInfluencers,
        pricePerInfluencer,
      },
      applications: enrichedApplications,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

export const processBulkApplicationPayment = async (req: any, res: any) => {
  try {
    const role = req.user?.role;
    if (!role || (role !== "brand" && role !== "admin")) {
      return res.status(403).json({ message: "Only brand or admin can process campaign payments" });
    }

    const { campaignId } = req.params;
    const { applicationIds, pricePerInfluencer } = req.body || {};

    if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
      return res.status(400).json({ message: "Select at least one influencer application" });
    }

    const uniqueApplicationIds = Array.from(new Set(applicationIds.map((item: any) => String(item || "").trim()).filter(Boolean)));
    if (uniqueApplicationIds.length === 0) {
      return res.status(400).json({ message: "Invalid application selection" });
    }

    const parsedPrice = Number(pricePerInfluencer);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      return res.status(400).json({ message: "Price per influencer must be a valid positive number" });
    }

    const campaign = await Campaign.findById(campaignId).select("brandId budget");
    if (!campaign) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    if (role === "brand" && String(campaign.brandId) !== String(req.user.id)) {
      return res.status(403).json({ message: "You can process payments only for your campaigns" });
    }

    const applications = await CampaignApplication.find({
      _id: { $in: uniqueApplicationIds },
      campaignId,
    }).select("_id influencerId status paymentStatus paymentAmount");

    if (applications.length !== uniqueApplicationIds.length) {
      return res.status(400).json({ message: "Some selected applications are invalid for this campaign" });
    }

    const invalidStatus = applications.find((item: any) => !["applied", "accepted", "shortlisted"].includes(String(item.status || "").toLowerCase()));
    if (invalidStatus) {
      return res.status(400).json({ message: "Only applied or selected influencers can be paid" });
    }

    const campaignBudget = Number(campaign.budget || 0);
    const alreadyPaidAggregate = await CampaignApplication.aggregate([
      {
        $match: {
          campaignId: campaign._id,
          paymentStatus: "paid",
        },
      },
      {
        $project: {
          amount: {
            $cond: [
              { $gt: ["$paymentAmount", 0] },
              "$paymentAmount",
              0,
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    const alreadyPaid = Number(alreadyPaidAggregate[0]?.total || 0);
    const totalPayment = Number((parsedPrice * uniqueApplicationIds.length).toFixed(2));
    const budgetAfterPayment = Number((campaignBudget - alreadyPaid - totalPayment).toFixed(2));

    if (totalPayment > campaignBudget) {
      return res.status(400).json({
        message: "Total payment exceeds campaign budget",
        budget: campaignBudget,
        alreadyPaid,
        totalPayment,
      });
    }

    if (budgetAfterPayment < 0) {
      return res.status(400).json({
        message: "Insufficient remaining budget for selected influencers",
        budget: campaignBudget,
        alreadyPaid,
        totalPayment,
        remainingBudget: Number((campaignBudget - alreadyPaid).toFixed(2)),
      });
    }

    const now = new Date();
    await CampaignApplication.updateMany(
      { _id: { $in: uniqueApplicationIds }, campaignId },
      {
        $set: {
          status: "accepted",
          paymentStatus: "paid",
          paymentAmount: parsedPrice,
          paidAt: now,
        },
      }
    );

    await Notification.insertMany(
      applications.map((application: any) => ({
        influencerId: application.influencerId,
        title: "Payment received",
        message: "Your campaign application has been confirmed and paid.",
        type: "payment",
      }))
    );

    return res.status(200).json({
      message: "Payment processed successfully",
      summary: {
        influencers: uniqueApplicationIds.length,
        pricePerInfluencer: parsedPrice,
        totalPayment,
        budget: campaignBudget,
        alreadyPaid,
        remainingBudget: budgetAfterPayment,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

export const updateMyCampaign = async (req: any, res: any) => {
  try {
    const { campaignId } = req.params;
    const { title, budget, description, timeline, category, status } = req.body;

    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    if (String(campaign.brandId) !== String(req.user.id)) {
      return res.status(403).json({ message: "You can edit only your campaigns" });
    }

    const campaignStatus = String(campaign.status || "").trim().toLowerCase();
    
    // If trying to change status (e.g., go live), allow transition from pending/review to active
    if (status !== undefined) {
      const newStatus = String(status || "").trim().toLowerCase();
      if (newStatus === "active") {
        if (!["pending", "review"].includes(campaignStatus)) {
          return res.status(400).json({ message: "Only pending campaigns can go live" });
        }
        campaign.status = "active";
      } else {
        return res.status(400).json({ message: "Invalid status transition" });
      }
    } else {
      // For regular edits (title, description, etc.), ensure campaign is pending/review
      if (!["pending", "review"].includes(campaignStatus)) {
        return res.status(400).json({ message: "Only pending campaigns can be edited" });
      }
    }

    if (title !== undefined) campaign.title = title;
    if (description !== undefined) campaign.description = description;
    if (timeline !== undefined) campaign.timeline = timeline;
    if (category !== undefined) campaign.category = category;

    if (budget !== undefined) {
      const parsedBudget = Number(budget);
      if (!Number.isFinite(parsedBudget) || parsedBudget <= 0) {
        return res.status(400).json({ message: "Budget must be a valid positive number" });
      }
      campaign.budget = parsedBudget;
    }

    if (req.file) {
      campaign.imageFile = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    }

    await campaign.save();

    return res.status(200).json({
      message: "Campaign updated successfully",
      campaign,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

export const getActiveCampaignsForInfluencer = async (req: any, res: any) => {
  try {
    if (req.user?.role !== "influencer") {
      return res.status(403).json({ message: "Only influencers can access active campaigns" });
    }

    const { category, minBudget, maxBudget, location, followersRequired } = req.query;

    const filter: any = {
      status: { $in: ["active", "approved", "in_progress"] },
    };

    if (category && typeof category === "string") {
      filter.category = category;
    }

    if (location && typeof location === "string") {
      filter.location = { $regex: location, $options: "i" };
    }

    if (followersRequired !== undefined) {
      const minFollowers = Number(followersRequired);
      if (Number.isFinite(minFollowers) && minFollowers > 0) {
        filter.followersRequired = { $lte: minFollowers };
      }
    }

    if (minBudget !== undefined || maxBudget !== undefined) {
      filter.budget = {};

      const min = Number(minBudget);
      const max = Number(maxBudget);

      if (Number.isFinite(min)) {
        filter.budget.$gte = min;
      }

      if (Number.isFinite(max)) {
        filter.budget.$lte = max;
      }

      if (Object.keys(filter.budget).length === 0) {
        delete filter.budget;
      }
    }

    const campaigns = await Campaign.find(filter)
      .populate("brandId", "name")
      .sort({ createdAt: -1 });

    return res.status(200).json({ campaigns });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

export const applyToCampaign = async (req: any, res: any) => {
  try {
    if (req.user?.role !== "influencer") {
      return res.status(403).json({ message: "Only influencers can apply to campaigns" });
    }

    const { campaignId } = req.params;

    const influencerProfile = await InfluencerProfile.findOne({ userId: req.user.id });
    const isProfileComplete = isInfluencerProfileComplete(influencerProfile);
    const isVerified = influencerProfile?.verificationStatus === "Approved";
    let warningMessage = "";

    if (!influencerProfile || !isProfileComplete) {
      return res.status(403).json({
        message: "Complete Your Profile First. Please complete your profile before applying to campaigns.",
      });
    }

    if (!isVerified) {
      warningMessage =
        "Verification Pending. Your profile is under review. You can still apply, but brands may prefer verified profiles.";
    }

    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    if (!["active", "approved"].includes(campaign.status)) {
      return res.status(400).json({ message: "Campaign is not open for applications" });
    }

    const existing = await CampaignApplication.findOne({
      campaignId,
      influencerId: req.user.id,
    });

    if (existing) {
      return res.status(400).json({ message: "You have already applied to this campaign" });
    }

    await CampaignApplication.create({
      campaignId,
      influencerId: req.user.id,
      status: "applied",
    });

    campaign.applications = Number(campaign.applications || 0) + 1;
    await campaign.save();

    return res.status(201).json({
      message: "Application submitted successfully",
      warningMessage,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

export const getInfluencerApplications = async (req: any, res: any) => {
  try {
    if (req.user?.role !== "influencer") {
      return res.status(403).json({ message: "Only influencers can access applications" });
    }

    const applications = await CampaignApplication.find({ influencerId: req.user.id })
      .populate({
        path: "campaignId",
        select: "title budget timeline status description imageFile brandId",
        populate: {
          path: "brandId",
          select: "name brandName",
        },
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({ applications });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

export const getInfluencerDashboardSummary = async (req: any, res: any) => {
  try {
    if (req.user?.role !== "influencer") {
      return res.status(403).json({ message: "Only influencers can access summary" });
    }

    const applications = await CampaignApplication.find({ influencerId: req.user.id }).populate({
      path: "campaignId",
      select: "budget",
    });

    const totalApplied = applications.length;
    const totalWorking = applications.filter((item: any) => ["shortlisted", "accepted"].includes(item.status)).length;
    const totalPaidCampaigns = applications.filter((item: any) => item.paymentStatus === "paid").length;

    const walletBalance = applications.reduce((sum: number, item: any) => {
      if (item.paymentStatus !== "paid") return sum;

      const directAmount = Number(item.paymentAmount || 0);
      if (directAmount > 0) return sum + directAmount;

      const budgetAmount = Number(item.campaignId?.budget || 0);
      return sum + budgetAmount;
    }, 0);

    return res.status(200).json({
      summary: {
        totalApplied,
        totalWorking,
        totalPaidCampaigns,
        walletBalance,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

export const updateApplicationProgress = async (req: any, res: any) => {
  try {
    const role = req.user?.role;
    if (!role || (role !== "brand" && role !== "admin")) {
      return res.status(403).json({ message: "Only brand or admin can update application progress" });
    }

    const { applicationId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(applicationId)) {
      return res.status(400).json({ message: "Invalid application ID" });
    }

    const { status, progress, stage, paymentStatus, paymentAmount, contentApprovalStatus } = req.body;
    const normalizedStatus = String(status || progress || stage || "").trim().toLowerCase();

    const application = await CampaignApplication.findById(applicationId).populate({
      path: "campaignId",
      select: "brandId",
    });

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    if (role === "brand") {
      const campaignOwnerId = String((application.campaignId as any)?.brandId || "");
      if (campaignOwnerId !== String(req.user.id)) {
        return res.status(403).json({ message: "You can update only your campaign applications" });
      }
    }

    const updatePayload: any = {};

    if (normalizedStatus) {
      if (!APP_STATUSES.includes(normalizedStatus)) {
        return res.status(400).json({ message: "Invalid status value" });
      }

      updatePayload.status = normalizedStatus;

      if (normalizedStatus === "accepted") {
        const campaignId = String((application.campaignId as any)?._id || application.campaignId || "");
        if (mongoose.Types.ObjectId.isValid(campaignId)) {
          await Campaign.findByIdAndUpdate(
            campaignId,
            { $set: { status: "in_progress" } },
            { new: false, runValidators: true }
          );
        }
      }

      await Notification.create({
        influencerId: application.influencerId,
        title: "Campaign application updated",
        message: `Your application status is now '${normalizedStatus}'.`,
        type: "status",
      });
    }

    if (paymentStatus !== undefined) {
      if (!["pending", "paid"].includes(String(paymentStatus))) {
        return res.status(400).json({ message: "Invalid paymentStatus value" });
      }

      updatePayload.paymentStatus = paymentStatus;
      updatePayload.paidAt = paymentStatus === "paid" ? new Date() : null;

      if (paymentStatus === "paid") {
        await Notification.create({
          influencerId: application.influencerId,
          title: "Payment received",
          message: "A campaign payment has been marked as paid.",
          type: "payment",
        });
      }
    }

    if (paymentAmount !== undefined) {
      const amount = Number(paymentAmount);
      if (!Number.isFinite(amount) || amount < 0) {
        return res.status(400).json({ message: "Invalid paymentAmount value" });
      }

      updatePayload.paymentAmount = amount;
    }

    if (contentApprovalStatus !== undefined) {
      if (!["approved", "changes_requested", "submitted", "not_submitted"].includes(String(contentApprovalStatus))) {
        return res.status(400).json({ message: "Invalid contentApprovalStatus value" });
      }

      updatePayload["contentSubmission.approvalStatus"] = contentApprovalStatus;

      await Notification.create({
        influencerId: application.influencerId,
        title: "Content submission updated",
        message:
          contentApprovalStatus === "approved"
            ? "Your submitted campaign content has been approved."
            : "Your submitted campaign content needs changes.",
        type: "content",
      });
    }

    if (Object.keys(updatePayload).length === 0) {
      return res.status(400).json({ message: "No valid fields provided for update" });
    }

    const updatedApplication = await CampaignApplication.findByIdAndUpdate(
      applicationId,
      { $set: updatePayload },
      { new: true, runValidators: true }
    );

    if (!updatedApplication) {
      return res.status(404).json({ message: "Application not found" });
    }

    return res.status(200).json({
      message: "Application updated successfully",
      application: updatedApplication,
    });
  } catch (error) {
    console.error("updateApplicationProgress error", {
      applicationId: req.params?.applicationId,
      body: req.body,
      error,
    });
    return res.status(500).json({ message: "Server error" });
  }
};

export const getAdvancedInfluencerDashboard = async (req: any, res: any) => {
  try {
    if (req.user?.role !== "influencer") {
      return res.status(403).json({ message: "Only influencers can access dashboard data" });
    }

    const influencerId = req.user.id;

    const [applications, notifications, profile, withdrawals] = await Promise.all([
      CampaignApplication.find({ influencerId })
        .populate({
          path: "campaignId",
          select: "title budget timeline status brandId category location followersRequired",
          populate: { path: "brandId", select: "name brandName" },
        })
        .sort({ createdAt: -1 }),
      Notification.find({ influencerId }).sort({ createdAt: -1 }).limit(25),
      InfluencerProfile.findOne({ userId: influencerId }),
      WalletWithdrawal.find({ influencerId }).sort({ createdAt: -1 }).limit(20),
    ]);

    const totalApplied = applications.length;
    const acceptedOrShortlisted = applications.filter((item: any) => ["shortlisted", "accepted"].includes(item.status));
    const completed = applications.filter((item: any) => item.status === "completed");
    const totalPaidCampaigns = applications.filter((item: any) => item.paymentStatus === "paid").length;
    const totalEarnings = applications.reduce((sum: number, item: any) => {
      if (item.paymentStatus !== "paid") return sum;
      const direct = Number(item.paymentAmount || 0);
      if (direct > 0) return sum + direct;
      return sum + Number(item.campaignId?.budget || 0);
    }, 0);

    const successRate = totalApplied ? Number(((completed.length / totalApplied) * 100).toFixed(2)) : 0;
    const avgEngagement = Number(profile?.engagementRate || 0) || 0;
    const profileViews = Number(profile?.profileViews || 0);

    const transactions = applications
      .filter((item: any) => item.paymentStatus === "paid")
      .map((item: any) => ({
        id: String(item._id),
        campaignTitle: item.campaignId?.title || "Campaign",
        amount: Number(item.paymentAmount || item.campaignId?.budget || 0),
        status: "paid",
        date: item.paidAt || item.updatedAt,
      }));

    return res.status(200).json({
      summary: {
        totalApplied,
        totalWorking: acceptedOrShortlisted.length,
        totalPaidCampaigns,
        walletBalance: totalEarnings,
      },
      analytics: {
        totalEarnings,
        successRate,
        avgEngagement,
        profileViews,
      },
      myCampaigns: {
        applied: applications.filter((item: any) => item.status === "applied"),
        ongoing: acceptedOrShortlisted,
        completed,
      },
      applications,
      transactions,
      withdrawals,
      notifications,
      portfolio: {
        niche: profile?.niche || "",
        pastCollaborations: profile?.pastCollaborations || [],
        reelLinks: profile?.reelLinks || [],
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

export const submitCampaignContent = async (req: any, res: any) => {
  try {
    if (req.user?.role !== "influencer") {
      return res.status(403).json({ message: "Only influencers can submit content" });
    }

    const { applicationId } = req.params;
    const { postLink, screenshotLink, note } = req.body;

    const application = await CampaignApplication.findOne({ _id: applicationId, influencerId: req.user.id });
    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    if (application.status !== "accepted") {
      return res.status(400).json({ message: "Content can be submitted only for accepted campaigns" });
    }

    application.contentSubmission = {
      postLink: postLink || "",
      screenshotLink: screenshotLink || "",
      note: note || "",
      approvalStatus: "submitted",
      submittedAt: new Date(),
    } as any;

    await application.save();

    return res.status(200).json({ message: "Content submitted for approval", application });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

export const submitInfluencerReview = async (req: any, res: any) => {
  try {
    if (req.user?.role !== "influencer") {
      return res.status(403).json({ message: "Only influencers can submit review" });
    }

    const { applicationId } = req.params;
    const { rating, review } = req.body;

    const application = await CampaignApplication.findOne({ _id: applicationId, influencerId: req.user.id });
    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    if (application.status !== "completed") {
      return res.status(400).json({ message: "Review can be submitted after campaign completion" });
    }

    const numericRating = Number(rating);
    if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }

    application.influencerRatingToBrand = numericRating;
    application.influencerReviewToBrand = review || "";
    await application.save();

    return res.status(200).json({ message: "Review submitted successfully", application });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

export const getCampaignChatMessages = async (req: any, res: any) => {
  try {
    if (req.user?.role !== "influencer") {
      return res.status(403).json({ message: "Only influencers can access chat here" });
    }

    const { applicationId } = req.params;

    const application = await CampaignApplication.findOne({ _id: applicationId, influencerId: req.user.id });
    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    const messages = await CampaignMessage.find({ applicationId }).sort({ createdAt: 1 });
    return res.status(200).json({ messages });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

export const sendCampaignChatMessage = async (req: any, res: any) => {
  try {
    if (req.user?.role !== "influencer") {
      return res.status(403).json({ message: "Only influencers can send messages here" });
    }

    const { applicationId } = req.params;
    const { message, fileUrl } = req.body;

    if (!message && !fileUrl) {
      return res.status(400).json({ message: "Message text or file URL is required" });
    }

    const application = await CampaignApplication.findOne({ _id: applicationId, influencerId: req.user.id });
    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    const created = await CampaignMessage.create({
      campaignId: application.campaignId,
      applicationId,
      senderRole: "influencer",
      senderId: req.user.id,
      message: message || "",
      fileUrl: fileUrl || "",
    });

    return res.status(201).json({ message: "Message sent", chat: created });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

export const getInfluencerNotifications = async (req: any, res: any) => {
  try {
    if (req.user?.role !== "influencer") {
      return res.status(403).json({ message: "Only influencers can access notifications" });
    }

    const notifications = await Notification.find({ influencerId: req.user.id }).sort({ createdAt: -1 }).limit(50);
    return res.status(200).json({ notifications });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

export const markNotificationAsRead = async (req: any, res: any) => {
  try {
    if (req.user?.role !== "influencer") {
      return res.status(403).json({ message: "Only influencers can update notifications" });
    }

    const { notificationId } = req.params;
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, influencerId: req.user.id },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    return res.status(200).json({ message: "Notification marked as read", notification });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

export const createWithdrawRequest = async (req: any, res: any) => {
  try {
    if (req.user?.role !== "influencer") {
      return res.status(403).json({ message: "Only influencers can request withdrawal" });
    }

    const amount = Number(req.body?.amount || 0);
    const note = req.body?.note || "";

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: "Valid amount is required" });
    }

    const request = await WalletWithdrawal.create({
      influencerId: req.user.id,
      amount,
      note,
      status: "pending",
    });

    return res.status(201).json({ message: "Withdraw request submitted", withdrawal: request });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

export const getWithdrawRequests = async (req: any, res: any) => {
  try {
    if (req.user?.role !== "influencer") {
      return res.status(403).json({ message: "Only influencers can view withdrawals" });
    }

    const withdrawals = await WalletWithdrawal.find({ influencerId: req.user.id }).sort({ createdAt: -1 });
    return res.status(200).json({ withdrawals });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};
