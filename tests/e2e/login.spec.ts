import { expect, test } from "playwright/test";
import { E2E_FIRST_NAME, E2E_LAST_NAME, loginViaUi, registerViaUi, uniqueEmail } from "./helpers";

test("login con usuario registrado redirige a / y muestra la sesión", async ({ page }) => {
  const email = uniqueEmail();
  await registerViaUi(page, email);
  await loginViaUi(page, email);

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(`${E2E_FIRST_NAME} ${E2E_LAST_NAME}`)).toBeVisible();
  await expect(page.getByRole("button", { name: "Salir" })).toBeVisible();
});
