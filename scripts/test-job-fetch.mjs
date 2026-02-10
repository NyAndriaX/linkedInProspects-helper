/**
 * Quick test script to verify job fetchers work correctly.
 * Run: node scripts/test-job-fetch.mjs
 */

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

async function testRemotive() {
  console.log("\n🔍 === REMOTIVE ===");
  try {
    const res = await fetch("https://remotive.com/api/remote-jobs?limit=10", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();
    const jobs = data.jobs || [];
    console.log(`  Total fetched: ${jobs.length}`);
    const now = Date.now();
    const fresh = jobs.filter(
      (j) => now - new Date(j.publication_date).getTime() < TWENTY_FOUR_HOURS
    );
    console.log(`  Fresh (<24h): ${fresh.length}`);
    fresh.slice(0, 2).forEach((j) =>
      console.log(`  ✅ ${j.title} | ${j.company_name} | ${j.publication_date}`)
    );
    if (fresh.length === 0 && jobs.length > 0) {
      console.log("  ⚠️  No jobs < 24h, most recent:");
      const sorted = jobs.sort(
        (a, b) =>
          new Date(b.publication_date).getTime() -
          new Date(a.publication_date).getTime()
      );
      sorted
        .slice(0, 2)
        .forEach((j) =>
          console.log(
            `  📅 ${j.title} | ${j.company_name} | ${j.publication_date}`
          )
        );
    }
    return { source: "remotive", total: jobs.length, fresh: fresh.length };
  } catch (e) {
    console.error("  ❌ Error:", e.message);
    return { source: "remotive", total: 0, fresh: 0, error: e.message };
  }
}

async function testJobicy() {
  console.log("\n🔍 === JOBICY ===");
  try {
    const res = await fetch("https://jobicy.com/api/v2/remote-jobs?count=10", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();
    const jobs = data.jobs || [];
    console.log(`  Total fetched: ${jobs.length}`);
    const now = Date.now();
    const fresh = jobs.filter(
      (j) => now - new Date(j.pubDate).getTime() < TWENTY_FOUR_HOURS
    );
    console.log(`  Fresh (<24h): ${fresh.length}`);
    fresh.slice(0, 2).forEach((j) =>
      console.log(`  ✅ ${j.jobTitle} | ${j.companyName} | ${j.pubDate}`)
    );
    if (fresh.length === 0 && jobs.length > 0) {
      console.log("  ⚠️  No jobs < 24h, most recent:");
      const sorted = jobs.sort(
        (a, b) =>
          new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
      );
      sorted
        .slice(0, 2)
        .forEach((j) =>
          console.log(`  📅 ${j.jobTitle} | ${j.companyName} | ${j.pubDate}`)
        );
    }
    return { source: "jobicy", total: jobs.length, fresh: fresh.length };
  } catch (e) {
    console.error("  ❌ Error:", e.message);
    return { source: "jobicy", total: 0, fresh: 0, error: e.message };
  }
}

async function testArbeitnow() {
  console.log("\n🔍 === ARBEITNOW ===");
  try {
    const res = await fetch("https://www.arbeitnow.com/api/job-board-api", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();
    const jobs = (data.data || []).slice(0, 10);
    console.log(`  Total fetched: ${jobs.length}`);
    const now = Date.now();
    const fresh = jobs.filter(
      (j) => now - j.created_at * 1000 < TWENTY_FOUR_HOURS
    );
    console.log(`  Fresh (<24h): ${fresh.length}`);
    fresh.slice(0, 2).forEach((j) =>
      console.log(
        `  ✅ ${j.title} | ${j.company_name} | ${new Date(j.created_at * 1000).toISOString()}`
      )
    );
    if (fresh.length === 0 && jobs.length > 0) {
      console.log("  ⚠️  No jobs < 24h, most recent:");
      const sorted = jobs.sort((a, b) => b.created_at - a.created_at);
      sorted
        .slice(0, 2)
        .forEach((j) =>
          console.log(
            `  📅 ${j.title} | ${j.company_name} | ${new Date(j.created_at * 1000).toISOString()}`
          )
        );
    }
    return { source: "arbeitnow", total: jobs.length, fresh: fresh.length };
  } catch (e) {
    console.error("  ❌ Error:", e.message);
    return { source: "arbeitnow", total: 0, fresh: 0, error: e.message };
  }
}

async function testReddit() {
  console.log("\n🔍 === REDDIT (r/forhire) ===");
  try {
    const res = await fetch(
      "https://www.reddit.com/r/forhire/new.json?limit=10",
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; JobAlertBot/1.0)",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(15000),
      }
    );
    const data = await res.json();
    const posts = (data.data?.children || []).filter((p) => {
      const flair = (p.data.link_flair_text || "").toLowerCase();
      const title = p.data.title.toLowerCase();
      return (
        flair.includes("hiring") ||
        title.includes("[hiring]") ||
        title.includes("looking for")
      );
    });
    console.log(`  Hiring posts found: ${posts.length}`);
    const now = Date.now();
    const fresh = posts.filter(
      (p) => now - p.data.created_utc * 1000 < TWENTY_FOUR_HOURS
    );
    console.log(`  Fresh (<24h): ${fresh.length}`);
    fresh.slice(0, 2).forEach((p) =>
      console.log(
        `  ✅ ${p.data.title.slice(0, 80)} | ${new Date(p.data.created_utc * 1000).toISOString()}`
      )
    );
    if (fresh.length === 0 && posts.length > 0) {
      console.log("  ⚠️  No posts < 24h, most recent:");
      posts
        .slice(0, 2)
        .forEach((p) =>
          console.log(
            `  📅 ${p.data.title.slice(0, 80)} | ${new Date(p.data.created_utc * 1000).toISOString()}`
          )
        );
    }
    return { source: "reddit", total: posts.length, fresh: fresh.length };
  } catch (e) {
    console.error("  ❌ Error:", e.message);
    return { source: "reddit", total: 0, fresh: 0, error: e.message };
  }
}

async function testHackerNews() {
  console.log("\n🔍 === HACKER NEWS ===");
  try {
    const searchRes = await fetch(
      'https://hn.algolia.com/api/v1/search?query="Ask HN: Who is hiring"&tags=story&hitsPerPage=1',
      { signal: AbortSignal.timeout(10000) }
    );
    const searchData = await searchRes.json();
    const threadId = searchData.hits?.[0]?.objectID;
    const threadTitle = searchData.hits?.[0]?.title;
    console.log(`  Thread: ${threadTitle} (ID: ${threadId})`);

    if (!threadId) {
      console.log("  ⚠️  No thread found");
      return { source: "hackernews", total: 0, fresh: 0 };
    }

    const threadRes = await fetch(
      `https://hacker-news.firebaseio.com/v0/item/${threadId}.json`,
      { signal: AbortSignal.timeout(10000) }
    );
    const thread = await threadRes.json();
    const commentIds = (thread.kids || []).slice(0, 5);

    const comments = await Promise.all(
      commentIds.map(async (id) => {
        try {
          const r = await fetch(
            `https://hacker-news.firebaseio.com/v0/item/${id}.json`,
            { signal: AbortSignal.timeout(8000) }
          );
          return r.json();
        } catch {
          return null;
        }
      })
    );

    const valid = comments.filter((c) => c && !c.deleted && c.text);
    console.log(`  Comments sampled: ${valid.length}`);
    const now = Date.now();
    const fresh = valid.filter(
      (c) => now - c.time * 1000 < TWENTY_FOUR_HOURS
    );
    console.log(`  Fresh (<24h): ${fresh.length}`);
    valid.slice(0, 2).forEach((c) => {
      const text = c.text
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const firstLine = text.split("\n")[0] || text.slice(0, 100);
      console.log(
        `  📅 ${firstLine.slice(0, 80)} | ${new Date(c.time * 1000).toISOString()}`
      );
    });

    return { source: "hackernews", total: valid.length, fresh: fresh.length };
  } catch (e) {
    console.error("  ❌ Error:", e.message);
    return { source: "hackernews", total: 0, fresh: 0, error: e.message };
  }
}

// ─── Run all tests ─────────────────────────────────────────────────
console.log("🚀 Testing all job fetchers...");
console.log(`📅 Now: ${new Date().toISOString()}`);
console.log(`⏰ 24h cutoff: ${new Date(Date.now() - TWENTY_FOUR_HOURS).toISOString()}`);

const results = await Promise.all([
  testRemotive(),
  testJobicy(),
  testArbeitnow(),
  testReddit(),
  testHackerNews(),
]);

console.log("\n\n📊 === SUMMARY ===");
console.log("─".repeat(50));
let totalFresh = 0;
for (const r of results) {
  const status = r.error ? "❌" : r.fresh > 0 ? "✅" : "⚠️";
  console.log(
    `  ${status} ${r.source.padEnd(12)} | fetched: ${String(r.total).padStart(3)} | fresh: ${String(r.fresh).padStart(3)}${r.error ? ` | ERROR: ${r.error}` : ""}`
  );
  totalFresh += r.fresh;
}
console.log("─".repeat(50));
console.log(
  `  🎯 Total fresh jobs available: ${totalFresh} (max kept per source: 2 → max ${Math.min(totalFresh, 10)} saved)`
);
console.log(
  totalFresh > 0
    ? "\n✅ Job fetching works! Fresh offers are available."
    : "\n⚠️  No fresh jobs right now. This is normal outside business hours or on weekends."
);
