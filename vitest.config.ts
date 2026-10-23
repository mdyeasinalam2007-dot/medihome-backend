import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  esbuild: { jsx: "automatic" }, // lets .test.tsx files render components with react-dom/server
  test: { environment: "node", include: ["tests/**/*.test.{ts,tsx}"] },
});
