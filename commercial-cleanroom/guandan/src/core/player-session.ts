import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const TOKEN_VERSION = 1;
const TOKEN_LIFETIME_MS = 12 * 60 * 60 * 1000;
const MINIMUM_SECRET_BYTES = 32;
let developmentSecret: Buffer | undefined;

interface PlayerSessionClaims {
  readonly version: 1;
  readonly roomId: string;
  readonly playerId: string;
  readonly name: string;
  readonly role: "player" | "observer";
  readonly expiresAt: number;
  readonly nonce: string;
}

const productionRuntime = (): boolean =>
  process.env.NODE_ENV === "production" || process.env.RENDER === "true";

const sessionSecret = (): Buffer => {
  const configured = process.env.WS_SESSION_SECRET;
  if (configured !== undefined && configured.length > 0) {
    const secret = Buffer.from(configured, "utf8");
    if (secret.length < MINIMUM_SECRET_BYTES) {
      throw new Error("WS_SESSION_SECRET must contain at least 32 bytes");
    }
    return secret;
  }
  if (productionRuntime()) {
    throw new Error("WS_SESSION_SECRET is required in production");
  }
  developmentSecret ??= randomBytes(MINIMUM_SECRET_BYTES);
  return developmentSecret;
};

export const assertPlayerSessionConfiguration = (): void => {
  sessionSecret();
};

const encode = (value: string): string =>
  Buffer.from(value, "utf8").toString("base64url");

const signature = (payload: string): Buffer =>
  createHmac("sha256", sessionSecret()).update(payload).digest();

export const issuePlayerSessionToken = (
  claims: Pick<PlayerSessionClaims, "roomId" | "playerId" | "name" | "role">,
  now = Date.now(),
): string => {
  const payload = encode(
    JSON.stringify({
      version: TOKEN_VERSION,
      roomId: claims.roomId,
      playerId: claims.playerId,
      name: claims.name,
      role: claims.role,
      expiresAt: now + TOKEN_LIFETIME_MS,
      nonce: randomBytes(16).toString("base64url"),
    } satisfies PlayerSessionClaims),
  );
  return `${payload}.${signature(payload).toString("base64url")}`;
};

export const verifyPlayerSessionToken = (
  token: string,
  expected: Pick<PlayerSessionClaims, "roomId" | "name">,
  now = Date.now(),
): PlayerSessionClaims | null => {
  if (token.length > 2048) return null;
  const [payload, encodedSignature, extra] = token.split(".");
  if (!payload || !encodedSignature || extra !== undefined) return null;

  let providedSignature: Buffer;
  try {
    providedSignature = Buffer.from(encodedSignature, "base64url");
  } catch {
    return null;
  }
  const expectedSignature = signature(payload);
  if (
    providedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(providedSignature, expectedSignature)
  ) {
    return null;
  }

  try {
    const claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Partial<PlayerSessionClaims>;
    if (
      claims.version !== TOKEN_VERSION ||
      claims.roomId !== expected.roomId ||
      claims.name !== expected.name ||
      typeof claims.playerId !== "string" ||
      claims.playerId.length === 0 ||
      (claims.role !== "player" && claims.role !== "observer") ||
      typeof claims.expiresAt !== "number" ||
      !Number.isSafeInteger(claims.expiresAt) ||
      claims.expiresAt <= now ||
      typeof claims.nonce !== "string" ||
      claims.nonce.length === 0
    ) {
      return null;
    }
    return claims as PlayerSessionClaims;
  } catch {
    return null;
  }
};
