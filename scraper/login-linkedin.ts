import { chromium } from "playwright";
import path from "path";

const SESSION_DIR = path.join(__dirname, ".session");

async function main() {
  const context = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false,
  });
  const page = await context.newPage();
  await page.goto("https://www.linkedin.com/login");

  console.log("Log in manually in the opened browser window, then Ctrl+C here.");
  await new Promise(() => {});
}

main();
