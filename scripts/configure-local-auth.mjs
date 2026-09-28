import { pbkdf2Sync, randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const password = process.env.CONSULTOR_ADMIN_PASSWORD;
const username = process.env.CONSULTOR_ADMIN_USERNAME?.trim() || "admin";

if (!password) {
  throw new Error("Defina CONSULTOR_ADMIN_PASSWORD apenas durante esta execução.");
}

const environmentPath = resolve(process.cwd(), ".env.local");
let contents = "";
try {
  contents = await readFile(environmentPath, "utf8");
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const salt = randomBytes(16).toString("base64url");
const passwordHash = pbkdf2Sync(password, salt, 310_000, 32, "sha256").toString(
  "base64url",
);
const values = {
  AUTH_USERNAME: username,
  // Next.js expande "$" em arquivos .env; a barra preserva o formato do hash.
  AUTH_PASSWORD_HASH: `pbkdf2_sha256\\$310000\\$${salt}\\$${passwordHash}`,
  AUTH_SESSION_SECRET: randomBytes(48).toString("base64url"),
};

for (const [key, value] of Object.entries(values)) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  contents = pattern.test(contents)
    ? contents.replace(pattern, line)
    : `${contents.trimEnd()}\n${line}\n`;
}

await writeFile(environmentPath, contents.trimStart(), "utf8");
console.log("Autenticação local configurada sem armazenar a senha em texto puro.");
