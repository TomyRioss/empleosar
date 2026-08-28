import { defineConfig, devices } from "playwright/test";

// Default: 3000 (igual que `npm run dev`). Permite override local con E2E_PORT
// para no chocar con otro dev server que ya ocupe 3000 (ver e2e-server.log).
const PORT = Number(process.env.E2E_PORT ?? 3000);
export const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Equivalente al comando del log e2e-server3000.log (`next dev`).
    command: `npm run dev -- --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
