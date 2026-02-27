"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  UserProfile,
  defaultUserProfile,
  ContentGoal,
  ToneType,
  PostingFrequency,
  PostType,
} from "@/types/profile";
import { apiClient } from "@/lib/api-client";

interface ProfileApiResponse {
  jobTitle?: string;
  company?: string;
  industry?: string;
  specialties?: string[];
  yearsOfExperience?: string;
  targetAudience?: string;
  targetIndustries?: string[];
  contentGoals?: string[];
  preferredTone?: string;
  preferredLanguage?: string;
  contentTopics?: string[];
  uniqueValue?: string;
  expertise?: string[];
  personalBrand?: string;
  postingFrequency?: string;
  preferredPostTypes?: string[];
  phone?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  linkedInProfileUrl?: string;
}

/**
 * Map API response to UserProfile format
 */
function mapApiToProfile(data: ProfileApiResponse): UserProfile {
  return {
    jobTitle: data.jobTitle || "",
    company: data.company || "",
    industry: data.industry || "",
    specialties: data.specialties || [],
    yearsOfExperience: data.yearsOfExperience || "",
    targetAudience: data.targetAudience || "",
    targetIndustries: data.targetIndustries || [],
    contentGoals: (data.contentGoals || []) as ContentGoal[],
    preferredTone: (data.preferredTone || "professional") as ToneType,
    preferredLanguage: (data.preferredLanguage || "fr") as "fr" | "en",
    contentTopics: data.contentTopics || [],
    uniqueValue: data.uniqueValue || "",
    expertise: data.expertise || [],
    personalBrand: data.personalBrand || "",
    postingFrequency: (data.postingFrequency || "weekly") as PostingFrequency,
    preferredPostTypes: (data.preferredPostTypes || []) as PostType[],
    phone: data.phone || "",
    githubUrl: data.githubUrl || "",
    portfolioUrl: data.portfolioUrl || "",
    linkedInProfileUrl: data.linkedInProfileUrl || "",
  };
}

/**
 * Hook for managing user profile with API/Prisma persistence
 */
export function useProfile() {
  const [profile, setProfile] = useState<UserProfile>(defaultUserProfile);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch profile from API
  const fetchProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await apiClient.get<ProfileApiResponse>("/api/profile");
      setProfile(mapApiToProfile(data));
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Save profile to API
  const saveProfile = useCallback(async (newProfile: UserProfile): Promise<boolean> => {
    setIsSaving(true);
    try {
      await apiClient.put("/api/profile", newProfile);
      setProfile(newProfile);
      return true;
    } catch (error) {
      console.error("Error saving profile:", error);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Update specific fields
  const updateProfile = useCallback(
    async (updates: Partial<UserProfile>): Promise<boolean> => {
      const newProfile = { ...profile, ...updates };
      return saveProfile(newProfile);
    },
    [profile, saveProfile]
  );

  // Reset profile to defaults
  const resetProfile = useCallback(
    () => saveProfile(defaultUserProfile),
    [saveProfile]
  );

  // Check if profile is complete enough for generation (memoized)
  const isProfileComplete = useMemo(() => {
    return !!(
      profile.jobTitle &&
      profile.industry &&
      profile.contentGoals.length > 0 &&
      profile.preferredTone
    );
  }, [profile]);

  return {
    profile,
    isLoading,
    isSaving,
    isProfileComplete,
    saveProfile,
    updateProfile,
    resetProfile,
    refetch: fetchProfile,
  };
}
