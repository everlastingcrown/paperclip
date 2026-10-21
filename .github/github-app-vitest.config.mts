import { defineConfig } from "vitest/config";

// Fork qualification stays bounded and runs separately from the image build.
export default defineConfig({
  test: {
    include: [
      "server/src/services/github-app-client.test.ts",
      "server/src/services/github-app-credentials.test.ts",
      "packages/shared/src/app-definitions.test.ts",
    ],
    maxWorkers: 1,
    pool: "forks",
    isolate: true,
  },
});
