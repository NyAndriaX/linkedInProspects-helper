const LOCAL_IMAGE_PREFIX = "/uploads/posts/";

export function isLocalPostImageUrl(imageUrl: string): boolean {
  return imageUrl.startsWith(LOCAL_IMAGE_PREFIX);
}

export function extractLocalPostImagePath(imageUrl: string): string | null {
  if (!isLocalPostImageUrl(imageUrl)) return null;
  return imageUrl.replace(/^\/uploads\//, "");
}

export function toPostImageProxyPath(imageUrl: string): string {
  const localPath = extractLocalPostImagePath(imageUrl);
  if (!localPath) return imageUrl;
  return `/api/uploads/image?path=${encodeURIComponent(localPath)}`;
}

export function toAbsolutePostImageUrl(imageUrl: string, origin: string): string {
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  return new URL(toPostImageProxyPath(imageUrl), origin).toString();
}
