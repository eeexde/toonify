import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  // next dev compiles routes on first hit; cold compiles under parallel workers exceed the 5s default.
  expect: { timeout: 15_000 },
  use: { baseURL: "http://localhost:3100" },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testMatch: /reader\.spec/ },
  ],
  webServer: {
    command: "npx cross-env SOURCE_MODE=mock next dev -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
