import { Agenda, Job } from "@hokify/agenda";
import { prisma } from "./prisma";

// Agenda instance (singleton)
let agendaInstance: Agenda | null = null;

/**
 * Get or create the Agenda instance.
 * Ensures the instance is connected before returning.
 */
export async function getAgenda(): Promise<Agenda> {
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
        // Always update lastRunAt so we know the cron fired, even if there's nothing to publish
        await prisma.schedule.update({
          where: { id: scheduleId },
          data: { lastRunAt: new Date() },
        });

        // Count how many ready posts are left for this user
        const readyCount = await prisma.post.count({
          where: { userId, status: "ready" },
        });

        // No ready posts at all — skip gracefully, do NOT attempt to create new posts
        if (readyCount === 0) {
          console.log(
            `[Agenda] No ready posts for user ${userId}. Skipping publication. ` +
            `The cron job remains active and will retry on the next scheduled run.`
          );
          return;
        }

        console.log(`[Agenda] ${readyCount} ready post(s) remaining for user ${userId}`);

        // Pick the oldest ready post (FIFO queue)
        const post = await prisma.post.findFirst({
          where: { userId, status: "ready" },
          orderBy: { createdAt: "asc" },
        });

        // Safety check (shouldn't happen since readyCount > 0)
        if (!post) {
          console.warn(`[Agenda] Race condition: ready count was ${readyCount} but no post found`);
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
          console.warn(`[Agenda] No LinkedIn access token for user ${userId}. Skipping.`);
          return;
        }

        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { linkedInId: true },
        });

        if (!user?.linkedInId) {
          console.warn(`[Agenda] No LinkedIn ID for user ${userId}. Skipping.`);
          return;
        }

        // Publish to LinkedIn (with image support)
        const {
          linkedInClient,
          buildPostBody,
          buildPostBodyWithImage,
          prepareLinkedInImage,
        } = await import("./linkedin");

        // If post has an image, upload it to LinkedIn first
        let postBody;
        if (post.imageUrl) {
          const imageAsset = await prepareLinkedInImage(
            post.imageUrl,
            user.linkedInId,
            account.access_token
          );

          if (imageAsset) {
            console.log(`[Agenda] Image asset ready: ${imageAsset}`);
            postBody = buildPostBodyWithImage(user.linkedInId, post.content, imageAsset);
          } else {
            console.warn("[Agenda] Image upload failed, publishing text-only");
            postBody = buildPostBody(user.linkedInId, post.content);
          }
        } else {
          postBody = buildPostBody(user.linkedInId, post.content);
        }

        const response = await linkedInClient.post(
          "/posts",
          postBody,
          {
            headers: {
              Authorization: `Bearer ${account.access_token}`,
            },
          }
        );

        // Extract the LinkedIn URN from the response headers (201 response)
        // The x-restli-id header contains: urn:li:share:{id} or urn:li:ugcPost:{id}
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

        // Log remaining posts after this publication
        const remainingReady = readyCount - 1;
        console.log(
          `[Agenda] Published post ${post.id} for user ${userId}. ` +
          `${remainingReady} ready post(s) remaining in queue.`
        );
      } catch (error) {
        console.error(`[Agenda] Error publishing post:`, error);
      }
    });

    // Wait for the MongoDB connection to be ready
    await new Promise<void>((resolve, reject) => {
      agendaInstance!.on("ready", () => resolve());
      agendaInstance!.on("error", (err) => reject(err));
    });

    console.log("[Agenda] Connected to MongoDB");
  }

  return agendaInstance;
}

/**
 * Start the Agenda scheduler
 */
export async function startAgenda(): Promise<void> {
  const agenda = await getAgenda();
  await agenda.start();
  
  console.log("[Agenda] Scheduler started");
}

/**
 * Stop the Agenda scheduler gracefully
 */
export async function stopAgenda(): Promise<void> {
  if (agendaInstance) {
    await agendaInstance.stop();
    agendaInstance = null;
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
 * Convert a time string (HH:mm) and dayOfWeek (0-6) into a cron expression.
 * Cron format: minute hour * * dayOfWeek
 * Note: cron uses 0=Sunday, 1=Monday, ..., 6=Saturday (same as JS)
 */
function toCronExpression(time: string, dayOfWeek: number): string {
  const [hours, minutes] = time.split(":").map(Number);
  return `${minutes} ${hours} * * ${dayOfWeek}`;
}

/**
 * Create or update agenda jobs for a schedule
 */
export async function syncScheduleJobs(scheduleId: string): Promise<void> {
  const agenda = await getAgenda();
  
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
    const jobName = "publish-linkedin-post";
    const jobData = {
      userId: schedule.userId,
      scheduleId: schedule.id,
      time,
    };

    if (schedule.isRecurring) {
      // Create recurring job using cron expression
      // Example: "15 13 * * 1" = every Monday at 13:15
      const cronExpression = toCronExpression(time, schedule.dayOfWeek);
      
      await agenda.every(
        cronExpression,
        jobName,
        jobData,
        { timezone: schedule.timezone }
      );
      
      console.log(
        `[Agenda] Created recurring job for schedule ${scheduleId}: cron "${cronExpression}" (${DAY_NAMES[schedule.dayOfWeek]} at ${time}, tz: ${schedule.timezone})`
      );
    } else {
      // Create one-time job
      const nextRunDate = calculateNextRunDate(
        schedule.dayOfWeek,
        time,
        schedule.timezone
      );
      
      await agenda.schedule(nextRunDate, jobName, jobData);
      
      console.log(
        `[Agenda] Created one-time job for schedule ${scheduleId}: ${DAY_NAMES[schedule.dayOfWeek]} at ${time} -> ${nextRunDate.toISOString()}`
      );
    }
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
  
  console.log(`[Agenda] Schedule ${scheduleId} synced, next run at ${nextRunAt.toISOString()}`);
}

/**
 * Delete all jobs for a schedule
 */
export async function deleteScheduleJobs(scheduleId: string): Promise<void> {
  const agenda = await getAgenda();
  await agenda.cancel({ "data.scheduleId": scheduleId });
  console.log(`[Agenda] Deleted all jobs for schedule ${scheduleId}`);
}
