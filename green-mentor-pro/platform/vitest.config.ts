import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Unit tests for the deterministic Energy core (pure calc + zod schemas +
// factor resolution). Node environment — these exercise logic, not the DOM.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
    // node:test suites (sasb/sustainalytics/esg-readiness) live in __tests__/
    // and run via their own tsx scripts — they are not vitest files.
    exclude: ["**/__tests__/**", "**/node_modules/**"],
  },
});
