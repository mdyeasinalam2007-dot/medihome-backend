// Checks your setup WITHOUT printing any secret values. Run: npm run doctor
const fs = require("fs"), path = require("path");
let bad = 0; const ok = (m) => console.log("  OK  " + m), warn = (m) => console.log("  !!  " + m), err = (m) => { bad++; console.log("  XX  " + m); };
const major = +process.versions.node.split(".")[0];
console.log("MediHome setup check");
major >= 18 && major <= 22 ? ok("Node.js v" + process.versions.node) : major < 18 ? err("Node.js v" + process.versions.node + " is too old. Install Node 20 LTS from nodejs.org") : warn("Node.js v" + process.versions.node + " is newer than tested. If install/build fails, install Node 20 or 22 LTS");

const f = path.join(__dirname, "..", ".env"), env = {};
if (!fs.existsSync(f)) { err(".env not found. Run:  Copy-Item .env.example .env   then edit it"); process.exit(1); }
fs.readFileSync(f, "utf8").split(/\r?\n/).forEach((l) => { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m) env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2"); });
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

const mode = (env.PAYMENT_MODE || "auto").toLowerCase(), bk = ["BKASH_APP_KEY", "BKASH_APP_SECRET", "BKASH_USERNAME", "BKASH_PASSWORD"].every(has);
if (mode === "manual" || (mode === "auto" && !bk)) has("MEDIHOME_PAYMENT_DESTINATION") ? ok("Payments: bKash Send Money to your number (number not printed here)") : mode === "manual" ? err("PAYMENT_MODE=manual but MEDIHOME_PAYMENT_DESTINATION is empty") : warn("Payments: TEST MODE (simulated). Set MEDIHOME_PAYMENT_DESTINATION for real Send Money payments");
else ok("Payments: official bKash checkout (" + (env.BKASH_BASE_URL || "") + ")");
(env.OWNER_KEY || "").length >= 16 ? ok("OWNER_KEY set (payment verification page /owner/payments)") : warn("OWNER_KEY missing or shorter than 16 characters: you cannot approve manual payments until you set it");
const ap = (env.AI_PROVIDER || "auto").toLowerCase();
if (has("OLLAMA_MODEL") && ap !== "gemini") ok("AI: local Ollama model " + env.OLLAMA_MODEL + " (free, stays on your computer)");
else if (has("GEMINI_API_KEY") && ap !== "ollama") ok("AI: Gemini cloud key set (messages/images are sent to Google)");
else warn("AI model not configured: chat will say demo mode (emergency guidance and doctor search still work)");
has("RESEND_API_KEY") ? ok("Email (forgot password): Resend configured") : warn("Email not configured: on localhost the password-reset link is printed in the npm run dev terminal");
has("SEARXNG_URL") ? ok("Web search: SearXNG configured") : warn("Web search not configured (optional)");

console.log(bad ? "\n" + bad + " problem(s) above must be fixed." : "\nAll required settings look fine.");
process.exit(bad ? 1 : 0);
