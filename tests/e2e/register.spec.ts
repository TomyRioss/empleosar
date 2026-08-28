import { expect, test } from "playwright/test";
import { registerViaUi, uniqueEmail } from "./helpers";

test("registro crea el usuario y redirige a /login?registered=1", async ({ page }) => {
  const email = uniqueEmail();
  await registerViaUi(page, email);

  await expect(page).toHaveURL(/\/login\?registered=1/);
  await expect(page.getByText("Cuenta creada, ya podés ingresar.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Ingresar" })).toBeVisible();
});
