import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

const MAX_IMAGE_SIZE_MB = 5;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No image file provided" }, { status: 400 });
    }

    if (!(file.type in ALLOWED_MIME_TYPES)) {
      return NextResponse.json(
        { error: "Unsupported image format. Use JPG, PNG, WEBP, or GIF." },
        { status: 400 }
      );
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `Image is too large. Maximum size is ${MAX_IMAGE_SIZE_MB}MB.` },
        { status: 400 }
      );
    }

    const extension = ALLOWED_MIME_TYPES[file.type];
    const fileName = `${Date.now()}-${randomUUID()}.${extension}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "posts");
    const filePath = path.join(uploadDir, fileName);
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    await mkdir(uploadDir, { recursive: true });
    await writeFile(filePath, fileBuffer);

    return NextResponse.json({
      success: true,
      url: `/uploads/posts/${fileName}`,
    });
  } catch (error) {
    console.error("Image upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload image" },
      { status: 500 }
    );
  }
}
