import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("production browser security headers", () => {
  const configuration = JSON.parse(
    readFileSync(resolve(process.cwd(), "vercel.json"), "utf8"),
  ) as {
    headers?: { headers?: { key?: string; value?: string }[] }[];
  };
  const headers = new Map(
    configuration.headers?.[0]?.headers?.map(({ key, value }) => [key, value]),
  );

  it("prevents framing, MIME sniffing, and sensitive browser capabilities", () => {
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Permissions-Policy")).toContain("camera=()");
    expect(headers.get("Permissions-Policy")).toContain("microphone=()");
  });

  it("restricts content while preserving the production game websocket", () => {
    const policy = headers.get("Content-Security-Policy") ?? "";
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("wss://card-games-yihua.onrender.com");
    expect(policy).toContain("upgrade-insecure-requests");
  });
});
