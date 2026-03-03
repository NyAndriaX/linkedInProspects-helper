import axios, { AxiosError } from "axios";
import https from "https";

// HTTPS agent that forces IPv4 to avoid connection issues
const httpsAgent = new https.Agent({
  family: 4,
  rejectUnauthorized: true,
  keepAlive: false,
});

const LINKEDIN_API_BASE = "https://api.linkedin.com/rest";
const LINKEDIN_VERSION = "202504";
const REQUEST_TIMEOUT = 30000; // 30 seconds

/**
 * LinkedIn API client for the new REST Posts API
 * Replaces the deprecated /v2/ugcPosts API
 */
export const linkedInClient = axios.create({
  baseURL: LINKEDIN_API_BASE,
  timeout: REQUEST_TIMEOUT,
  httpsAgent,
  headers: {
    "Content-Type": "application/json",
    "X-Restli-Protocol-Version": "2.0.0",
    "LinkedIn-Version": LINKEDIN_VERSION,
  },
});

/**
 * Build the post body for LinkedIn REST Posts API (text only)
 */
export function buildPostBody(linkedInId: string, content: string) {
  return {
    author: `urn:li:person:${linkedInId}`,
    commentary: content,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };
}

/**
 * Build the post body with an image for LinkedIn REST Posts API
 * Uses the new content.media.id format with an image URN from the Images API
 */
export function buildPostBodyWithImage(
  linkedInId: string,
  content: string,
  imageUrn: string
) {
  return {
    author: `urn:li:person:${linkedInId}`,
    commentary: content,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    content: {
      media: {
        id: imageUrn,
      },
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };
}

/**
 * Initialize an image upload with LinkedIn Images API
 * Returns the upload URL and the image URN (urn:li:image:{id})
 */
export async function registerImageUpload(
  linkedInId: string,
  accessToken: string
): Promise<{ uploadUrl: string; imageUrn: string }> {
  const body = {
    initializeUploadRequest: {
      owner: `urn:li:person:${linkedInId}`,
    },
  };

  console.log("[LinkedIn Image] Initializing image upload via Images API...");

  const response = await linkedInClient.post(
    "/images?action=initializeUpload",
    body,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const uploadUrl = response.data.value.uploadUrl;
  const imageUrn = response.data.value.image;

  console.log(`[LinkedIn Image] Upload initialized. Image URN: ${imageUrn}`);

  return { uploadUrl, imageUrn };
}

/**
 * Download an image from a URL and upload it to LinkedIn
 */
export async function uploadImageToLinkedIn(
  imageUrl: string,
  uploadUrl: string,
  accessToken: string
): Promise<void> {
  console.log(`[LinkedIn Image] Downloading image from: ${imageUrl}`);

  // Download the image as a buffer
  const imageResponse = await axios.get(imageUrl, {
    responseType: "arraybuffer",
    timeout: REQUEST_TIMEOUT,
    httpsAgent,
  });

  const imageBuffer = Buffer.from(imageResponse.data);
  const contentType = imageResponse.headers["content-type"] || "image/jpeg";

  console.log(
    `[LinkedIn Image] Uploading ${imageBuffer.length} bytes to LinkedIn...`
  );

  // Upload binary to LinkedIn's upload URL
  await axios.put(uploadUrl, imageBuffer, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": contentType,
    },
    timeout: 60000, // 60s for large images
    httpsAgent,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  console.log("[LinkedIn Image] Image uploaded successfully");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait until LinkedIn marks the uploaded image as AVAILABLE.
 * This avoids publishing posts before media processing is complete.
 */
async function waitForImageAvailability(
  imageUrn: string,
  accessToken: string
): Promise<boolean> {
  const encodedUrn = encodeURIComponent(imageUrn);
  const maxAttempts = 8;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await linkedInClient.get(`/images/${encodedUrn}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const status = String(
        response.data?.status || response.data?.value?.status || ""
      ).toUpperCase();

      if (status === "AVAILABLE") {
        console.log(`[LinkedIn Image] Image is AVAILABLE: ${imageUrn}`);
        return true;
      }

      if (status === "PROCESSING" || status === "WAITING_UPLOAD" || !status) {
        console.log(
          `[LinkedIn Image] Image status ${status || "UNKNOWN"} (attempt ${attempt}/${maxAttempts})`
        );
      } else {
        console.warn(
          `[LinkedIn Image] Unexpected image status: ${status} for ${imageUrn}`
        );
      }
    } catch (error) {
      console.warn(
        `[LinkedIn Image] Failed to fetch image status (attempt ${attempt}/${maxAttempts})`,
        error
      );
    }

    await delay(1500);
  }

  console.warn(
    `[LinkedIn Image] Image did not become AVAILABLE in time: ${imageUrn}`
  );
  return false;
}

/**
 * Full flow: initialize upload, download image, upload to LinkedIn, return image URN
 * Returns null if the image upload fails (post can still be published without image)
 */
export async function prepareLinkedInImage(
  imageUrl: string,
  linkedInId: string,
  accessToken: string
): Promise<string | null> {
  try {
    const { uploadUrl, imageUrn } = await registerImageUpload(
      linkedInId,
      accessToken
    );
    await uploadImageToLinkedIn(imageUrl, uploadUrl, accessToken);
    const isAvailable = await waitForImageAvailability(imageUrn, accessToken);
    if (!isAvailable) {
      return null;
    }
    return imageUrn;
  } catch (error) {
    console.error(
      "[LinkedIn Image] Failed to prepare image, publishing without image:",
      error
    );
    return null;
  }
}

/**
 * Delete an existing LinkedIn post by URN.
 * Expected URN format: urn:li:share:{id} or urn:li:ugcPost:{id}
 */
export async function deleteLinkedInPost(
  linkedInUrn: string,
  accessToken: string
): Promise<void> {
  await linkedInClient.delete(`/posts/${encodeURIComponent(linkedInUrn)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

/**
 * Error messages for LinkedIn API errors
 */
export const ERROR_MESSAGES = {
  UNAUTHORIZED:
    "Session expired. Please sign out and sign in again.",
  FORBIDDEN:
    "Permission denied. Make sure 'Share on LinkedIn' product is enabled in your LinkedIn Developer app.",
  RATE_LIMIT: "Rate limit exceeded. Please try again later.",
  DUPLICATE_CONTENT:
    "LinkedIn rejected this post because it is too similar to a previous publication. Update the text (and/or image), then publish again.",
  TIMEOUT: "Connection timeout. Please check your internet connection.",
  DNS_ERROR: "DNS error. Unable to resolve api.linkedin.com",
  NETWORK_ERROR: "Network error. Please try again.",
  UNKNOWN: "An unexpected error occurred",
} as const;

/**
 * Handle axios errors and return appropriate error message and status
 */
export function handleLinkedInError(error: unknown): {
  message: string;
  status: number;
} {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ message?: string }>;

    // Handle response errors
    if (axiosError.response) {
      const { status, data } = axiosError.response;

      switch (status) {
        case 401:
          return { message: ERROR_MESSAGES.UNAUTHORIZED, status: 401 };
        case 403:
          return { message: ERROR_MESSAGES.FORBIDDEN, status: 403 };
        case 429:
          return { message: ERROR_MESSAGES.RATE_LIMIT, status: 429 };
        default:
          if (
            typeof data?.message === "string" &&
            data.message.toLowerCase().includes("content is a duplicate")
          ) {
            return { message: ERROR_MESSAGES.DUPLICATE_CONTENT, status: 409 };
          }
          return {
            message: data?.message || `LinkedIn API error: ${status}`,
            status,
          };
      }
    }

    // Handle network errors
    switch (axiosError.code) {
      case "ETIMEDOUT":
      case "ECONNABORTED":
        return { message: ERROR_MESSAGES.TIMEOUT, status: 503 };
      case "ENOTFOUND":
        return { message: ERROR_MESSAGES.DNS_ERROR, status: 503 };
      default:
        return {
          message: axiosError.message || ERROR_MESSAGES.NETWORK_ERROR,
          status: 503,
        };
    }
  }

  return { message: ERROR_MESSAGES.UNKNOWN, status: 500 };
}
