import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
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

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

function buildSafeUploadPath(relativeImagePath: string): string | null {
  const normalizedPath = relativeImagePath.replace(/^\/+/, "");
  if (!normalizedPath.startsWith("posts/")) return null;

  const resolvedPath = path.resolve(process.cwd(), "public", "uploads", normalizedPath);
  const uploadsRoot = path.resolve(process.cwd(), "public", "uploads", "posts");

  if (!resolvedPath.startsWith(uploadsRoot)) return null;
  return resolvedPath;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const relativeImagePath = searchParams.get("path");
    if (!relativeImagePath) {
      return NextResponse.json({ error: "Missing image path" }, { status: 400 });
    }

    const imagePath = buildSafeUploadPath(relativeImagePath);
    if (!imagePath) {
      return NextResponse.json({ error: "Invalid image path" }, { status: 400 });
    }

    const imageBuffer = await readFile(imagePath);
    const extension = path.extname(imagePath).replace(".", "").toLowerCase();
    const mimeType = MIME_BY_EXTENSION[extension] || "application/octet-stream";

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }
}

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
