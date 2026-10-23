// Checks your setup WITHOUT printing any secret values. Run: npm run doctor
const fs = require("fs"), path = require("path");
let bad = 0; const ok = (m) => console.log("  OK  " + m), warn = (m) => console.log("  !!  " + m), err = (m) => { bad++; console.log("  XX  " + m); };
const major = +process.versions.node.split(".")[0];
console.log("MediHome setup check");
major >= 18 && major <= 22 ? ok("Node.js v" + process.versions.node) : major < 18 ? err("Node.js v" + process.versions.node + " is too old. Install Node 20 LTS from nodejs.org") : warn("Node.js v" + process.versions.node + " is newer than tested. If install/build fails, install Node 20 or 22 LTS");

// Same files Next.js reads: .env, then .env.local (which wins). Real environment variables (e.g. on Render) win over both.
const env = {}, files = [".env", ".env.local"].map((n) => path.join(__dirname, "..", n)).filter((f) => fs.existsSync(f));
if (!files.length && !process.env.DATABASE_URL) { err("No .env or .env.local found. Run:  Copy-Item .env.example .env.local   then edit it"); process.exit(1); }
console.log("  ..  reading: " + (files.map((f) => path.basename(f)).join(", ") || "environment variables only"));
for (const f of files) fs.readFileSync(f, "utf8").split(/\r?\n/).forEach((l) => { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m) env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2"); });
for (const k of Object.keys(process.env)) if (/^[A-Z0-9_]+$/.test(k) && process.env[k]) env[k] = process.env[k];
const has = (k) => !!env[k];

const db = env.DATABASE_URL || "";
if (!db) err("DATABASE_URL is empty");
else if (/^file:/i.test(db)) err("DATABASE_URL starts with file: (SQLite). This project uses PostgreSQL. Use a postgresql://... URL (free at neon.tech)");
else if (!/^postgres(ql)?:\/\//i.test(db)) err("DATABASE_URL must start with postgresql://");
else if (/USER:PASSWORD@HOST/.test(db)) err("DATABASE_URL still has the placeholder text");
else ok("DATABASE_URL looks like PostgreSQL");

(env.NEXTAUTH_SECRET || "").length >= 16 ? ok("NEXTAUTH_SECRET set") : err("NEXTAUTH_SECRET is empty or too short (use 32+ random characters)");
/^https?:\/\//.test(env.NEXTAUTH_URL || "") ? ok("NEXTAUTH_URL = " + env.NEXTAUTH_URL) : err("NEXTAUTH_URL must be like http://localhost:3000");

const pair = (a, b, name, uri) => { if (has(a) && has(b)) ok(name + " login configured (redirect URI: " + (env.NEXTAUTH_URL || "") + uri + ")"); else if (has(a) || has(b)) err(name + ": set BOTH client id and secret"); else warn(name + " login not configured (button will be hidden)"); };
pair("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "Google", "/api/auth/callback/google");
pair("FACEBOOK_CLIENT_ID", "FACEBOOK_CLIENT_SECRET", "Facebook", "/api/auth/callback/facebook");

ok("Payments: DEMO MODE only (no real payments are collected; bKash settings are ignored)");
(env.OWNER_KEY || "").length >= 16 ? ok("OWNER_KEY set (hospital approval page /owner)") : err("OWNER_KEY missing or shorter than 16 characters: new hospitals cannot be approved until you set it");
const ap = (env.AI_PROVIDER || "auto").toLowerCase();
if (has("OLLAMA_MODEL") && ap !== "gemini") ok("AI: local Ollama model " + env.OLLAMA_MODEL + " (free, stays on your computer)");
else if (has("GEMINI_API_KEY") && ap !== "ollama") ok("AI: Gemini cloud key set (messages/images are sent to Google)");
else warn("AI model not configured: chat will say demo mode (emergency guidance and doctor search still work)");
has("RESEND_API_KEY") ? ok("Email (forgot password): Resend configured") : warn("Email not configured: on localhost the password-reset link is printed in the npm run dev terminal");
has("SEARXNG_URL") ? ok("Web search: SearXNG configured") : warn("Web search not configured (optional)");

console.log(bad ? "\n" + bad + " problem(s) above must be fixed." : "\nAll required settings look fine.");
process.exit(bad ? 1 : 0);
