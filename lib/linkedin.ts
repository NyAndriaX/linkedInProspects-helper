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
    "LinkedIn-Version": "202501",
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
 * Response type for socialActions likes API
 * Using /v2/socialActions/{shareURN}/likes endpoint with w_member_social permission
 */
interface LikesResponse {
  elements?: unknown[];
  paging?: {
    count: number;
    start: number;
    total?: number;
  };
}

/**
 * Get the number of likes for a LinkedIn post
 * Uses /v2/socialActions/{shareURN}/likes endpoint (requires w_member_social)
 * @param accessToken - LinkedIn access token
 * @param entityUrn - The URN of the post (e.g., "urn:li:share:123456789")
 * @returns The number of likes or 0 if error
 */
export async function getPostReactions(accessToken: string, entityUrn: string): Promise<number> {
  try {
    console.log(`[LinkedIn] Fetching likes for URN: ${entityUrn}`);
    
    // URL encode the URN for the path
    const encodedUrn = encodeURIComponent(entityUrn);
    
    // Use v2 API client for socialActions
    const response = await linkedInClient.get<LikesResponse>(
      `/socialActions/${encodedUrn}/likes`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    // The total is in paging.total or we count elements
    const count = response.data.paging?.total ?? response.data.elements?.length ?? 0;
    console.log(`[LinkedIn] Likes count: ${count}`);
    return count;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`[LinkedIn] API Error fetching likes for ${entityUrn}:`);
      console.error(`[LinkedIn] Status: ${error.response?.status}`);
      console.error(`[LinkedIn] Response: ${JSON.stringify(error.response?.data)}`);
    } else {
      console.error(`[LinkedIn] Error fetching likes for ${entityUrn}:`, error);
    }
    return 0;
  }
}

/**
 * Get reactions count for a LinkedIn post (alias for getPostReactions)
 * @param accessToken - LinkedIn access token
 * @param entityUrn - The URN of the post
 * @returns The number of reactions
 */
export async function getPostStats(
  accessToken: string,
  entityUrn: string
): Promise<number> {
  return getPostReactions(accessToken, entityUrn);
}
