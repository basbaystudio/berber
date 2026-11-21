import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgres://berber:berber@localhost:5432/berber_e2e";
// İsteğe bağlı: farklı bir Chromium kullanmak için
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "off",
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
    launchOptions: { executablePath },
  },
  projects: [
    { name: "masaustu", use: { ...devices["Desktop Chrome"], launchOptions: { executablePath } } },
    { name: "tablet", use: { ...devices["Galaxy Tab S4"], launchOptions: { executablePath } }, testMatch: /a11y-responsive|marketplace-flow|home-ads-location/ },
    { name: "mobil", use: { ...devices["Pixel 7"], launchOptions: { executablePath } } },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    port: PORT,
    reuseExistingServer: false,
    env: { DATABASE_URL, NODE_ENV: "production" },
    timeout: 60_000,
  },
});
