"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";
import { getAuthSession } from "../../../../../../lib/authStorage";
import styles from "../../../../dashboard/Dashboard.module.css";
import influencerCardStyles from "../../../../influencers/BrandInfluencers.module.css";

type ApplicantTab = "all" | "selected" | "rejected" | "paid";

type ApplicantItem = {
  _id: string;
  status: string;
  influencerId: string;
  paymentStatus?: "pending" | "paid";
  paymentAmount?: number;
  contentSubmission?: {
    postLink?: string;
    screenshotLink?: string;
    note?: string;
    approvalStatus?: "not_submitted" | "submitted" | "approved" | "changes_requested";
    submittedAt?: string | null;
  };
  createdAt?: string;
  influencer: {
    name: string;
    email?: string;
    profileImage?: string;
    instagramUsername?: string;
    instagramFollowers?: string;
    youtubeChannel?: string;
    youtubeSubscribers?: string;
    engagementRate?: string;
    niche?: string;
    category?: string;
    instagramLink?: string;
    youtubeLink?: string;
  };
};

type CampaignMeta = {
  _id: string;
  status: string;
  budget: number;
  numberOfInfluencers?: number;
  pricePerInfluencer?: number;
};

const DEFAULT_VALUE = "N/A";

function normalizeStatus(value: string | undefined): string {
  return (value || "").trim().toLowerCase();
}

function resolveApiBaseUrl(): string {
  const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
  return process.env.NEXT_PUBLIC_API_BASE_URL || `http://${host}:5000`;
}

function statusTab(status: string, paymentStatus?: "pending" | "paid"): ApplicantTab {
  if (paymentStatus === "paid") return "paid";
  const current = normalizeStatus(status);
  if (current === "rejected") return "rejected";
  if (current === "accepted" || current === "shortlisted") return "selected";
  return "all";
}

function formatValue(value: string | undefined): string {
  const trimmed = String(value || "").trim();
  return trimmed || DEFAULT_VALUE;
}

function hasFilledValue(value: string | undefined): boolean {
  const trimmed = String(value || "").trim();
  if (!trimmed) return false;
  return trimmed.toLowerCase() !== "n/a";
}

function extractInstagramHandle(link: string | undefined): string {
  const raw = String(link || "").trim();
  if (!raw) return DEFAULT_VALUE;

  try {
    const normalized = raw.startsWith("http") ? raw : `https://${raw}`;
    const url = new URL(normalized);
    const firstPart = url.pathname.split("/").filter(Boolean)[0] || "";
    return firstPart ? `@${firstPart}` : DEFAULT_VALUE;
  } catch {
    return raw;
  }
}

function extractYoutubeChannel(link: string | undefined): string {
  const raw = String(link || "").trim();
  if (!raw) return DEFAULT_VALUE;

  try {
    const normalized = raw.startsWith("http") ? raw : `https://${raw}`;
    const url = new URL(normalized);
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return DEFAULT_VALUE;
    return `/${parts.slice(0, 2).join("/")}`;
  } catch {
    return raw;
  }
}

function toClickableUrl(url?: string): string {
  const normalized = String(url || "").trim();
  if (!normalized) return "";
  return /^https?:\/\//i.test(normalized) ? normalized : `https://${normalized}`;
}

function hasSubmission(contentSubmission?: ApplicantItem["contentSubmission"]): boolean {
  const postLink = String(contentSubmission?.postLink || "").trim();
  const caption = String(contentSubmission?.note || "").trim();
  const submittedAt = String(contentSubmission?.submittedAt || "").trim();
  const approvalStatus = String(contentSubmission?.approvalStatus || "").trim().toLowerCase();

  return Boolean(postLink || caption || submittedAt || (approvalStatus && approvalStatus !== "not_submitted"));
}

function formatSubmissionDate(value?: string | null): string {
  const raw = String(value || "").trim();
  if (!raw) return DEFAULT_VALUE;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return DEFAULT_VALUE;
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getSubmissionStatusMeta(approvalStatus: string, hasData: boolean): { label: string; tone: string } {
  if (!hasData) return { label: "Waiting", tone: "pending" };
  if (approvalStatus === "approved") return { label: "Approved", tone: "approved" };
  if (approvalStatus === "changes_requested") return { label: "Rejected", tone: "rejected" };
  if (approvalStatus === "submitted") return { label: "Submitted", tone: "submitted" };
  return { label: "Pending", tone: "pending" };
}

export default function CampaignApplicantsPage() {
  const router = useRouter();
  const params = useParams<{ campaignId: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ApplicantTab>("all");
  const [applications, setApplications] = useState<ApplicantItem[]>([]);
  const [campaign, setCampaign] = useState<CampaignMeta | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedApplicationIds, setSelectedApplicationIds] = useState<string[]>([]);
  const [pricePerInfluencer, setPricePerInfluencer] = useState<string>("");
  const [processingPayment, setProcessingPayment] = useState(false);

  useEffect(() => {
    const session = getAuthSession("brand");
    const token = session?.token || "";
    const user = session?.user;

    if (!token || !user || user.role !== "brand") {
      router.replace("/brand/login");
      return;
    }

    const loadApplications = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await axios.get(
          `${resolveApiBaseUrl()}/api/campaigns/${params.campaignId}/applications`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        setCampaign(response.data?.campaign || null);
        setApplications(response.data?.applications || []);
      } catch (err: any) {
        const message = err.response?.data?.message || "Failed to load applicants";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void loadApplications();
  }, [params.campaignId, router]);

  useEffect(() => {
    const campaignPrice = Number(campaign?.pricePerInfluencer || 0);
    if (campaignPrice > 0) {
      setPricePerInfluencer(String(campaignPrice));
    }
  }, [campaign?.pricePerInfluencer]);

  const counts = useMemo(() => {
    const allCount = applications.filter((app) => statusTab(app.status, app.paymentStatus) === "all").length;
    const selectedCount = applications.filter(
      (app) => statusTab(app.status, app.paymentStatus) === "selected"
    ).length;
    const rejectedCount = applications.filter(
      (app) => statusTab(app.status, app.paymentStatus) === "rejected"
    ).length;
    const paidCount = applications.filter((app) => statusTab(app.status, app.paymentStatus) === "paid").length;

    return {
      all: allCount,
      selected: selectedCount,
      rejected: rejectedCount,
      paid: paidCount,
    };
  }, [applications]);

  const filteredApplications = useMemo(() => {
    return applications.filter((app) => statusTab(app.status, app.paymentStatus) === activeTab);
  }, [applications, activeTab]);

  const selectedApplications = useMemo(() => {
    if (selectedApplicationIds.length === 0) return [];
    const selectedSet = new Set(selectedApplicationIds);
    return applications.filter((app) => selectedSet.has(app._id));
  }, [applications, selectedApplicationIds]);

  const visibleApplications = useMemo(() => {
    return filteredApplications;
  }, [filteredApplications]);

  const parsedPricePerInfluencer = useMemo(() => {
    const amount = Number(pricePerInfluencer);
    return Number.isFinite(amount) && amount > 0 ? amount : 0;
  }, [pricePerInfluencer]);

  const totalPayment = useMemo(() => {
    return Number((parsedPricePerInfluencer * selectedApplicationIds.length).toFixed(2));
  }, [parsedPricePerInfluencer, selectedApplicationIds.length]);

  const paidInCampaign = useMemo(() => {
    return applications.reduce((sum, item) => {
      if (item.paymentStatus !== "paid") return sum;
      return sum + Number(item.paymentAmount || 0);
    }, 0);
  }, [applications]);

  const budget = Number(campaign?.budget || 0);
  const minimumInfluencerSelection = 1;
  const availableBudget = Number((budget - paidInCampaign).toFixed(2));
  const exceedsBudget = totalPayment > availableBudget;
  const belowMinimumSelection = selectedApplicationIds.length < minimumInfluencerSelection;

  const clearSelection = () => {
    setSelectedApplicationIds([]);
  };

  const toggleSelection = (applicationId: string) => {
    setSelectedApplicationIds((prev) => {
      if (prev.includes(applicationId)) {
        return prev.filter((id) => id !== applicationId);
      }
      return [...prev, applicationId];
    });
  };

  const selectableVisibleApplications = useMemo(() => {
    return filteredApplications.filter((item) => {
      const tab = statusTab(item.status, item.paymentStatus);
      const isRejected = tab === "rejected";
      const isPaid = tab === "paid";
      return !isRejected && !isPaid;
    });
  }, [filteredApplications]);

  const handleSelectAllVisible = () => {
    const visibleIds = selectableVisibleApplications.map((item) => item._id);
    if (visibleIds.length === 0) return;

    const selectedSet = new Set(selectedApplicationIds);
    const areAllVisibleSelected = visibleIds.every((id) => selectedSet.has(id));

    if (areAllVisibleSelected) {
      setSelectedApplicationIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
      return;
    }

    setSelectedApplicationIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
  };

  const updateApplicationStatus = async (applicationId: string, nextStatus: "accepted" | "rejected") => {
    const session = getAuthSession("brand");
    const token = session?.token || "";

    if (!token) {
      setError("Authentication required");
      return;
    }

    try {
      setUpdatingId(applicationId);
      setError(null);

      const response = await axios.patch(
        `${resolveApiBaseUrl()}/api/campaigns/applications/${applicationId}/progress`,
        { status: nextStatus },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const updated = response.data?.application;
      if (updated?._id) {
        setApplications((prev) =>
          prev.map((item) => (item._id === updated._id ? { ...item, status: updated.status } : item))
        );
        if (nextStatus === "rejected") {
          setSelectedApplicationIds((prev) => prev.filter((id) => id !== applicationId));
        }
      }
    } catch (err: any) {
      const message = err.response?.data?.message || "Failed to update application status";
      setError(message);
    } finally {
      setUpdatingId(null);
    }
  };

  const updateSubmissionApproval = async (
    applicationId: string,
    nextApprovalStatus: "approved" | "changes_requested"
  ) => {
    const session = getAuthSession("brand");
    const token = session?.token || "";

    if (!token) {
      setError("Authentication required");
      return;
    }

    try {
      setUpdatingId(applicationId);
      setError(null);

      const response = await axios.patch(
        `${resolveApiBaseUrl()}/api/campaigns/applications/${applicationId}/progress`,
        { contentApprovalStatus: nextApprovalStatus },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const updated = response.data?.application;
      if (updated?._id) {
        setApplications((prev) =>
          prev.map((item) =>
            item._id === updated._id
              ? {
                  ...item,
                  contentSubmission: {
                    postLink: updated.contentSubmission?.postLink || item.contentSubmission?.postLink || "",
                    screenshotLink:
                      updated.contentSubmission?.screenshotLink || item.contentSubmission?.screenshotLink || "",
                    note: updated.contentSubmission?.note || item.contentSubmission?.note || "",
                    approvalStatus:
                      updated.contentSubmission?.approvalStatus || item.contentSubmission?.approvalStatus || "not_submitted",
                    submittedAt: updated.contentSubmission?.submittedAt || item.contentSubmission?.submittedAt || null,
                  },
                }
              : item
          )
        );
      }
    } catch (err: any) {
      const message = err.response?.data?.message || "Failed to update submission status";
      setError(message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleProceedToPayment = async () => {
    const session = getAuthSession("brand");
    const token = session?.token || "";

    if (!token) {
      setError("Authentication required");
      return;
    }

    if (selectedApplicationIds.length === 0) {
      setError("Please select at least one influencer");
      return;
    }

    if (belowMinimumSelection) {
      setError(`Minimum ${minimumInfluencerSelection} influencer required for payment`);
      return;
    }

    if (!parsedPricePerInfluencer) {
      setError("Please enter valid price per influencer");
      return;
    }

    if (exceedsBudget) {
      setError("Selected total exceeds campaign budget");
      return;
    }

    try {
      setProcessingPayment(true);
      setError(null);

      await axios.post(
        `${resolveApiBaseUrl()}/api/campaigns/${params.campaignId}/applications/payment`,
        {
          applicationIds: selectedApplicationIds,
          pricePerInfluencer: parsedPricePerInfluencer,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setApplications((prev) => {
        const selectedSet = new Set(selectedApplicationIds);
        return prev.map((item) =>
          selectedSet.has(item._id)
            ? {
                ...item,
                status: "accepted",
                paymentStatus: "paid",
                paymentAmount: parsedPricePerInfluencer,
              }
            : item
        );
      });

      clearSelection();
      setPricePerInfluencer("");
    } catch (err: any) {
      const message = err.response?.data?.message || "Failed to process payment";
      setError(message);
    } finally {
      setProcessingPayment(false);
    }
  };

  const tabs: Array<{ key: ApplicantTab; label: string }> = [
    { key: "all", label: "All" },
    { key: "selected", label: "Selected" },
    { key: "rejected", label: "Rejected" },
    { key: "paid", label: "Paid" },
  ];

  return (
    <section>
      <div className={styles["brand-dashboard-main"]}>
        <div className={styles["welcome-banner"]}>
          <h1>Campaign Applicants</h1>
          <p>Review influencers who applied and update their application status.</p>

          <div className={styles["cta-buttons"]}>
            <Link href="/brand/campaign/my-campaigns" className={styles["explore-btn"]}>
              Back to My Campaigns
            </Link>
          </div>
        </div>

        {error ? <p className={styles["applicants-error"]}>{error}</p> : null}

        {loading ? (
          <p style={{ textAlign: "center", marginTop: "20px" }}>Loading applicants...</p>
        ) : (
          <>
            <div className={styles["applicant-tabs"]} role="tablist" aria-label="Filter applicants by status">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`${styles["manage-campaign-tab"]} ${isActive ? styles["manage-campaign-tab-active"] : ""}`.trim()}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    <span>{tab.label}</span>
                    <span className={styles["manage-campaign-tab-count"]}>{counts[tab.key]}</span>
                  </button>
                );
              })}
            </div>

            {activeTab === "selected" ? (
              <div className={styles["bulk-payment-top"]}>
                <h3>Select influencers for one-time payment</h3>
                <button type="button" className={styles["manage-action-btn"]} onClick={handleSelectAllVisible}>
                  Select All Visible
                </button>
              </div>
            ) : null}

            {visibleApplications.length === 0 ? (
              <div className={styles["empty-state"]}>
                <h3>No {activeTab} applicants</h3>
                <p>
                  {activeTab === "selected"
                    ? "All tab se influencers select karke yahan payment ke liye laa sakte ho."
                    : activeTab === "paid"
                      ? "Selected influencers ka payment complete hone ke baad woh yahan dikhenge."
                      : activeTab === "all"
                        ? "Abhi tak is campaign me koi applicant nahi hai."
                    : "Switch tab to review other applicants."}
                </p>
              </div>
            ) : (
              <div className={influencerCardStyles.grid}>
                {visibleApplications.map((application) => {
                  const profile = application.influencer || {
                    name: "Unknown Influencer",
                    profileImage: undefined,
                  };
                  const isBusy = updatingId === application._id;
                  const instagramUrl = toClickableUrl(profile.instagramLink);
                  const youtubeUrl = toClickableUrl(profile.youtubeLink);
                  const hasInstagram =
                    hasFilledValue(profile.instagramUsername) ||
                    hasFilledValue(profile.instagramFollowers) ||
                    Boolean(instagramUrl);
                  const hasYoutube =
                    hasFilledValue(profile.youtubeChannel) ||
                    hasFilledValue(profile.youtubeSubscribers) ||
                    Boolean(youtubeUrl);
                  const instagramHandle = formatValue(profile.instagramUsername) !== DEFAULT_VALUE
                    ? formatValue(profile.instagramUsername)
                    : extractInstagramHandle(profile.instagramLink);
                  const youtubeChannel = formatValue(profile.youtubeChannel) !== DEFAULT_VALUE
                    ? formatValue(profile.youtubeChannel)
                    : extractYoutubeChannel(profile.youtubeLink);
                  const badgeLabel = hasInstagram && hasYoutube
                    ? "Instagram + YouTube"
                    : hasInstagram
                      ? "Instagram"
                      : hasYoutube
                        ? "YouTube"
                        : "No Platform";
                  const currentTab = statusTab(application.status, application.paymentStatus);
                  const isSelected = selectedApplicationIds.includes(application._id);
                  const isRejected = currentTab === "rejected";
                  const isPaid = currentTab === "paid";
                  const submissionData = application.contentSubmission;
                  const submissionAvailable = hasSubmission(submissionData);
                  const submissionPostLink = toClickableUrl(submissionData?.postLink);
                  const submissionCaption = formatValue(submissionData?.note);
                  const submissionDate = formatSubmissionDate(submissionData?.submittedAt);
                  const submissionApproval = normalizeStatus(submissionData?.approvalStatus);
                  const submissionStatusMeta = getSubmissionStatusMeta(submissionApproval, submissionAvailable);
                  const canBulkSelect = (activeTab === "selected" || activeTab === "all") && !isRejected && !isPaid;

                  return (
                    <article key={application._id} className={influencerCardStyles.card}>
                      {canBulkSelect ? (
                        <label className={styles["bulk-select-checkbox"]}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelection(application._id)}
                          />
                          <span>Select for payment</span>
                        </label>
                      ) : null}

                      <div className={influencerCardStyles.topSection}>
                        <div className={styles["applicant-head-row"]}>
                          <img
                            src={profile.profileImage || "/avatar-placeholder.svg"}
                            alt={profile.name}
                            className={influencerCardStyles.profileImage}
                          />

                          <div className={styles["applicant-head-meta"]}>
                            <span className={influencerCardStyles.platformBadge}>{badgeLabel}</span>
                            {isPaid ? (
                              <span
                                className={`${styles["submission-status-chip"]} ${styles[`submission-status-${submissionStatusMeta.tone}`]}`.trim()}
                              >
                                Submission: {submissionStatusMeta.label}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <h2 className={influencerCardStyles.name}>{profile.name}</h2>
                      </div>

                      <div className={influencerCardStyles.detailsSection}>
                        {hasInstagram ? (
                          <>
                            <p className={influencerCardStyles.meta}>
                              <span className={influencerCardStyles.metaLabel}>Insta Username:</span>{" "}
                              <span className={influencerCardStyles.metaValue}>{instagramHandle}</span>
                            </p>
                            {hasFilledValue(profile.instagramFollowers) ? (
                              <p className={influencerCardStyles.meta}>
                                <span className={influencerCardStyles.metaLabel}>Followers:</span>{" "}
                                <span className={influencerCardStyles.metaValue}>{profile.instagramFollowers}</span>
                              </p>
                            ) : null}
                            {instagramUrl ? (
                              <p className={influencerCardStyles.meta}>
                                <span className={influencerCardStyles.metaLabel}>Insta Link:</span>{" "}
                                <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className={influencerCardStyles.metaLink}>
                                  {profile.instagramLink}
                                </a>
                              </p>
                            ) : null}
                          </>
                        ) : null}

                        {hasYoutube ? (
                          <>
                            <p className={influencerCardStyles.meta}>
                              <span className={influencerCardStyles.metaLabel}>YouTube Channel:</span>{" "}
                              <span className={influencerCardStyles.metaValue}>{youtubeChannel}</span>
                            </p>
                            {hasFilledValue(profile.youtubeSubscribers) ? (
                              <p className={influencerCardStyles.meta}>
                                <span className={influencerCardStyles.metaLabel}>Subscribers:</span>{" "}
                                <span className={influencerCardStyles.metaValue}>{profile.youtubeSubscribers}</span>
                              </p>
                            ) : null}
                            {youtubeUrl ? (
                              <p className={influencerCardStyles.meta}>
                                <span className={influencerCardStyles.metaLabel}>YouTube Link:</span>{" "}
                                <a href={youtubeUrl} target="_blank" rel="noopener noreferrer" className={influencerCardStyles.metaLink}>
                                  {profile.youtubeLink}
                                </a>
                              </p>
                            ) : null}
                          </>
                        ) : null}

                        {hasFilledValue(profile.engagementRate) ? (
                          <p className={influencerCardStyles.meta}>
                            <span className={influencerCardStyles.metaLabel}>Engagement Rate:</span>{" "}
                            <span className={influencerCardStyles.metaValue}>{profile.engagementRate}</span>
                          </p>
                        ) : null}

                        {hasFilledValue(profile.niche || profile.category) ? (
                          <p className={influencerCardStyles.meta}>
                            <span className={influencerCardStyles.metaLabel}>Niche:</span>{" "}
                            <span className={influencerCardStyles.metaValue}>{profile.niche || profile.category}</span>
                          </p>
                        ) : null}

                        {!hasInstagram && !hasYoutube && !hasFilledValue(profile.engagementRate) && !hasFilledValue(profile.niche || profile.category) ? (
                          <p className={influencerCardStyles.meta}>
                            <span className={influencerCardStyles.metaValue}>No social details provided.</span>
                          </p>
                        ) : null}
                      </div>

                      {!isPaid ? (
                        <div className={styles["applicant-actions"]}>
                          <button
                            type="button"
                            className={`${styles["manage-action-btn"]} ${styles["manage-action-success"]}`.trim()}
                            disabled={isBusy || currentTab === "selected"}
                            onClick={() => void updateApplicationStatus(application._id, "accepted")}
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            className={`${styles["manage-action-btn"]} ${styles["manage-action-muted"]}`.trim()}
                            disabled={isBusy || currentTab === "rejected"}
                            onClick={() => void updateApplicationStatus(application._id, "rejected")}
                          >
                            Reject
                          </button>
                        </div>
                      ) : null}

                      {isPaid ? (
                        <section className={styles["applicant-submission-box"]}>
                          <h4 className={styles["applicant-submission-title"]}>Submission</h4>

                          {submissionAvailable ? (
                            <>
                              <p className={influencerCardStyles.meta}>
                                <span className={influencerCardStyles.metaLabel}>Post link:</span>{" "}
                                <span className={influencerCardStyles.metaValue}>
                                  {submissionPostLink ? submissionData?.postLink : DEFAULT_VALUE}
                                </span>
                              </p>
                              <p className={influencerCardStyles.meta}>
                                <span className={influencerCardStyles.metaLabel}>Caption:</span>{" "}
                                <span className={influencerCardStyles.metaValue}>{submissionCaption}</span>
                              </p>
                              <p className={influencerCardStyles.meta}>
                                <span className={influencerCardStyles.metaLabel}>Submission date:</span>{" "}
                                <span className={influencerCardStyles.metaValue}>{submissionDate}</span>
                              </p>

                              <div className={styles["applicant-submission-actions"]}>
                                <button
                                  type="button"
                                  className={`${styles["manage-action-btn"]} ${styles["manage-action-success"]}`.trim()}
                                  disabled={isBusy || submissionApproval === "approved"}
                                  onClick={() => void updateSubmissionApproval(application._id, "approved")}
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  className={`${styles["manage-action-btn"]} ${styles["manage-action-muted"]}`.trim()}
                                  disabled={isBusy || submissionApproval === "changes_requested"}
                                  onClick={() => void updateSubmissionApproval(application._id, "changes_requested")}
                                >
                                  Reject
                                </button>
                                <a
                                  href={submissionPostLink || "#"}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`${styles["manage-action-btn"]} ${styles["applicant-submission-view-btn"]}`.trim()}
                                  aria-disabled={!submissionPostLink}
                                  onClick={(event) => {
                                    if (!submissionPostLink) event.preventDefault();
                                  }}
                                >
                                  View Post
                                </a>
                              </div>
                            </>
                          ) : (
                            <p className={influencerCardStyles.meta}>
                              <span className={influencerCardStyles.metaValue}>Waiting for submission...</span>
                            </p>
                          )}
                        </section>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}

            {activeTab === "selected" ? (
              <div className={styles["bulk-payment-panel"]}>
                <div className={styles["bulk-payment-summary"]}>
                  <p>
                    <span>Influencers Selected:</span> <strong>{selectedApplicationIds.length}</strong>
                  </p>
                  <p>
                    <span>Minimum Required:</span> <strong>{minimumInfluencerSelection}</strong>
                  </p>
                  <p>
                    <span>Campaign Price / Influencer:</span> <strong>INR {Number(campaign?.pricePerInfluencer || 0)}</strong>
                  </p>
                  <p>
                    <span>Total Payment:</span> <strong>INR {totalPayment}</strong>
                  </p>
                  <p>
                    <span>Campaign Budget:</span> <strong>INR {budget}</strong>
                  </p>
                  <p>
                    <span>Campaign Influencer Count:</span> <strong>{Number(campaign?.numberOfInfluencers || 0)}</strong>
                  </p>
                  <p>
                    <span>Available Budget:</span> <strong>INR {availableBudget}</strong>
                  </p>
                </div>

                <div className={styles["bulk-payment-actions"]}>
                  <label className={styles["bulk-payment-label"]}>
                    Price per influencer (INR)
                    <input
                      type="number"
                      min={1}
                      step="0.01"
                      value={pricePerInfluencer}
                      onChange={(event) => setPricePerInfluencer(event.target.value)}
                      className={styles["bulk-payment-input"]}
                      placeholder="Enter amount"
                    />
                  </label>

                  <label className={styles["bulk-payment-label"]}>
                    Total payment (Auto)
                    <input
                      type="number"
                      value={totalPayment}
                      className={styles["bulk-payment-input"]}
                      readOnly
                      disabled
                    />
                  </label>

                  <button
                    type="button"
                    className={styles["go-live-confirm-btn"]}
                    onClick={() => void handleProceedToPayment()}
                    disabled={
                      processingPayment ||
                      belowMinimumSelection ||
                      !parsedPricePerInfluencer ||
                      exceedsBudget
                    }
                  >
                    {processingPayment ? "Processing..." : "Proceed to Payment"}
                  </button>
                </div>

                <p className={styles["bulk-payment-hint"]}>
                  Aap minimum {minimumInfluencerSelection} influencer select karo; minimum se zyada select karoge to total payment automatically
                  price per influencer x selected influencers ke hisaab se calculate hoga.
                </p>

                {exceedsBudget ? (
                  <p className={styles["applicants-error"]}>
                    Total payment exceeds budget. Available budget: INR {availableBudget}
                  </p>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>

    </section>
  );
}
