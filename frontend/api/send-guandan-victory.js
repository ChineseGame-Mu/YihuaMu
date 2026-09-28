const { createHash } = require("node:crypto");

function getAllowedOrigins() {
  const origins = new Set([
    "https://yihuagames.com",
    "https://yihua-mu-chinese-game.vercel.app",
    "https://yihua-mu.vercel.app",
  ]);
  const deploymentHost = process.env.VERCEL_URL;
  if (deploymentHost) origins.add(`https://${deploymentHost}`);

  for (const origin of (process.env.SCREENSHOT_ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)) {
    origins.add(origin);
  }

  return origins;
}
const maxImageCharacters = 8 * 1024 * 1024;
const sendWindowMs = 10 * 60 * 1000;
const sendsByIp = new Map();

function sendJson(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "仅支持 POST 请求。" });
  }

  if (!getAllowedOrigins().has(req.headers.origin)) {
    return sendJson(res, 403, { error: "请求来源未获准。" });
  }

  const now = Date.now();
  if (sendsByIp.size > 10000) {
    for (const [ip, timestamps] of sendsByIp.entries()) {
      const recent = timestamps.filter(
        (timestamp) => now - timestamp < sendWindowMs,
      );
      if (recent.length === 0) sendsByIp.delete(ip);
      else sendsByIp.set(ip, recent);
    }
  }
  const forwardedFor = req.headers["x-forwarded-for"];
  const clientIp =
    typeof forwardedFor === "string"
      ? forwardedFor.split(",")[0].trim()
      : "unknown";
  const recentSends = (sendsByIp.get(clientIp) || []).filter(
    (timestamp) => now - timestamp < sendWindowMs,
  );
  if (recentSends.length >= 20) {
    return sendJson(res, 429, { error: "发送次数过多，请稍后再试。" });
  }

  const body = req.body;
  const recipient = typeof body?.to === "string" ? body.to.trim() : "";
  const screenshot =
    typeof body?.screenshot === "string" ? body.screenshot : "";
  const room = typeof body?.room === "string" ? body.room : "";
  const matchId = Number(body?.matchId);
  const winnerTeam = body?.winnerTeam;
  if (
    recipient.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient) ||
    screenshot.length === 0 ||
    screenshot.length > maxImageCharacters ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(screenshot) ||
    !/^\d{4}$/.test(room) ||
    !Number.isSafeInteger(matchId) ||
    matchId < 1 ||
    (winnerTeam !== "A" && winnerTeam !== "B")
  ) {
    return sendJson(res, 400, { error: "邮箱地址或截图数据无效。" });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const sender = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !sender) {
    return sendJson(res, 503, {
      error: "邮件服务尚未配置，截图没有发送。",
    });
  }

  const idempotencyKey = createHash("sha256")
    .update(`${room}:${matchId}:${winnerTeam}:${recipient}`)
    .digest("hex");

  let providerResponse;
  try {
    providerResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        from: sender,
        to: [recipient],
        subject: "掼蛋 A级胜利截图",
        html: "<p>恭喜打A成功！本局胜利结果截图见附件。</p>",
        attachments: [
          {
            filename: "guandan-ace-victory.png",
            content: screenshot,
            content_type: "image/png",
          },
        ],
      }),
    });
  } catch (error) {
    console.error("Victory screenshot email provider request failed", error);
    return sendJson(res, 502, { error: "邮件服务连接失败，请稍后重试。" });
  }

  if (!providerResponse.ok) {
    console.error(
      "Victory screenshot email provider rejected the request",
      providerResponse.status,
    );
    return sendJson(res, 502, { error: "邮件服务未能发送截图，请稍后重试。" });
  }

  sendsByIp.set(clientIp, [...recentSends, now]);
  const result = await providerResponse.json();
  return sendJson(res, 200, { ok: true, id: result.id });
};
