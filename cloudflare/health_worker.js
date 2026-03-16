/**
 * CLISONIX CLOUD — Cloudflare Edge Health Worker
 * ================================================
 * Runs as a Cloudflare Worker scheduled cron (every 5 minutes) from
 * multiple global Points of Presence.  Reports real HTTP status and
 * latency for all 6 SLO-tracked Clisonix services.
 *
 * No mocks. No fake data. All probes hit the real Hetzner server.
 *
 * Deployment:
 *   wrangler deploy
 *
 * Required bindings (wrangler.toml → bindings):
 *   SLACK_WEBHOOK_URL   — Slack incoming-webhook for #critical-alerts
 *   HETZNER_IP          — Real server IP (default: 46.225.14.83)
 *
 * The Worker also exposes GET / for on-demand status from any CF PoP.
 *
 * @see wrangler.toml for configuration
 */

const SERVICES = [
  { name: "ocean-core",  port: 8030, path: "/health" },
  { name: "backend-api", port: 8000, path: "/health" },
  { name: "openmind",    port: 9999, path: "/health" },
  { name: "excel-core",  port: 8002, path: "/health" },
  { name: "ollama",      port: 11434, path: "/api/tags" },
  { name: "translation", port: 8036, path: "/health" },
];

/** Probe a single service and return real latency + status. */
async function probeService(ip, svc, timeoutMs = 8000) {
  const url = `http://${ip}:${svc.port}${svc.path}`;
  const start = Date.now();
  let httpCode = 0;
  let body = "";
  let error = null;

  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    httpCode = resp.status;
    body = await resp.text().catch(() => "");
  } catch (err) {
    error = err.message || String(err);
  }

  const latencyMs = Date.now() - start;
  const ok = httpCode >= 200 && httpCode < 300;

  return { name: svc.name, url, ok, httpCode, latencyMs, error, body };
}

/** Post a Slack message when a service is down. */
async function notifySlack(webhookUrl, result, pop) {
  if (!webhookUrl) return;

  const emoji = result.ok ? "✅" : "🔴";
  const status = result.ok ? "UP" : `DOWN (HTTP ${result.httpCode || "timeout"})`;

  const payload = {
    text: `${emoji} Cloudflare Edge Check — ${result.name} is ${status}`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${emoji} Edge Health: ${result.name} — ${status}`,
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Service:*\n${result.name}` },
          { type: "mrkdwn", text: `*Status:*\n${status}` },
          { type: "mrkdwn", text: `*Latency:*\n${result.latencyMs}ms` },
          { type: "mrkdwn", text: `*CF PoP:*\n${pop}` },
          { type: "mrkdwn", text: `*URL:*\n${result.url}` },
          {
            type: "mrkdwn",
            text: `*Time:*\n${new Date().toISOString()}`,
          },
        ],
      },
    ],
  };

  if (result.error) {
    payload.blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*Error:*\n\`${result.error}\`` },
    });
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (_) {
    // Best-effort Slack notification — never throw
  }
}

/** Run all service probes and return structured results. */
async function runChecks(env) {
  const ip = env.HETZNER_IP || "46.225.14.83";
  const probes = await Promise.all(
    SERVICES.map((svc) => probeService(ip, svc))
  );
  return probes;
}

// ─── Scheduled cron handler ───────────────────────────────────────────────────
async function handleScheduled(event, env, ctx) {
  const pop = event?.scheduledTime
    ? new Date(event.scheduledTime).toISOString()
    : "unknown";

  const results = await runChecks(env);

  // Notify Slack only for DOWN services
  const notifyPromises = results
    .filter((r) => !r.ok)
    .map((r) => notifySlack(env.SLACK_WEBHOOK_URL, r, pop));

  await Promise.allSettled(notifyPromises);

  // Log summary to Cloudflare Workers Logs
  const summary = results.map(
    (r) =>
      `${r.ok ? "OK" : "FAIL"} ${r.name} HTTP=${r.httpCode} latency=${r.latencyMs}ms`
  );
  console.log("[EdgeHealth]", summary.join(" | "));
}

// ─── HTTP fetch handler (on-demand status page) ───────────────────────────────
async function handleFetch(request, env, ctx) {
  // Only allow GET /
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const results = await runChecks(env);
  const healthy = results.filter((r) => r.ok).length;
  const allOk = healthy === results.length;

  const body = {
    checked_at: new Date().toISOString(),
    server: env.HETZNER_IP || "46.225.14.83",
    summary: {
      healthy,
      total: results.length,
      status: allOk ? "all_healthy" : "degraded",
    },
    services: results.map(({ name, ok, httpCode, latencyMs, error }) => ({
      name,
      ok,
      http_code: httpCode,
      latency_ms: latencyMs,
      ...(error ? { error } : {}),
    })),
  };

  return new Response(JSON.stringify(body, null, 2), {
    status: allOk ? 200 : 503,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Checked-From": "cloudflare-worker",
    },
  });
}

// ─── Worker entry point ───────────────────────────────────────────────────────
export default {
  fetch: handleFetch,
  scheduled: handleScheduled,
};
