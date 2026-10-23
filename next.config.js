/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== "production";

// Content Security Policy. Next.js 14 injects inline hydration scripts, so 'unsafe-inline' is required for
// scripts unless nonces are added later. Gemini/Ollama are called from the server, so the browser only talks to 'self'.
// Images allow data: (uploaded photos are stored as data URLs) and https: (existing photo links).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }, // ignored by browsers on plain http://localhost
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Microphone stays allowed for this site: the AI Consultant has voice input.
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), payment=(), usb=(), microphone=(self)" },
];

module.exports = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  // Lint runs separately with `npm run lint`, so a style warning can never block a production deploy.
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    outputFileTracingIncludes: {
      "/**": ["./node_modules/.prisma/client/**/*"],
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};
