// Production start for the `output: "standalone"` build (`next start` does not support standalone output).
// Listens on all interfaces: some hosts set HOSTNAME to the machine name, which the standalone server would
// otherwise bind to. PORT comes from the host (Render sets it); the standalone server defaults to 3000.
const fs = require("fs");
const path = require("path");

const server = path.join(__dirname, "..", ".next", "standalone", "server.js");
if (!fs.existsSync(server)) {
  console.error("[start] .next/standalone/server.js not found. Run `npm run build` first.");
  process.exit(1);
}
process.env.HOSTNAME = "0.0.0.0";
require(server);
