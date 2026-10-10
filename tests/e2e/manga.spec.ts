import { expect, test } from "@playwright/test";

const catalog = (page: import("@playwright/test").Page) => page.getByRole("radiogroup", { name: "Catalog" });

test("home opens on manga; the toggle switches catalogs and back", async ({ page }) => {
  await page.goto("/");
  await expect(catalog(page).getByRole("radio", { name: "Manga" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("title-card")).toHaveCount(2);
  await expect(page.getByTestId("title-card").filter({ hasText: "Paper Lantern" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Featured" }).getByRole("list", { name: "Featured titles" }).getByRole("listitem")).toHaveCount(2);

  await catalog(page).getByRole("radio", { name: "Manhwa" }).click();
  await expect(page).toHaveURL(/\/\?kind=manhwa$/);
  await expect(page.getByTestId("title-card").filter({ hasText: "Skyward Blade" })).toBeVisible();
  await expect(page.getByTestId("title-card")).toHaveCount(2);

  await catalog(page).getByRole("radio", { name: "Manga" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("title-card").filter({ hasText: "Iron Courier" })).toBeVisible();
});

test("header search on manhwa stays on manhwa; clear all keeps the catalog", async ({ page }) => {
  await page.goto("/?kind=manhwa");
  await page.getByLabel("Search titles").fill("bak");
  await expect(page).toHaveURL(/\/\?q=bak&kind=manhwa$/);
  await expect(page.getByTestId("title-card")).toHaveCount(1);
  await expect(page.getByText("Moonlit Bakery")).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(page).toHaveURL(/\/\?kind=manhwa$/);

  await page.getByRole("button", { name: /^Sort:/ }).click();
  await page.getByRole("option", { name: "A–Z" }).click();
  await expect(page).toHaveURL(/kind=manhwa&sort=title/);
  await page.getByRole("button", { name: "Clear all" }).click();
  await expect(page).toHaveURL(/\/\?kind=manhwa$/);
  await expect(catalog(page).getByRole("radio", { name: "Manhwa" })).toHaveAttribute("aria-checked", "true");
});
