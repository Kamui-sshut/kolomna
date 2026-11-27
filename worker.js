/* Cloudflare Worker: server-side Turnstile validation + KV cooldown.
   Required bindings/secrets: TURNSTILE_SECRET, RATE_LIMIT (KV), ALLOWED_ORIGIN. */
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = env.ALLOWED_ORIGIN || "";
    const corsOrigin = allowed && origin === allowed ? origin : "null";
    const headers = {
      "Access-Control-Allow-Origin": corsOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST") return new Response(JSON.stringify({ success: false }), { status: 405, headers });
    if (!allowed || origin !== allowed) return new Response(JSON.stringify({ success: false, error: "origin_denied" }), { status: 403, headers });
    if (!env.TURNSTILE_SECRET || !env.RATE_LIMIT) return new Response(JSON.stringify({ success: false, error: "worker_not_configured" }), { status: 503, headers });

    let body;
    try { body = await request.json(); } catch { return new Response(JSON.stringify({ success: false }), { status: 400, headers }); }
    if (typeof body.website === "string" && body.website.trim()) return new Response(JSON.stringify({ success: false }), { status: 400, headers });
    if (typeof body.token !== "string" || body.token.length < 10 || body.token.length > 4096) return new Response(JSON.stringify({ success: false, error: "missing_token" }), { status: 400, headers });

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const bucket = `turnstile:${ip}`;
    const count = Number(await env.RATE_LIMIT.get(bucket) || "0");
    if (count >= 12) return new Response(JSON.stringify({ success: false, error: "rate_limited" }), { status: 429, headers });
    await env.RATE_LIMIT.put(bucket, String(count + 1), { expirationTtl: 600 });

    const form = new FormData();
    form.append("secret", env.TURNSTILE_SECRET);
    form.append("response", body.token);
    form.append("remoteip", ip);
    const verify = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
    const result = await verify.json();
    if (!result.success || (result.hostname && new URL(allowed).hostname !== result.hostname)) {
      return new Response(JSON.stringify({ success: false, error: "challenge_failed" }), { status: 400, headers });
    }
    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  }
};
