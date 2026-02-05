/**
 * Next.js Instrumentation - runs on server startup
 * This file is used to start background processes like the Agenda scheduler
 */

export async function register() {
  // Only run on the server (not during build or on edge runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startAgenda } = await import("./lib/agenda");
    
    try {
      await startAgenda();
      console.log("[Instrumentation] Agenda scheduler started successfully");
    } catch (error) {
      console.error("[Instrumentation] Failed to start Agenda scheduler:", error);
    }
  }
}
