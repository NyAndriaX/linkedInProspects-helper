import { ApiResponse, getAuthenticatedSession } from "@/lib/api-utils";

interface TimezoneOption {
  value: string;
  label: string;
}

function computeUtcOffsetLabel(timeZone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
    });
    const timeZonePart = formatter
      .formatToParts(new Date())
      .find((part) => part.type === "timeZoneName")?.value;
    if (!timeZonePart) return "UTC";
    return timeZonePart.replace("GMT", "UTC");
  } catch {
    return "UTC";
  }
}

function toReadableCityName(timeZone: string): string {
  const city = timeZone.split("/").pop() || timeZone;
  return city.replace(/_/g, " ");
}

function buildTimezoneOptions(): TimezoneOption[] {
  const supported = Intl.supportedValuesOf("timeZone");
  const prioritized = [
    "Indian/Antananarivo",
    "Europe/Paris",
    "Africa/Nairobi",
    "UTC",
    "Europe/London",
    "America/New_York",
    "America/Los_Angeles",
    "Asia/Tokyo",
    "Asia/Shanghai",
    "Australia/Sydney",
  ].filter((timeZone) => supported.includes(timeZone));

  const rest = supported.filter((timeZone) => !prioritized.includes(timeZone));
  const selected = [...prioritized, ...rest].slice(0, 250);

  return selected.map((timeZone) => ({
    value: timeZone,
    label: `${toReadableCityName(timeZone)} (${computeUtcOffsetLabel(timeZone)})`,
  }));
}

// GET /api/options/timezones
export async function GET() {
  try {
    const session = await getAuthenticatedSession();
    if (!session) return ApiResponse.unauthorized();

    return ApiResponse.success({ options: buildTimezoneOptions() });
  } catch (error) {
    console.error("Error fetching timezone options:", error);
    return ApiResponse.error("Failed to fetch timezone options");
  }
}
