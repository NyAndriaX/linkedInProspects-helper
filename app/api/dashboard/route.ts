import { prisma } from "@/lib/prisma";
import { ApiResponse, getAuthenticatedSession } from "@/lib/api-utils";

const OWNER_LIMIT = 100;
const FREE_LIMIT = 10;

// GET /api/dashboard — Aggregated dashboard data in a single query
export async function GET() {
  try {
    const session = await getAuthenticatedSession();
    if (!session) return ApiResponse.unauthorized();

    const userId = session.user.id;
    const userEmail = session.user.email;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(today.getDate() + 3);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    // Run all queries in parallel for speed
    const [
      // 1. Follow-up steps due (overdue + today + upcoming 3 days)
      dueSteps,
      // 2. All prospects for pipeline stats
      allProspects,
      // 3. Prospects without any sequence
      prospectsWithoutSequence,
      // 4. Post stats
      postStats,
      // 5. Hunter usage this month
      hunterUsage,
    ] = await Promise.all([
      // Due sequence steps
      prisma.sequenceStep.findMany({
        where: {
          status: "pending",
          dueDate: { lte: threeDaysFromNow },
          sequence: { userId },
        },
        include: {
          sequence: {
            include: {
              prospect: {
                select: {
                  id: true,
                  name: true,
                  company: true,
                  email: true,
                  status: true,
                },
              },
            },
          },
        },
        orderBy: { dueDate: "asc" },
      }),

      // All prospects
      prisma.prospect.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          company: true,
          email: true,
          status: true,
          lastContactDate: true,
          updatedAt: true,
          sequences: { select: { id: true } },
        },
      }),

      // Prospects count without sequence (for pipeline card)
      prisma.prospect.count({
        where: {
          userId,
          sequences: { none: {} },
        },
      }),

      // Post counts by status
      prisma.post.groupBy({
        by: ["status"],
        where: { userId },
        _count: true,
      }),

      // Hunter usage this month
      prisma.usage.findUnique({
        where: {
          userId_month_type: {
            userId,
            month: now.toISOString().slice(0, 7),
            type: "email_search",
          },
        },
      }),
    ]);

    // ── Process follow-up steps ──
    const overdue = dueSteps
      .filter((s) => s.dueDate && new Date(s.dueDate) < today)
      .map(formatStep);
    const dueToday = dueSteps
      .filter((s) => {
        if (!s.dueDate) return false;
        const d = new Date(s.dueDate);
        return d >= today && d < new Date(today.getTime() + 24 * 60 * 60 * 1000);
      })
      .map(formatStep);
    const upcoming = dueSteps
      .filter((s) => {
        if (!s.dueDate) return false;
        const d = new Date(s.dueDate);
        return d >= new Date(today.getTime() + 24 * 60 * 60 * 1000) && d <= threeDaysFromNow;
      })
      .map(formatStep);

    // ── Pipeline blockers ──
    const prospectsWithoutEmail = allProspects.filter((p) => !p.email).length;

    // Contacted >7 days ago without reply
    const staleContacted = allProspects.filter((p) => {
      if (p.status !== "contacted") return false;
      const lastTouch = p.lastContactDate || p.updatedAt;
      return lastTouch && new Date(lastTouch) < sevenDaysAgo;
    });

    // ── Post stats ──
    const posts = {
      total: 0,
      draft: 0,
      ready: 0,
      published: 0,
    };
    for (const group of postStats) {
      const count = group._count;
      posts.total += count;
      if (group.status === "draft") posts.draft = count;
      if (group.status === "ready") posts.ready = count;
      if (group.status === "published") posts.published = count;
    }

    // ── Hunter credits ──
    const isOwner =
      userEmail === process.env.OWNER_EMAIL ||
      userId === process.env.OWNER_USER_ID;
    const hunterLimit = isOwner ? OWNER_LIMIT : FREE_LIMIT;
    const hunterUsed = hunterUsage?.count || 0;
    const hunterRemaining = Math.max(0, hunterLimit - hunterUsed);

    // ── Prospect totals ──
    const prospectTotal = allProspects.length;

    return ApiResponse.success({
      urgencies: {
        overdue,
        today: dueToday,
        upcoming,
        totalDue: overdue.length + dueToday.length + upcoming.length,
      },
      pipeline: {
        withoutEmail: prospectsWithoutEmail,
        withoutSequence: prospectsWithoutSequence,
        staleContacted: staleContacted.map((p) => ({
          id: p.id,
          name: p.name,
          company: p.company,
          lastContactDate: p.lastContactDate,
        })),
        staleContactedCount: staleContacted.length,
      },
      posts,
      prospects: {
        total: prospectTotal,
      },
      hunter: {
        used: hunterUsed,
        remaining: hunterRemaining,
        limit: hunterLimit,
      },
    });
  } catch (error) {
    console.error("[Dashboard] Error:", error);
    return ApiResponse.error("Failed to load dashboard");
  }
}

function formatStep(step: {
  id: string;
  order: number;
  actionType: string;
  content: string | null;
  status: string;
  dueDate: Date | null;
  sequence: {
    id: string;
    name: string;
    prospect: {
      id: string;
      name: string;
      company: string | null;
      email: string | null;
      status: string;
    };
  };
}) {
  return {
    id: step.id,
    order: step.order,
    actionType: step.actionType,
    dueDate: step.dueDate,
    sequenceId: step.sequence.id,
    sequenceName: step.sequence.name,
    prospect: step.sequence.prospect,
  };
}
