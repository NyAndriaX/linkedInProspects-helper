import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiResponse, getAuthenticatedSession } from "@/lib/api-utils";

// Profile fields to select from database
const PROFILE_SELECT = {
  id: true,
  name: true,
  email: true,
  image: true,
  linkedInId: true,
  jobTitle: true,
  company: true,
  industry: true,
  yearsOfExperience: true,
  targetAudience: true,
  targetIndustries: true,
  contentGoals: true,
  preferredTone: true,
  preferredLanguage: true,
  contentTopics: true,
  uniqueValue: true,
  expertise: true,
  personalBrand: true,
  postingFrequency: true,
  preferredPostTypes: true,
} as const;

// GET /api/profile - Get the authenticated user's profile
export async function GET() {
  try {
    const session = await getAuthenticatedSession();
    if (!session) return ApiResponse.unauthorized();

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: PROFILE_SELECT,
    });

    if (!user) return ApiResponse.notFound("User not found");

    return ApiResponse.success(user);
  } catch (error) {
    console.error("Error fetching profile:", error);
    return ApiResponse.error("Failed to fetch profile");
  }
}

// PUT /api/profile - Update the authenticated user's profile
export async function PUT(request: NextRequest) {
  try {
    const session = await getAuthenticatedSession();
    if (!session) return ApiResponse.unauthorized();

    const body = await request.json();

    // Build update data only with provided fields
    const updateData = buildUpdateData(body);

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: PROFILE_SELECT,
    });

    return ApiResponse.success(user);
  } catch (error) {
    console.error("Error updating profile:", error);
    return ApiResponse.error("Failed to update profile");
  }
}

/**
 * Build update data object from request body
 * Only includes fields that are explicitly provided
 */
function buildUpdateData(body: Record<string, unknown>) {
  const profileFields = [
    "jobTitle",
    "company",
    "industry",
    "yearsOfExperience",
    "targetAudience",
    "targetIndustries",
    "contentGoals",
    "preferredTone",
    "preferredLanguage",
    "contentTopics",
    "uniqueValue",
    "expertise",
    "personalBrand",
    "postingFrequency",
    "preferredPostTypes",
  ];

  return profileFields.reduce<Record<string, unknown>>((data, field) => {
    if (body[field] !== undefined) {
      data[field] = body[field];
    }
    return data;
  }, {});
}
