import { Agenda, Job } from "@hokify/agenda";
import { prisma } from "./prisma";

// Agenda instance (singleton)
let agendaInstance: Agenda | null = null;

/**
 * Get or create the Agenda instance
 */
export function getAgenda(): Agenda {
  if (!agendaInstance) {
    const mongoUri = process.env.DATABASE_URL;
    if (!mongoUri) {
      throw new Error("DATABASE_URL is not defined");
    }

    agendaInstance = new Agenda({
      db: {
        address: mongoUri,
        collection: "agendaJobs",
      },
      processEvery: "1 minute",
      defaultConcurrency: 1,
      maxConcurrency: 5,
    });

    // Define the publish job
    agendaInstance.define("publish-linkedin-post", async (job: Job) => {
      const { userId, scheduleId } = job.attrs.data as {
        userId: string;
        scheduleId: string;
      };

      console.log(`[Agenda] Running publish job for user ${userId}, schedule ${scheduleId}`);

      try {
        // Get a ready post for this user
        const post = await prisma.post.findFirst({
          where: {
            userId,
            status: "ready",
          },
          orderBy: { createdAt: "asc" }, // Oldest ready post first (FIFO)
        });

        if (!post) {
          console.log(`[Agenda] No ready posts found for user ${userId}`);
          return;
        }

        // Get user's LinkedIn credentials
        const account = await prisma.account.findFirst({
          where: {
            userId,
            provider: "linkedin",
          },
        });

        if (!account?.access_token) {
          console.log(`[Agenda] No LinkedIn account found for user ${userId}`);
          return;
        }

        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { linkedInId: true },
        });

        if (!user?.linkedInId) {
          console.log(`[Agenda] No LinkedIn ID found for user ${userId}`);
          return;
        }

        // Publish to LinkedIn
        const { linkedInClient, buildPostBody } = await import("./linkedin");

        const response = await linkedInClient.post(
          "/ugcPosts",
          buildPostBody(user.linkedInId, post.content),
          {
            headers: {
              Authorization: `Bearer ${account.access_token}`,
            },
          }
        );

        // Extract the LinkedIn URN from the response
        // The URN can be in the X-RestLi-Id header or in the response body as 'id'
        const linkedInUrn = response.headers["x-restli-id"] || response.data?.id || null;

        // Update post status and save LinkedIn URN
        await prisma.post.update({
          where: { id: post.id },
          data: {
            status: "published",
            publishedAt: new Date(),
            linkedInUrn: linkedInUrn,
          },
        });

        // Update schedule lastRunAt
        await prisma.schedule.update({
          where: { id: scheduleId },
          data: { lastRunAt: new Date() },
        });

        console.log(`[Agenda] Successfully published post ${post.id} for user ${userId}`);
      } catch (error) {
        console.error(`[Agenda] Error publishing post:`, error);
      }
    });

  }

  return agendaInstance;
}

/**
 * Start the Agenda scheduler
 */
export async function startAgenda(): Promise<void> {
  const agenda = getAgenda();
  await agenda.start();
  
  console.log("[Agenda] Scheduler started");
}

/**
 * Stop the Agenda scheduler
 */
export async function stopAgenda(): Promise<void> {
  if (agendaInstance) {
    await agendaInstance.stop();
    console.log("[Agenda] Scheduler stopped");
  }
}

/**
 * Day names for schedule display
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

/**
 * Calculate the next run date for a schedule
 */
export function calculateNextRunDate(
  dayOfWeek: number,
  time: string,
  timezone: string
): Date {
  const [hours, minutes] = time.split(":").map(Number);
  
  // Get current time in the target timezone
  const now = new Date();
  const nowInTimezone = new Date(
    now.toLocaleString("en-US", { timeZone: timezone })
  );
  
  // Create a date for today at the target time
  const targetDate = new Date(nowInTimezone);
  targetDate.setHours(hours, minutes, 0, 0);
  
  // Calculate days until target day
  const currentDay = nowInTimezone.getDay();
  let daysUntilTarget = dayOfWeek - currentDay;
  
  // If it's the same day, check if the time has passed
  if (daysUntilTarget === 0) {
    if (nowInTimezone >= targetDate) {
      // Time has passed, schedule for next week
      daysUntilTarget = 7;
    }
  } else if (daysUntilTarget < 0) {
    // Target day is earlier in the week, schedule for next week
    daysUntilTarget += 7;
  }
  
  // Add days to get the target date
  targetDate.setDate(targetDate.getDate() + daysUntilTarget);
  
  return targetDate;
}

/**
 * Create or update agenda jobs for a schedule
 */
export async function syncScheduleJobs(scheduleId: string): Promise<void> {
  const agenda = getAgenda();
  
  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
  });

  if (!schedule) {
    console.error(`[Agenda] Schedule ${scheduleId} not found`);
    return;
  }

  // Cancel existing jobs for this schedule
  await agenda.cancel({ "data.scheduleId": scheduleId });

  // If schedule is not active, don't create new jobs
  if (!schedule.isActive) {
    console.log(`[Agenda] Schedule ${scheduleId} is inactive, no jobs created`);
    return;
  }

  // Create jobs for each time slot
  for (const time of schedule.times) {
    const nextRunDate = calculateNextRunDate(
      schedule.dayOfWeek,
      time,
      schedule.timezone
    );

    const jobName = `publish-linkedin-post`;
    const jobData = {
      userId: schedule.userId,
      scheduleId: schedule.id,
      time,
    };

    if (schedule.isRecurring) {
      // Create recurring job
      // Agenda uses human-readable interval strings
      const dayName = DAY_NAMES[schedule.dayOfWeek].toLowerCase();
      await agenda.every(
        `${time} on ${dayName}`,
        jobName,
        jobData,
        { timezone: schedule.timezone }
      );
    } else {
      // Create one-time job
      await agenda.schedule(nextRunDate, jobName, jobData);
    }

    console.log(
      `[Agenda] Created job for schedule ${scheduleId}: ${DAY_NAMES[schedule.dayOfWeek]} at ${time}`
    );
  }

  // Update nextRunAt in the schedule
  const earliestTime = schedule.times.sort()[0];
  const nextRunAt = calculateNextRunDate(
    schedule.dayOfWeek,
    earliestTime,
    schedule.timezone
  );

  await prisma.schedule.update({
    where: { id: scheduleId },
    data: { nextRunAt },
  });
}

/**
 * Delete all jobs for a schedule
 */
export async function deleteScheduleJobs(scheduleId: string): Promise<void> {
  const agenda = getAgenda();
  await agenda.cancel({ "data.scheduleId": scheduleId });
  console.log(`[Agenda] Deleted all jobs for schedule ${scheduleId}`);
}
