/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  output: "standalone",
  experimental: {
    outputFileTracingIncludes: {
      "/**": ["./node_modules/.prisma/client/**/*"],
    },
  },
};

