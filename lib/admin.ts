import { Session } from "next-auth";

function getConfiguredAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";

  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) {
    return false;
  }

  const adminEmails = getConfiguredAdminEmails();
  return adminEmails.includes(email.toLowerCase());
}

export function isAdminSession(session: Session | null): boolean {
  return isAdminEmail(session?.user?.email);
}
