// Runs after `next build`. With `output: "standalone"`, Next.js does not copy `public/` or `.next/static/` into
// `.next/standalone/`, so the standalone server would serve pages without CSS/JS, images or the background music.
// The Dockerfile copies them itself; this does the same for Render's Node runtime and local `npm start`.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const standalone = path.join(root, ".next", "standalone");
if (!fs.existsSync(path.join(standalone, "server.js"))) {
  console.error("[standalone-assets] .next/standalone/server.js not found. Is output: \"standalone\" set in next.config.js?");
  process.exit(1);
}
for (const [from, to] of [["public", "public"], [".next/static", ".next/static"]]) {
  const src = path.join(root, from);
  if (!fs.existsSync(src)) continue;
  fs.cpSync(src, path.join(standalone, to), { recursive: true });
  console.log(`[standalone-assets] copied ${from} -> .next/standalone/${to}`);
}
