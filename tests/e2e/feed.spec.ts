import { expect, test } from "playwright/test";
import { escapeRegExp } from "./helpers";

test("el feed lista avisos", async ({ page }) => {
  await page.goto("/");

  const firstCard = page.locator("main ul > li").first();
  await expect(firstCard).toBeVisible({ timeout: 30_000 });
  await expect(firstCard.locator("h2")).toHaveText(/\S/);

  const countLabel = page.locator("main").getByText(/\d+ aviso/);
  await expect(countLabel.first()).toBeVisible();
});

test("el filtro de búsqueda filtra por título", async ({ page }) => {
  await page.goto("/");

  const firstCard = page.locator("main ul > li").first();
  await expect(firstCard).toBeVisible({ timeout: 30_000 });
  const title = (await firstCard.locator("h2").textContent())?.trim() ?? "";
  expect(title).not.toBe("");
  const query = title.split(/\s+/)[0];

  // Buscador del header (visible en desktop)
  await page.locator('header input[name="search"]').fill(query);
  await page.getByRole("button", { name: "Buscar" }).click();

  await expect(page).toHaveURL(new RegExp(`search=${escapeRegExp(query)}`));

  const cards = page.locator("main ul > li");
  await expect(cards.first()).toBeVisible({ timeout: 30_000 });
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);

  // Filtra por título (contains, case-insensitive): todos los visibles deben contener el término
  const normalized = query.toLowerCase();
  for (let i = 0; i < count; i++) {
    const cardTitle = ((await cards.nth(i).locator("h2").textContent()) ?? "").toLowerCase();
    expect(cardTitle).toContain(normalized);
  }
});
