"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";
import styles from "../../AdminCampaigns.module.css";
import { getAuthSession } from "../../../../../lib/authStorage";
import CampaignModal from "../../../../brand/dashboard/components/CampaignModal";
import type { CampaignForm } from "../../../../brand/dashboard/types";

type Campaign = {
  _id: string;
  title: string;
  description: string;
  budget: number;
  timeline?: string;
  category?: string;
  location?: string;
  followersRequired?: number;
  imageFile?: string;
  status: "pending" | "active" | "approved" | "completed" | "closed" | "rejected";
};

const EMPTY_FORM: CampaignForm = {
  title: "",
  brandName: "",
  platforms: [],
  websiteLink: "",
  instagramHandle: "",
  categories: [],
  targetGender: "",
  followersRange: "",
  budget: "",
  description: "",
  timeline: "",
  numberOfInfluencers: "",
  pricePerInfluencer: "",
};

type CampaignStatus = "pending" | "active" | "approved" | "completed" | "closed";

type CampaignFormErrorKey =
  | "title"
  | "brandName"
  | "description"
  | "timeline"
  | "budget"
  | "platforms"
  | "websiteLink"
  | "instagramHandle"
  | "categories"
  | "targetGender"
  | "followersRange";

type CampaignFormErrors = Partial<Record<CampaignFormErrorKey, string>>;

function parseDescriptionLine(description: string, label: string): string {
  const lowerLabel = `${label.toLowerCase()}:`;
  const found = description
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.toLowerCase().startsWith(lowerLabel));

  if (!found) return "";
  return found.slice(found.indexOf(":") + 1).trim();
}

function parseMainDescription(description: string): string {
  const lines = description
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(
      (line) =>
        !line.toLowerCase().startsWith("brand name:") &&
        !line.toLowerCase().startsWith("platforms:") &&
        !line.toLowerCase().startsWith("website:") &&
        !line.toLowerCase().startsWith("instagram handle:") &&
        !line.toLowerCase().startsWith("target audience:")
    );

  return lines.join("\n");
}

function parseCsv(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function resolveApiBaseUrl(): string {
  const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
  return process.env.NEXT_PUBLIC_API_BASE_URL || `http://${host}:5000`;
}

export default function AdminCampaignEditPage() {
  const router = useRouter();
  const params = useParams<{ campaignId: string }>();
  const [form, setForm] = useState<CampaignForm>(EMPTY_FORM);
  const [status, setStatus] = useState<CampaignStatus>("pending");
  const [errors, setErrors] = useState<CampaignFormErrors>({});
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const session = getAuthSession("admin");
    const token = session?.token || "";
    const user = session?.user;

    if (!token || !user || user.role !== "admin") {
      router.replace("/admin/auth");
      return;
    }

    const loadCampaign = async () => {
      try {
        const res = await axios.get(`${resolveApiBaseUrl()}/api/admin/campaigns`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const campaigns = (res.data?.campaigns || []) as Campaign[];
        const selected = campaigns.find((item) => item._id === params.campaignId);

        if (!selected) {
          window.alert("Campaign not found.");
          router.replace("/admin/campaigns");
          return;
        }

        setForm({
          title: selected.title || "",
          brandName: parseDescriptionLine(selected.description || "", "Brand Name"),
          platforms: parseCsv(parseDescriptionLine(selected.description || "", "Platforms")),
          websiteLink: parseDescriptionLine(selected.description || "", "Website"),
          instagramHandle: parseDescriptionLine(selected.description || "", "Instagram Handle"),
          categories: parseCsv(selected.category || ""),
          targetGender: parseDescriptionLine(selected.description || "", "Target Audience")
            .split("|")[0]
            ?.trim() || "",
          followersRange: parseDescriptionLine(selected.description || "", "Target Audience")
            .split("|")[1]
            ?.trim() || "",
          budget: String(selected.budget ?? ""),
          description: parseMainDescription(selected.description || ""),
          timeline: selected.timeline || "",
          numberOfInfluencers: "",
          pricePerInfluencer: "",
        });

        setStatus(selected.status === "rejected" ? "pending" : selected.status);
      } catch {
        window.alert("Failed to load campaign details.");
      } finally {
        setLoading(false);
      }
    };

    void loadCampaign();
  }, [params.campaignId, router]);

  const onInputChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));

    setErrors((prev) => {
      const typedKey = name as CampaignFormErrorKey;
      if (!prev[typedKey]) return prev;
      const next = { ...prev };
      delete next[typedKey];
      return next;
    });
  };

  const togglePlatform = (platform: string) => {
    setForm((prev) => {
      const exists = prev.platforms.includes(platform);
      const platforms = exists
        ? prev.platforms.filter((item) => item !== platform)
        : [...prev.platforms, platform];
      return { ...prev, platforms };
    });

    setErrors((prev) => {
      const { platforms, ...rest } = prev;
      return platforms ? rest : prev;
    });
  };

  const toggleCategory = (category: string) => {
    setForm((prev) => {
      const exists = prev.categories.includes(category);
      const categories = exists
        ? prev.categories.filter((item) => item !== category)
        : [...prev.categories, category];
      return { ...prev, categories };
    });

    setErrors((prev) => {
      const { categories, ...rest } = prev;
      return categories ? rest : prev;
    });
  };

  const validate = (next: CampaignForm): CampaignFormErrors => {
    const nextErrors: CampaignFormErrors = {};

    if (!next.title.trim()) nextErrors.title = "Campaign title is required";
    if (!next.brandName.trim()) nextErrors.brandName = "Brand name is required";
    if (!next.description.trim()) nextErrors.description = "Description is required";
    if (!next.timeline.trim()) nextErrors.timeline = "Timeline is required";

    if (!next.budget.trim()) {
      nextErrors.budget = "Budget is required";
    } else if (Number(next.budget) <= 0) {
      nextErrors.budget = "Budget must be greater than 0";
    }

    if (next.platforms.length === 0) nextErrors.platforms = "Select at least one platform";
    if (!next.websiteLink.trim()) nextErrors.websiteLink = "Website link is required";
    if (!next.instagramHandle.trim()) nextErrors.instagramHandle = "Instagram handle is required";
    if (next.categories.length === 0) nextErrors.categories = "Select at least one category";
    if (!next.targetGender.trim()) nextErrors.targetGender = "Target gender is required";
    if (!next.followersRange.trim()) nextErrors.followersRange = "Followers range is required";

    return nextErrors;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const session = getAuthSession("admin");
    const token = session?.token || "";
    if (!token) {
      router.replace("/admin/auth");
      return;
    }

    const nextErrors = validate(form);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    try {
      setSaving(true);
      const compiledDescription = [
        form.description,
        `Brand Name: ${form.brandName}`,
        `Platforms: ${form.platforms.join(", ")}`,
        `Website: ${form.websiteLink}`,
        `Instagram Handle: ${form.instagramHandle}`,
        `Target Audience: ${form.targetGender} | ${form.followersRange}`,
      ]
        .filter(Boolean)
        .join("\n");

      await axios.patch(
        `${resolveApiBaseUrl()}/api/admin/campaigns/${params.campaignId}`,
        {
          title: form.title,
          description: compiledDescription,
          budget: Number(form.budget),
          timeline: form.timeline,
          category: form.categories.join(", "),
          status,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      window.alert("Campaign updated successfully.");
      router.push(`/admin/campaigns/${params.campaignId}`);
    } catch {
      window.alert("Failed to update campaign.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className={styles.emptyText}>Loading campaign editor...</p>;
  }

  return (
    <CampaignModal
      open
      campaign={form}
      errors={errors}
      imagePreviews={[]}
      isPreviewOpen={isPreviewOpen}
      isSubmitting={saving}
      title="Edit Campaign"
      subtitle="Update campaign brief with the same layout used in brand dashboard."
      submitLabel="Save Changes"
      hideImageUpload
      onClose={() => router.back()}
      onSubmit={handleSubmit}
      onImageUpload={() => undefined}
      onCampaignChange={onInputChange}
      onPlatformToggle={togglePlatform}
      onCategoryToggle={toggleCategory}
      onImageRemove={() => undefined}
      onTogglePreview={() => setIsPreviewOpen((prev) => !prev)}
    />
  );
}
