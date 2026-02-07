import { prisma } from "@/lib/prisma";
import { ApiResponse, getAuthenticatedSession } from "@/lib/api-utils";

// GET /api/followups/today — List all steps due today or within the next 3 days
export async function GET() {
  try {
    const session = await getAuthenticatedSession();
    if (!session) return ApiResponse.unauthorized();

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const soon = new Date(today);
    soon.setDate(today.getDate() + 3);

    // Find all pending steps due within the window for this user
    const dueSteps = await prisma.sequenceStep.findMany({
      where: {
        status: "pending",
        dueDate: {
          lte: soon,
        },
        sequence: {
          userId: session.user.id,
        },
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
                linkedinUrl: true,
                status: true,
              },
            },
          },
        },
      },
      orderBy: { dueDate: "asc" },
    });

    // Categorize steps
    const overdue = dueSteps.filter(
      (s) => s.dueDate && new Date(s.dueDate) < today
    );
    const dueToday = dueSteps.filter((s) => {
      if (!s.dueDate) return false;
      const d = new Date(s.dueDate);
      return d >= today && d < new Date(today.getTime() + 24 * 60 * 60 * 1000);
    });
    const upcoming = dueSteps.filter((s) => {
      if (!s.dueDate) return false;
      const d = new Date(s.dueDate);
      return d >= new Date(today.getTime() + 24 * 60 * 60 * 1000) && d <= soon;
    });

    // Console log reminders (Agenda job placeholder)
    if (overdue.length > 0 || dueToday.length > 0) {
      console.log("━━━ Daily Follow-Up Reminders ━━━");
      [...overdue, ...dueToday].forEach((step) => {
        console.log(
          `  Rappel : Follow-up pour ${step.sequence.prospect.name} - Action: ${step.actionType} - Due: ${step.dueDate?.toISOString().slice(0, 10)}`
        );
      });
    }

    return ApiResponse.success({
      overdue: overdue.map(formatStep),
      today: dueToday.map(formatStep),
      upcoming: upcoming.map(formatStep),
      totalDue: dueSteps.length,
    });
  } catch (error) {
    console.error("[Followups] Error fetching:", error);
    return ApiResponse.error("Failed to fetch followups");
  }
}

function formatStep(step: {
  id: string;
  order: number;
  actionType: string;
  content: string | null;
  status: string;
  dueDate: Date | null;
  notes: string | null;
  sequence: {
    id: string;
    name: string;
    prospect: {
      id: string;
      name: string;
      company: string | null;
      email: string | null;
      linkedinUrl: string | null;
      status: string;
    };
  };
}) {
  return {
    id: step.id,
    order: step.order,
    actionType: step.actionType,
    content: step.content,
    status: step.status,
    dueDate: step.dueDate,
    notes: step.notes,
    sequenceId: step.sequence.id,
    sequenceName: step.sequence.name,
    prospect: step.sequence.prospect,
  };
}
