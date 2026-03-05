import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminSession } from "@/lib/admin";
import { ApiResponse } from "@/lib/api-utils";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return ApiResponse.unauthorized();
  }

  return ApiResponse.success({
    isAdmin: isAdminSession(session),
  });
}
