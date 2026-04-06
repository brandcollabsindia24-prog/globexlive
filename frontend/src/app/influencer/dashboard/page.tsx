"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import styles from "./InfluencerDashboard.module.css";
import Footer from "@/components/Footer";
import { clearAuthSession, getAuthSession } from "../../../lib/authStorage";
import {
  Campaign,
  ChatMessage,
  DashboardSection,
  EMPTY_DASHBOARD,
  EMPTY_PROFILE,
  ProfileData,
  SocialPlatform,
} from "./types";
import {
  ApplicationStatus as ApplicationStatusSection,
  MyCampaigns,
  Navbar,
  Notifications,
  ProfileSection,
  RatingReview,
} from "./components";

type InfluencerSessionUser = {
  role?: string;
  id?: string;
  _id?: string;
  email?: string;
};

const AnalyticsSection = dynamic(() => import("./components/AnalyticsSection"), {
  loading: () => <div className="p-6">Loading analytics...</div>,
});

const CampaignsSection = dynamic(() => import("./components/CampaignsSection"), {
  loading: () => <div className="p-6">Loading campaigns...</div>,
});

const WalletSection = dynamic(() => import("./components/WalletSection"), {
  loading: () => <div className="p-6">Loading wallet...</div>,
});

const ChatBox = dynamic(() => import("./components/ChatBox"), {
  loading: () => <div className="p-6">Loading chat...</div>,
});

const ProfileForm = dynamic(() => import("./components/ProfileForm"), {
  loading: () => <div className="p-6">Loading profile form...</div>,
});

function InfluencerDashboardClient() {
  "use client";
  const router = useRouter();
  const searchParams = useSearchParams();
  const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || `http://${host}:5000`;

  const [dashboard, setDashboard] = useState(EMPTY_DASHBOARD);
  const [availableCampaigns, setAvailableCampaigns] = useState<Campaign[]>([]);
  const [profile, setProfile] = useState<ProfileData>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);

  const [categoryFilter, setCategoryFilter] = useState("");
  const [minBudgetFilter, setMinBudgetFilter] = useState("");
  const [maxBudgetFilter, setMaxBudgetFilter] = useState("");
  const [followersFilter, setFollowersFilter] = useState("");

  const [selectedChatApplicationId, setSelectedChatApplicationId] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatText, setChatText] = useState("");
  const [chatFileUrl, setChatFileUrl] = useState("");

  const [selectedReviewAppId, setSelectedReviewAppId] = useState("");
  const [reviewRating, setReviewRating] = useState("5");
  const [reviewText, setReviewText] = useState("");

  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawNote, setWithdrawNote] = useState("");

  const [showMenu, setShowMenu] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [showProfileDetails, setShowProfileDetails] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedPlatform, setSelectedPlatform] = useState<SocialPlatform | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingProfileImage, setIsUploadingProfileImage] = useState(false);
  const [formData, setFormData] = useState<ProfileData>(EMPTY_PROFILE);
  const [activeSection, setActiveSection] = useState<DashboardSection | null>(null);

  const dashboardAbortRef = useRef<AbortController | null>(null);
  const hasBootstrappedDashboardRef = useRef(false);
  const lastLoadedFilterKeyRef = useRef("");

  const profileRequiredFields: Array<keyof ProfileData> = ["fullName", "email", "profileImage", "city", "district", "state", "pincode"];
  const isProfileComplete = profileRequiredFields.every((field) => String(profile[field] || "").trim().length > 0);
  const isVerified = profile.verificationStatus === "Approved";

  const isStepOneComplete = (data: ProfileData) => Boolean(data.fullName.trim() && data.email.trim());

  const isInstagramDetailsComplete = (data: ProfileData) =>
    Boolean(
      data.instagramUsername.trim() &&
        data.instagramFollowers.trim() &&
        data.engagementRate.trim() &&
        data.category.trim() &&
        data.instagramLink.trim()
    );

  const isYoutubeDetailsComplete = (data: ProfileData) =>
    Boolean(data.youtubeChannel.trim() && data.youtubeSubscribers.trim() && data.category.trim() && data.youtubeLink.trim());

  const inferPlatformFromData = useCallback((data: ProfileData): SocialPlatform | null => {
    if (isInstagramDetailsComplete(data)) return "instagram";
    if (isYoutubeDetailsComplete(data)) return "youtube";
    return null;
  }, []);

  const isStepTwoComplete = (data: ProfileData) => Boolean(inferPlatformFromData(data));

  const isStepThreeComplete = (data: ProfileData, platform: SocialPlatform | null) => {
    if (platform === "instagram") return isInstagramDetailsComplete(data);
    if (platform === "youtube") return isYoutubeDetailsComplete(data);
    return false;
  };

  const isStepFourComplete = (data: ProfileData) => Boolean(data.city.trim() && data.district.trim() && data.state.trim() && data.pincode.trim());

  const getProfileProgressPercent = (data: ProfileData) => {
    const inferredPlatform = inferPlatformFromData(data);
    let stepsDone = 0;
    if (isStepOneComplete(data)) stepsDone += 1;
    if (isStepTwoComplete(data)) stepsDone += 1;
    if (isStepThreeComplete(data, inferredPlatform)) stepsDone += 1;
    if (isStepFourComplete(data)) stepsDone += 1;

    return Math.round((stepsDone / 4) * 100);
  };

  const getFirstIncompleteStep = (data: ProfileData) => {
    const inferredPlatform = inferPlatformFromData(data);
    if (!isStepOneComplete(data)) return 1;
    if (!isStepTwoComplete(data)) return 2;
    if (!isStepThreeComplete(data, inferredPlatform)) return 3;
    if (!isStepFourComplete(data)) return 4;
    return 1;
  };

  const activeProfileForProgress = showProfileForm ? formData : profile;
  const profileProgress = getProfileProgressPercent(activeProfileForProgress);
  const storedProfileProgress = getProfileProgressPercent(profile);

  const authHeaders = useMemo(() => {
    const token = typeof window !== "undefined" ? getAuthSession("influencer")?.token || "" : "";
    return {
      Authorization: `Bearer ${token || ""}`,
    };
  }, []);

  const dashboardFilters = useMemo(
    () => ({
      category: categoryFilter || undefined,
      minBudget: minBudgetFilter || undefined,
      maxBudget: maxBudgetFilter || undefined,
      followersRequired: followersFilter || undefined,
    }),
    [categoryFilter, minBudgetFilter, maxBudgetFilter, followersFilter]
  );

  const dashboardFilterKey = useMemo(() => JSON.stringify(dashboardFilters), [dashboardFilters]);

  const visibleAvailableCampaigns = useMemo(() => {
    const appliedCampaignIds = new Set(
      dashboard.applications
        .map((application) => String(application.campaignId?._id || "").trim())
        .filter(Boolean)
    );

    return availableCampaigns.filter((campaign) => !appliedCampaignIds.has(String(campaign._id || "").trim()));
  }, [availableCampaigns, dashboard.applications]);

  const getSectionFromQuery = useCallback((value: string | null): DashboardSection | null => {
    if (!value) return null;

    const normalized = value.trim();
    const sections: DashboardSection[] = [
      "analytics",
      "myCampaigns",
      "applicationStatus",
      "campaignFilter",
      "campaigns",
      "ratingReview",
      "notifications",
      "wallet",
    ];

    return sections.includes(normalized as DashboardSection) ? (normalized as DashboardSection) : null;
  }, []);

  const getApiErrorMessage = useCallback((error: unknown, fallback: string) => {
    if (axios.isAxiosError(error)) {
      return (error.response?.data as { message?: string } | undefined)?.message || fallback;
    }
    return fallback;
  }, []);

  const loadDashboard = useCallback(async (options: { force?: boolean } = {}) => {
    const { force = false } = options;

    if (!force && lastLoadedFilterKeyRef.current === dashboardFilterKey) {
      return;
    }

    dashboardAbortRef.current?.abort();
    const controller = new AbortController();
    dashboardAbortRef.current = controller;

    const [dashboardResponse, campaignsResponse] = await Promise.all([
      axios.get(`${apiBaseUrl}/api/campaigns/influencer/dashboard/advanced`, {
        headers: authHeaders,
        signal: controller.signal,
      }),
      axios.get(`${apiBaseUrl}/api/campaigns/influencer/active`, {
        headers: authHeaders,
        params: dashboardFilters,
        signal: controller.signal,
      }),
    ]);

    const data = dashboardResponse.data || EMPTY_DASHBOARD;
    setDashboard({ ...EMPTY_DASHBOARD, ...data });
    setAvailableCampaigns(campaignsResponse.data?.campaigns || []);
    lastLoadedFilterKeyRef.current = dashboardFilterKey;
  }, [apiBaseUrl, authHeaders, dashboardFilters, dashboardFilterKey]);

  useEffect(() => {
    return () => {
      dashboardAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const session = getAuthSession<InfluencerSessionUser>("influencer");
    if (!session) {
      router.replace("/influencer/login");
      return;
    }

    const user = session.user;
    if (user.role !== "influencer") {
      router.replace("/influencer/login");
      return;
    }

    const load = async () => {
      try {
        const userId = user.id || user._id;
        const profileResponse = await axios.get(`${apiBaseUrl}/api/influencers/profile/${userId}`, {
          headers: authHeaders,
        });

        const p = profileResponse.data || {};
        const nextProfile: ProfileData = {
          fullName: p.fullName || "",
          email: p.email || user.email || "",
          profileImage: p.profileImage || "",
          whatsappNumber: p.whatsappNumber || "",
          instagramUsername: p.instagramUsername || "",
          instagramFollowers: p.instagramFollowers || "",
          engagementRate: p.engagementRate || "",
          category: p.category || "",
          niche: p.niche || "",
          instagramLink: p.instagramLink || "",
          youtubeChannel: p.youtubeChannel || "",
          youtubeSubscribers: p.youtubeSubscribers || "",
          youtubeLink: p.youtubeLink || "",
          city: p.city || "",
          district: p.district || "",
          pincode: p.pincode || "",
          state: p.state || "",
          reelLinks: p.reelLinks || [],
          pastCollaborations: p.pastCollaborations || [],
          verificationStatus: p.verificationStatus || "Pending",
        };
        setProfile(nextProfile);
        setFormData(nextProfile);
        setSelectedPlatform(inferPlatformFromData(nextProfile));
      } catch {
        const fallbackProfile = { ...EMPTY_PROFILE, email: user.email || "" };
        setProfile(fallbackProfile);
        setFormData(fallbackProfile);
        setSelectedPlatform(null);
      }

      try {
        await loadDashboard({ force: true });
      } catch (error) {
        if (!axios.isAxiosError(error) || error.code !== "ERR_CANCELED") {
          console.error("Failed to load dashboard", error);
        }
      } finally {
        hasBootstrappedDashboardRef.current = true;
        setLoading(false);
      }
    };

    void load();
  }, [apiBaseUrl, authHeaders, inferPlatformFromData, loadDashboard, router]);

  useEffect(() => {
    if (loading || !hasBootstrappedDashboardRef.current) return;

    const timer = setTimeout(() => {
      void loadDashboard();
    }, 300);

    return () => clearTimeout(timer);
  }, [loading, dashboardFilterKey, loadDashboard]);

  useEffect(() => {
    if (loading) return;
    if (!activeSection) {
      setActiveSection("campaigns");
    }
  }, [loading, activeSection]);

  useEffect(() => {
    if (loading) return;

    const shouldOpenProfileForm = searchParams.get("openProfileForm") === "1";
    const requestedSection = getSectionFromQuery(searchParams.get("section"));
    const shouldRefreshDashboard = searchParams.get("refreshDashboard") === "1";

    if (!shouldOpenProfileForm && !requestedSection && !shouldRefreshDashboard) return;

    if (shouldOpenProfileForm) {
      setShowMenu(false);
      setShowProfileDetails(false);
      setSelectedPlatform(inferPlatformFromData(formData));
      setCurrentStep(getFirstIncompleteStep(formData));
      setShowProfileForm(true);
    }

    if (requestedSection) {
      setActiveSection(requestedSection);
    }

    if (shouldRefreshDashboard) {
      void loadDashboard({ force: true });
    }

    router.replace("/influencer/dashboard");
  }, [formData, getSectionFromQuery, inferPlatformFromData, loadDashboard, loading, router, searchParams]);

  const loadChat = useCallback(async (applicationId: string) => {
    setSelectedChatApplicationId(applicationId);
    try {
      const response = await axios.get(`${apiBaseUrl}/api/campaigns/influencer/applications/${applicationId}/chat`, {
        headers: authHeaders,
      });
      setChatMessages(response.data?.messages || []);
    } catch {
      setChatMessages([]);
    }
  }, [apiBaseUrl, authHeaders]);

  const handleSendChat = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedChatApplicationId) return;

    try {
      await axios.post(
        `${apiBaseUrl}/api/campaigns/influencer/applications/${selectedChatApplicationId}/chat`,
        {
          message: chatText,
          fileUrl: chatFileUrl,
        },
        { headers: authHeaders }
      );

      setChatText("");
      setChatFileUrl("");
      await loadChat(selectedChatApplicationId);
    } catch (error: unknown) {
      alert(getApiErrorMessage(error, "Unable to send message."));
    }
  }, [apiBaseUrl, authHeaders, chatFileUrl, chatText, getApiErrorMessage, loadChat, selectedChatApplicationId]);

  const handleSubmitReview = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedReviewAppId) return;

    try {
      await axios.post(
        `${apiBaseUrl}/api/campaigns/influencer/applications/${selectedReviewAppId}/review`,
        {
          rating: Number(reviewRating),
          review: reviewText,
        },
        { headers: authHeaders }
      );

      setReviewText("");
      await loadDashboard();
      alert("Review submitted.");
    } catch (error: unknown) {
      alert(getApiErrorMessage(error, "Unable to submit review."));
    }
  }, [apiBaseUrl, authHeaders, getApiErrorMessage, loadDashboard, reviewRating, reviewText, selectedReviewAppId]);

  const handleMarkNotificationRead = useCallback(async (notificationId: string) => {
    try {
      await axios.patch(
        `${apiBaseUrl}/api/campaigns/influencer/notifications/${notificationId}/read`,
        {},
        { headers: authHeaders }
      );
      await loadDashboard();
    } catch (error) {
      console.error("Failed to mark notification as read", error);
    }
  }, [apiBaseUrl, authHeaders, loadDashboard]);

  const handleWithdraw = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      await axios.post(
        `${apiBaseUrl}/api/campaigns/influencer/wallet/withdraw`,
        { amount: Number(withdrawAmount), note: withdrawNote },
        { headers: authHeaders }
      );
      setWithdrawAmount("");
      setWithdrawNote("");
      await loadDashboard();
      alert("Withdrawal request submitted.");
    } catch (error: unknown) {
      alert(getApiErrorMessage(error, "Unable to request withdrawal."));
    }
  }, [apiBaseUrl, authHeaders, getApiErrorMessage, loadDashboard, withdrawAmount, withdrawNote]);

  const handleLogout = () => {
    clearAuthSession("influencer");
    router.replace("/influencer/login");
  };

  const handleOpenProfileForm = () => {
    setShowMenu(false);
    if (isProfileComplete) return;
    setSelectedPlatform(inferPlatformFromData(formData));
    setCurrentStep(getFirstIncompleteStep(formData));
    setShowProfileForm(true);
  };

  const handleFormChange = (field: keyof ProfileData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleProfileImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const maxSizeInBytes = 4 * 1024 * 1024;
    if (file.size > maxSizeInBytes) {
      alert("Please upload image less than 4MB.");
      event.target.value = "";
      return;
    }

    setIsUploadingProfileImage(true);
    try {
      const uploadData = new FormData();
      uploadData.append("image", file);

      const response = await axios.post(`${apiBaseUrl}/api/influencers/profile/image-upload`, uploadData, {
        headers: {
          ...authHeaders,
          "Content-Type": "multipart/form-data",
        },
      });

      const imageUrl = response.data?.imageUrl;
      if (!imageUrl) {
        throw new Error("Image URL missing from upload response");
      }

      setFormData((prev) => ({ ...prev, profileImage: imageUrl }));
    } catch (error: unknown) {
      alert(getApiErrorMessage(error, "Unable to upload image right now."));
      event.target.value = "";
    } finally {
      setIsUploadingProfileImage(false);
    }
  };

  const handleNextStep = () => {
    if (currentStep === 1 && !isStepOneComplete(formData)) {
      alert("Please fill Full Name and Email first.");
      return;
    }

    if (currentStep === 2 && !selectedPlatform) {
      alert("Please select Instagram or YouTube first.");
      return;
    }

    if (currentStep === 3 && !isStepThreeComplete(formData, selectedPlatform)) {
      alert(selectedPlatform === "instagram" ? "Please complete all Instagram details." : "Please complete all YouTube details.");
      return;
    }

    setCurrentStep((prev) => Math.min(prev + 1, 4));
  };

  const handlePreviousStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isStepOneComplete(formData) || !formData.profileImage) {
      alert("Please complete Step 1 details first.");
      return;
    }

    const platformForValidation = selectedPlatform || inferPlatformFromData(formData);
    if (!platformForValidation || !isStepTwoComplete(formData)) {
      alert("Please complete Step 2 and select Instagram or YouTube.");
      return;
    }

    if (!isStepThreeComplete(formData, platformForValidation)) {
      alert(platformForValidation === "instagram" ? "Please complete all Instagram details." : "Please complete all YouTube details.");
      return;
    }

    if (isUploadingProfileImage) {
      alert("Please wait for image upload to finish.");
      return;
    }

    if (!isStepFourComplete(formData)) {
      alert("Please fill city, district, state and pincode.");
      return;
    }

    setIsSavingProfile(true);
    try {
      const response = await axios.post(
        `${apiBaseUrl}/api/influencers/profile`,
        {
          ...formData,
          reelLinks: formData.reelLinks || [],
          pastCollaborations: formData.pastCollaborations || [],
        },
        { headers: authHeaders }
      );

      const saved = response.data || {};
      const savedProfile: ProfileData = {
        fullName: saved.fullName || formData.fullName,
        email: saved.email || formData.email,
        profileImage: saved.profileImage || formData.profileImage,
        whatsappNumber: saved.whatsappNumber || formData.whatsappNumber,
        instagramUsername: saved.instagramUsername || formData.instagramUsername,
        instagramFollowers: saved.instagramFollowers || formData.instagramFollowers,
        engagementRate: saved.engagementRate || formData.engagementRate,
        category: saved.category || formData.category,
        niche: saved.niche || formData.niche,
        instagramLink: saved.instagramLink || formData.instagramLink,
        youtubeChannel: saved.youtubeChannel || formData.youtubeChannel,
        youtubeSubscribers: saved.youtubeSubscribers || formData.youtubeSubscribers,
        youtubeLink: saved.youtubeLink || formData.youtubeLink,
        city: saved.city || formData.city,
        district: saved.district || formData.district,
        pincode: saved.pincode || formData.pincode,
        state: saved.state || formData.state,
        reelLinks: saved.reelLinks || formData.reelLinks,
        pastCollaborations: saved.pastCollaborations || formData.pastCollaborations,
        verificationStatus: saved.verificationStatus || formData.verificationStatus,
      };

      setProfile(savedProfile);
      setFormData(savedProfile);
      setSelectedPlatform(inferPlatformFromData(savedProfile));
      setShowProfileForm(false);
      await loadDashboard();
      alert("Profile updated successfully.");
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 413) {
        alert("Image is too large. Please upload a smaller image.");
        return;
      }
      alert(getApiErrorMessage(error, "Unable to save profile right now."));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleOpenSection = useCallback((section: DashboardSection) => {
    const routeMap: Partial<Record<DashboardSection, string>> = {
      myCampaigns: "/influencer/my-applications",
      analytics: "/influencer/dashboard/analytics",
      applicationStatus: "/influencer/dashboard/application-status",
      notifications: "/influencer/dashboard/notifications",
      wallet: "/influencer/wallet",
    };

    const targetRoute = routeMap[section];
    if (targetRoute) {
      router.push(targetRoute);
      return;
    }

    setActiveSection(section);
  }, [router]);

  const handleOpenWalletSection = () => {
    setShowMenu(false);
    handleOpenSection("wallet");
  };

  const handleOpenCampaignsSection = () => {
    handleOpenSection("campaigns");
  };

  if (loading) {
    return <div className="p-8">Loading dashboard...</div>;
  }

  return (
    <section className={styles.pageWrap}>
      <Navbar
        profile={profile}
        profileProgress={profileProgress}
        showMobileNav={showMobileNav}
        showMenu={showMenu}
        isProfileComplete={isProfileComplete}
        onToggleMobileNav={() => setShowMobileNav((prev) => !prev)}
        onCloseMobileNav={() => setShowMobileNav(false)}
        onAvatarClick={() => {
          setShowMenu((prev) => !prev);
          setShowMobileNav(true);
        }}
        onOpenProfileForm={handleOpenProfileForm}
        onOpenProfileDetails={() => {
          setShowProfileDetails(true);
          setShowMenu(false);
        }}
        onOpenWallet={handleOpenWalletSection}
        onOpenLogoutConfirm={() => {
          setShowLogoutConfirm(true);
          setShowMenu(false);
        }}
      />

      <ProfileSection
        storedProfileProgress={storedProfileProgress}
        profile={profile}
        onOpenProfileFormAtFirstIncompleteStep={() => {
          setCurrentStep(getFirstIncompleteStep(formData));
          setShowProfileForm(true);
        }}
        onOpenCampaignsSection={handleOpenCampaignsSection}
        onOpenSection={handleOpenSection}
      />

      {showProfileDetails ? (
        <>
          <div className={styles.overlay} onClick={() => setShowProfileDetails(false)} />
          <div className={styles.viewProfilePopup}>
            <h2 className="text-xl font-semibold">Profile Details</h2>
            {profile.profileImage ? (
              <Image
                src={profile.profileImage}
                alt="Influencer profile"
                className={styles.profileImagePreview}
                width={128}
                height={128}
                unoptimized
              />
            ) : null}
            <div className={styles.profileInfo}>
              <p>
                <strong>Full Name:</strong> {profile.fullName || "N/A"}
              </p>
              <p>
                <strong>Email:</strong> {profile.email || "N/A"}
              </p>
              <p>
                <strong>WhatsApp Number:</strong> {profile.whatsappNumber || "N/A"}
              </p>
              <p>
                <strong>Instagram Username:</strong> {profile.instagramUsername || "N/A"}
              </p>
              <p>
                <strong>Instagram Followers:</strong> {profile.instagramFollowers || "N/A"}
              </p>
              <p>
                <strong>Category:</strong> {profile.category || "N/A"}
              </p>
              <p>
                <strong>Address:</strong>{" "}
                {profile.city || profile.district || profile.state || profile.pincode
                  ? `${profile.city || ""}, ${profile.district || ""}, ${profile.state || ""} - ${profile.pincode || ""}`
                  : "N/A"}
              </p>
              <p>
                <strong>Verification:</strong> {profile.verificationStatus}
              </p>
            </div>

            <div className={styles.profilePopupButtons}>
              <button
                className={styles.editBtn}
                onClick={() => {
                  setShowProfileDetails(false);
                  setFormData(profile);
                  setSelectedPlatform(inferPlatformFromData(profile));
                  setCurrentStep(1);
                  setShowProfileForm(true);
                }}
              >
                Edit Profile
              </button>
              <button className={styles.closeBtn} onClick={() => setShowProfileDetails(false)}>
                Close
              </button>
            </div>
          </div>
        </>
      ) : null}

      {showProfileForm ? (
        <ProfileForm
          showProfileForm={showProfileForm}
          formData={formData}
          currentStep={currentStep}
          selectedPlatform={selectedPlatform}
          isSavingProfile={isSavingProfile}
          onClose={() => setShowProfileForm(false)}
          onProfileSubmit={handleProfileSubmit}
          onProfileImageUpload={handleProfileImageUpload}
          onFormChange={handleFormChange}
          onSelectPlatform={(platform) => {
            setSelectedPlatform(platform);
            setCurrentStep(3);
          }}
          onNextStep={handleNextStep}
          onPreviousStep={handlePreviousStep}
        />
      ) : null}

      {showLogoutConfirm ? (
        <div className={styles.logoutOverlay}>
          <div className={styles.logoutBox}>
            <h3>Are you sure you want to logout?</h3>
            <div className={styles.logoutButtons}>
              <button
                className={styles.confirmBtn}
                onClick={() => {
                  setShowLogoutConfirm(false);
                  handleLogout();
                }}
              >
                Yes, Logout
              </button>
              <button className={styles.cancelBtn} onClick={() => setShowLogoutConfirm(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {activeSection === "analytics" ? <AnalyticsSection dashboard={dashboard} /> : null}
      {activeSection === "myCampaigns" ? <MyCampaigns dashboard={dashboard} /> : null}
      {activeSection === "applicationStatus" ? <ApplicationStatusSection dashboard={dashboard} /> : null}
      {activeSection === "campaigns" ? (
        <CampaignsSection
          availableCampaigns={visibleAvailableCampaigns}
          categoryFilter={categoryFilter}
          minBudgetFilter={minBudgetFilter}
          maxBudgetFilter={maxBudgetFilter}
          followersFilter={followersFilter}
          setCategoryFilter={setCategoryFilter}
          setMinBudgetFilter={setMinBudgetFilter}
          setMaxBudgetFilter={setMaxBudgetFilter}
          setFollowersFilter={setFollowersFilter}
        />
      ) : null}
      {activeSection === "ratingReview" ? (
        <RatingReview
          dashboard={dashboard}
          selectedReviewAppId={selectedReviewAppId}
          reviewRating={reviewRating}
          reviewText={reviewText}
          setSelectedReviewAppId={setSelectedReviewAppId}
          setReviewRating={setReviewRating}
          setReviewText={setReviewText}
          onSubmitReview={handleSubmitReview}
        />
      ) : null}
      {activeSection === "notifications" ? (
        <Notifications dashboard={dashboard} onMarkNotificationRead={handleMarkNotificationRead} />
      ) : null}
      {activeSection === "wallet" ? (
        <WalletSection
          dashboard={dashboard}
          withdrawAmount={withdrawAmount}
          withdrawNote={withdrawNote}
          setWithdrawAmount={setWithdrawAmount}
          setWithdrawNote={setWithdrawNote}
          onWithdraw={handleWithdraw}
        />
      ) : null}

      {selectedChatApplicationId ? (
        <ChatBox
          selectedChatApplicationId={selectedChatApplicationId}
          chatMessages={chatMessages}
          chatText={chatText}
          chatFileUrl={chatFileUrl}
          setChatText={setChatText}
          setChatFileUrl={setChatFileUrl}
          onSendChat={handleSendChat}
        />
      ) : null}

      <Footer />
    </section>
  );
}

export default function InfluencerDashboard() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <InfluencerDashboardClient />
    </Suspense>
  );
}
