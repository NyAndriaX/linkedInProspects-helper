import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

/**
 * API response helpers
 */
export const ApiResponse = {
  success: <T>(data: T, status = 200) => NextResponse.json(data, { status }),

  created: <T>(data: T) => NextResponse.json(data, { status: 201 }),

  error: (message: string, status = 500) =>
    NextResponse.json({ error: message }, { status }),

  unauthorized: (message = "Unauthorized") =>
    NextResponse.json({ error: message }, { status: 401 }),

  notFound: (message = "Not found") =>
    NextResponse.json({ error: message }, { status: 404 }),

  badRequest: (message: string) =>
    NextResponse.json({ error: message }, { status: 400 }),

  forbidden: (message = "Access denied") =>
    NextResponse.json({ error: message }, { status: 403 }),
};

/**
 * Get authenticated session with user ID
 * Returns null if not authenticated
 */
export async function getAuthenticatedSession() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return null;
  }

  return session;
}

/**
 * Validate required fields in request body
 */
export function validateRequired<T extends Record<string, unknown>>(
  body: T,
  requiredFields: (keyof T)[]
): string | null {
  const missingFields = requiredFields.filter(
    (field) => body[field] === undefined || body[field] === null || body[field] === ""
  );

  if (missingFields.length > 0) {
    return `Missing required fields: ${missingFields.join(", ")}`;
  }

  return null;
}
