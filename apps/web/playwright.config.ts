import { defineConfig, devices } from "@playwright/test";

/** End-to-end flows on a phone viewport. Needs a running app with an ingested database (`pnpm dev`). */
export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    ...devices["iPhone 13"],
    locale: "fa-IR",
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM, args: ["--no-sandbox"] } : {},
    browserName: "chromium",
  },
  reporter: [["list"]],
});
