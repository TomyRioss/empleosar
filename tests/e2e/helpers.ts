import { expect, type Page } from "playwright/test";

export const E2E_PASSWORD = "Teste2e#1234";
export const E2E_FIRST_NAME = "Juan";
export const E2E_LAST_NAME = "Pérez";

export function uniqueEmail(): string {
  return `e2e.${Date.now()}.${Math.floor(Math.random() * 1_000_000)}@test.local`;
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function registerViaUi(page: Page, email: string): Promise<void> {
  await page.goto("/register");

  // Paso 1/6: cuenta
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').nth(0).fill(E2E_PASSWORD);
  await page.locator('input[type="password"]').nth(1).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Siguiente" }).click();

  // Paso 2/6: importar (opcional) — saltear
  await page.getByRole("button", { name: "Siguiente" }).click();

  // Paso 3/6: datos personales
  await page.locator('input[autocomplete="given-name"]').fill(E2E_FIRST_NAME);
  await page.locator('input[autocomplete="family-name"]').fill(E2E_LAST_NAME);
  await page.locator('input[autocomplete="address-level1"]').fill("Buenos Aires");
  await page.locator('input[autocomplete="address-level2"]').fill("Avellaneda");
  await page.getByRole("button", { name: "Siguiente" }).click();

  // Paso 4/6: experiencia (obligatoria)
  await page.getByPlaceholder("Cargo", { exact: true }).fill("Desarrollador");
  await page.getByPlaceholder("Empresa", { exact: true }).fill("Acme SRL");
  await page.getByRole("button", { name: "Siguiente" }).click();

  // Paso 5/6: educación (opcional) — saltear
  await page.getByRole("button", { name: "Siguiente" }).click();

  // Paso 6/6: perfil (opcional) — crear cuenta
  await page.getByRole("button", { name: "Crear cuenta" }).click();

  await expect(page).toHaveURL(/registered=1/);
  await expect(page.getByText("Cuenta creada, ya podés ingresar.")).toBeVisible();
}

export async function loginViaUi(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "Salir" })).toBeVisible();
}
