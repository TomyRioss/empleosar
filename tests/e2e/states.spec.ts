import { expect, test, type Locator } from "playwright/test";
import { loginViaUi, registerViaUi, uniqueEmail } from "./helpers";

const STATUS_CLASS: Record<string, string> = {
  Guardar: "saved",
  Aplicado: "applied",
  Descartar: "discarded",
};

async function assertStatusPersistsAfterReload(card: Locator, label: string): Promise<void> {
  const page = card.page();
  const activeClass = `bg-status-${STATUS_CLASS[label]}/25`;
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.reload();
    const btn = card.getByRole("button", { name: label });
    if (await btn.isVisible()) {
      const className = ((await btn.getAttribute("class")) ?? "").trim();
      if (className.includes(activeClass)) return;
    }
    await page.waitForTimeout(750);
  }
  throw new Error(`El estado "${label}" no persistió tras recargar`);
}

test("Guardar/Aplicado/Descartar persisten tras recargar", async ({ page }) => {
  const email = uniqueEmail();
  await registerViaUi(page, email);
  await loginViaUi(page, email);

  await page.goto("/");
  const firstCard = page.locator("main ul > li").first();
  await expect(firstCard).toBeVisible({ timeout: 30_000 });

  // Usar el primer aviso real del feed, sin depender de ids hardcodeados.
  const jobHref = await firstCard.locator('a[href^="/jobs/"]').first().getAttribute("href");
  expect(jobHref).toBeTruthy();
  const card = page.locator(`main ul > li:has(a[href="${jobHref}"])`);

  for (const label of ["Guardar", "Aplicado", "Descartar"]) {
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: label }).click();
    await expect(card.getByRole("button", { name: label })).toHaveClass(
      new RegExp(`bg-status-${STATUS_CLASS[label]}/25`),
    );
    await assertStatusPersistsAfterReload(card, label);
  }
});
