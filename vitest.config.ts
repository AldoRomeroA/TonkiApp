import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    restoreMocks: true,
  },
  resolve: {
    alias: {
      src: path.resolve(__dirname, "src"),
    },
  },
});
