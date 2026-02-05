/**
 * User profile settings for LinkedIn content generation
 */
export interface UserProfile {
  // Professional information
  jobTitle: string;
  company: string;
  industry: string;
  yearsOfExperience: string;

  // Target audience
  targetAudience: string;
  targetIndustries: string[];

  // Content preferences
  contentGoals: ContentGoal[];
  preferredTone: ToneType;
  preferredLanguage: "fr" | "en";
  contentTopics: string[];

  // Personal branding
  uniqueValue: string;
  expertise: string[];
  personalBrand: string;

  // Posting preferences
  postingFrequency: PostingFrequency;
  preferredPostTypes: PostType[];
}

export type ContentGoal =
  | "thought_leadership"
  | "lead_generation"
  | "brand_awareness"
  | "network_growth"
  | "recruitment"
  | "education"
  | "engagement";

export type ToneType =
  | "professional"
  | "casual"
  | "inspirational"
  | "educational"
  | "storytelling"
  | "provocative"
  | "humorous";

export type PostingFrequency =
  | "daily"
  | "several_per_week"
  | "weekly"
  | "bi_weekly"
  | "monthly";

export type PostType =
  | "text"
  | "image"
  | "carousel"
  | "video"
  | "poll"
  | "article"
  | "document";

/**
 * Default empty profile
 */
export const defaultUserProfile: UserProfile = {
  jobTitle: "",
  company: "",
  industry: "",
  yearsOfExperience: "",
  targetAudience: "",
  targetIndustries: [],
  contentGoals: [],
  preferredTone: "professional",
  preferredLanguage: "fr",
  contentTopics: [],
  uniqueValue: "",
  expertise: [],
  personalBrand: "",
  postingFrequency: "weekly",
  preferredPostTypes: ["text"],
};

/**
 * Industry keys for translation lookup
 * Labels are now managed via i18n in messages/[locale].json under "industries"
 */
export const industryKeys = [
  "tech",
  "finance",
  "healthcare",
  "education",
  "marketing",
  "consulting",
  "real_estate",
  "retail",
  "manufacturing",
  "legal",
  "hr",
  "media",
  "nonprofit",
  "government",
  "startup",
  "other",
] as const;

export type IndustryKey = (typeof industryKeys)[number];

/**
 * Content goal keys for translation lookup
 * Labels are now managed via i18n in messages/[locale].json under "contentGoals"
 */
export const contentGoalKeys: ContentGoal[] = [
  "thought_leadership",
  "lead_generation",
  "brand_awareness",
  "network_growth",
  "recruitment",
  "education",
  "engagement",
];

/**
 * Tone keys for translation lookup
 * Labels are now managed via i18n in messages/[locale].json under "tones"
 */
export const toneKeys: ToneType[] = [
  "professional",
  "casual",
  "inspirational",
  "educational",
  "storytelling",
  "provocative",
  "humorous",
];

/**
 * Post type keys for translation lookup
 * Labels are now managed via i18n in messages/[locale].json under "postTypes"
 */
export const postTypeKeys: PostType[] = [
  "text",
  "image",
  "carousel",
  "video",
  "poll",
  "article",
  "document",
];

/**
 * Posting frequency keys for translation lookup
 * Labels are now managed via i18n in messages/[locale].json under "postingFrequency"
 */
export const postingFrequencyKeys: PostingFrequency[] = [
  "daily",
  "several_per_week",
  "weekly",
  "bi_weekly",
  "monthly",
];
