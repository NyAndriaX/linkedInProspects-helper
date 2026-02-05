import axios, { AxiosError } from "axios";
import https from "https";

// HTTPS agent that forces IPv4 to avoid connection issues
const httpsAgent = new https.Agent({
  family: 4,
  rejectUnauthorized: true,
  keepAlive: false,
});

const LINKEDIN_API_BASE = "https://api.linkedin.com/v2";
const LINKEDIN_REST_API_BASE = "https://api.linkedin.com/rest";
const REQUEST_TIMEOUT = 30000; // 30 seconds

/**
 * LinkedIn API client for publishing posts (v2 API)
 */
export const linkedInClient = axios.create({
  baseURL: LINKEDIN_API_BASE,
  timeout: REQUEST_TIMEOUT,
  httpsAgent,
  headers: {
    "Content-Type": "application/json",
    "X-Restli-Protocol-Version": "2.0.0",
  },
});

/**
 * LinkedIn REST API client for social actions (likes, comments)
 */
export const linkedInRestClient = axios.create({
  baseURL: LINKEDIN_REST_API_BASE,
  timeout: REQUEST_TIMEOUT,
  httpsAgent,
  headers: {
    "Content-Type": "application/json",
    "LinkedIn-Version": "202401",
  },
});

/**
 * Build the UGC post body for LinkedIn API
 */
export function buildPostBody(linkedInId: string, content: string) {
  return {
    author: `urn:li:person:${linkedInId}`,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: content },
        shareMediaCategory: "NONE",
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  };
}

/**
 * Error messages for LinkedIn API errors
 */
export const ERROR_MESSAGES = {
  UNAUTHORIZED: "Session expired. Please sign out and sign in again.",
  FORBIDDEN: "Permission denied. Make sure 'Share on LinkedIn' product is enabled in your LinkedIn Developer app.",
  RATE_LIMIT: "Rate limit exceeded. Please try again later.",
  TIMEOUT: "Connection timeout. Please check your internet connection.",
  DNS_ERROR: "DNS error. Unable to resolve api.linkedin.com",
  NETWORK_ERROR: "Network error. Please try again.",
  UNKNOWN: "An unexpected error occurred",
} as const;

/**
 * Handle axios errors and return appropriate error message and status
 */
export function handleLinkedInError(error: unknown): { message: string; status: number } {
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

/**
 * Response type for social actions (likes/comments)
 */
interface SocialActionsResponse {
  paging?: {
    count: number;
    start: number;
    total?: number;
  };
  elements?: unknown[];
}

/**
 * Get the number of likes for a LinkedIn post
 * @param accessToken - LinkedIn access token
 * @param shareUrn - The URN of the share (e.g., "urn:li:share:123456789")
 * @returns The number of likes or 0 if error
 */
export async function getPostLikes(accessToken: string, shareUrn: string): Promise<number> {
  try {
    // URL encode the URN for the API call
    const encodedUrn = encodeURIComponent(shareUrn);
    
    const response = await linkedInRestClient.get<SocialActionsResponse>(
      `/socialActions/${encodedUrn}/likes`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          count: 0, // We only need the total count, not the actual likes
        },
      }
    );

    // The total is in paging.total or we count elements
    return response.data.paging?.total ?? response.data.elements?.length ?? 0;
  } catch (error) {
    console.error(`[LinkedIn] Error fetching likes for ${shareUrn}:`, error);
    return 0;
  }
}

/**
 * Get the number of comments for a LinkedIn post
 * @param accessToken - LinkedIn access token
 * @param shareUrn - The URN of the share (e.g., "urn:li:share:123456789")
 * @returns The number of comments or 0 if error
 */
export async function getPostComments(accessToken: string, shareUrn: string): Promise<number> {
  try {
    // URL encode the URN for the API call
    const encodedUrn = encodeURIComponent(shareUrn);
    
    const response = await linkedInRestClient.get<SocialActionsResponse>(
      `/socialActions/${encodedUrn}/comments`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          count: 0, // We only need the total count, not the actual comments
        },
      }
    );

    // The total is in paging.total or we count elements
    return response.data.paging?.total ?? response.data.elements?.length ?? 0;
  } catch (error) {
    console.error(`[LinkedIn] Error fetching comments for ${shareUrn}:`, error);
    return 0;
  }
}

/**
 * Get both likes and comments count for a LinkedIn post
 * @param accessToken - LinkedIn access token
 * @param shareUrn - The URN of the share
 * @returns Object with likes and comments counts
 */
export async function getPostStats(
  accessToken: string,
  shareUrn: string
): Promise<{ likes: number; comments: number }> {
  const [likes, comments] = await Promise.all([
    getPostLikes(accessToken, shareUrn),
    getPostComments(accessToken, shareUrn),
  ]);

  return { likes, comments };
}
