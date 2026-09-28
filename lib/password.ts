import { createHash, pbkdf2Sync, timingSafeEqual } from "node:crypto";
import { authUsername, constantTimeEqual } from "@/lib/auth";

const HASH_PREFIX = "pbkdf2_sha256";

function usernameMatches(received: string) {
  const expectedDigest = createHash("sha256").update(authUsername()).digest("hex");
  const receivedDigest = createHash("sha256").update(received).digest("hex");
  return constantTimeEqual(receivedDigest, expectedDigest);
}

export function verifyCredentials(username: string, password: string) {
  const stored = process.env.AUTH_PASSWORD_HASH?.trim() ?? "";
  const [prefix, iterationsText, salt, expectedText, extra] = stored.split("$");
  const iterations = Number(iterationsText);
  if (
    prefix !== HASH_PREFIX ||
    extra ||
    !Number.isSafeInteger(iterations) ||
    iterations < 210_000 ||
    !salt ||
    !expectedText
  ) {
    return false;
  }

  try {
    const expected = Buffer.from(expectedText, "base64url");
    const received = pbkdf2Sync(password, salt, iterations, expected.length, "sha256");
    return usernameMatches(username) && timingSafeEqual(received, expected);
  } catch {
    return false;
  }
}
