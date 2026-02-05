"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api-client";

export interface Schedule {
  id: string;
  name: string;
  isActive: boolean;
  isRecurring: boolean;
  dayOfWeek: number;
  times: string[];
  timezone: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
}

export interface CreateScheduleData {
  name: string;
  dayOfWeek: number;
  times: string[];
  timezone: string;
  isRecurring?: boolean;
}

export interface UpdateScheduleData {
  name?: string;
  dayOfWeek?: number;
  times?: string[];
  timezone?: string;
  isRecurring?: boolean;
  isActive?: boolean;
}

export function useSchedules() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSchedules = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await apiClient.get<Schedule[]>("/api/schedules");
      setSchedules(data);
    } catch (err) {
      setError("Failed to fetch schedules");
      console.error("Error fetching schedules:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const createSchedule = async (data: CreateScheduleData): Promise<{ success: boolean; error?: string; schedule?: Schedule }> => {
    try {
      setIsSaving(true);
      setError(null);
      const schedule = await apiClient.post<Schedule>("/api/schedules", data);
      setSchedules((prev) => [...prev, schedule]);
      return { success: true, schedule };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create schedule";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsSaving(false);
    }
  };

  const updateSchedule = async (id: string, data: UpdateScheduleData): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsSaving(true);
      setError(null);
      const updatedSchedule = await apiClient.put<Schedule>(`/api/schedules/${id}`, data);
      setSchedules((prev) =>
        prev.map((schedule) => (schedule.id === id ? updatedSchedule : schedule))
      );
      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update schedule";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsSaving(false);
    }
  };

  const deleteSchedule = async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsSaving(true);
      setError(null);
      await apiClient.delete(`/api/schedules/${id}`);
      setSchedules((prev) => prev.filter((schedule) => schedule.id !== id));
      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to delete schedule";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSchedule = async (id: string, isActive: boolean): Promise<{ success: boolean; error?: string }> => {
    return updateSchedule(id, { isActive });
  };

  return {
    schedules,
    isLoading,
    isSaving,
    error,
    fetchSchedules,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    toggleSchedule,
  };
}

/**
 * Day names - deprecated, use i18n translations instead
 * Translations are in messages/[locale].json under "schedule.days"
 * @deprecated Use useTranslations("schedule") to get day names
 */
export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * Day names in French - deprecated, use i18n translations instead
 * @deprecated Use useTranslations("schedule") to get day names
 */
export const DAY_NAMES_FR = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
];

/**
 * Timezone options
 */
export const TIMEZONE_OPTIONS = [
  { value: "Europe/Paris", label: "Paris (CET/CEST)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "America/New_York", label: "New York (EST/EDT)" },
  { value: "America/Los_Angeles", label: "Los Angeles (PST/PDT)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Shanghai", label: "Shanghai (CST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST/AEDT)" },
  { value: "Africa/Nairobi", label: "Nairobi (EAT)" },
  { value: "Indian/Antananarivo", label: "Antananarivo (EAT)" },
];
