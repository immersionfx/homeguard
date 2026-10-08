import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["services/**/*.test.ts", "adapters/**/*.test.ts", "packages/**/*.test.ts", "apps/**/*.test.ts"],
  },
});
