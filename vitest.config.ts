import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["lib/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "lib/schengen.ts",
        "lib/date.ts",
        "lib/schengen-membership.ts",
        "lib/passport.ts",
      ],
      thresholds: { lines: 95, functions: 95, branches: 90, statements: 95 },
    },
  },
});
