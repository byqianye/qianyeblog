import { pbkdf2Sync, randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const envFile = join(root, ".env");
const legacyFile = join(root, "server", "admin.json");

function toEnv(admin) {
  return `ADMIN_USERNAME=${admin.username}\nADMIN_PASSWORD_HASH=${admin.salt}:${admin.iterations}:${admin.digest}:${admin.hash}\n`;
}

function createAdmin(username, password) {
  const salt = randomBytes(16).toString("hex");
  const iterations = 310000;
  const digest = "sha512";
  const hash = pbkdf2Sync(password, salt, iterations, 64, digest).toString("hex");
  return { username, salt, iterations, digest, hash };
}

if (existsSync(envFile)) throw new Error(".env already exists. Refusing to overwrite local credentials.");

if (process.argv.includes("--migrate")) {
  if (!existsSync(legacyFile)) throw new Error("No legacy admin state was found.");
  const legacy = JSON.parse(await readFile(legacyFile, "utf8"));
  if (!legacy.username || !legacy.salt || !legacy.iterations || !legacy.digest || !legacy.hash) throw new Error("Legacy admin state is invalid.");
  await writeFile(envFile, toEnv(legacy), { encoding: "utf8", mode: 0o600 });
  console.log("Created local .env from the legacy credential hash. Remove server/admin.json after confirming login.");
} else {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password || password.length < 12) {
    throw new Error("Set ADMIN_USERNAME and an ADMIN_PASSWORD of at least 12 characters before running this command.");
  }
  await writeFile(envFile, toEnv(createAdmin(username, password)), { encoding: "utf8", mode: 0o600 });
  console.log("Created local .env with a derived password hash.");
}
