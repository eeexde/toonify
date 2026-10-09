import { expect, test } from "@playwright/test";

test("browse, open title, read, resume, complete", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("title-card")).toHaveCount(2);
  await page.getByText("Skyward Blade").first().click();
  await expect(page.getByRole("heading", { name: "Skyward Blade" })).toBeVisible();
  await expect(page.getByText("Official ↗")).toBeVisible();

  await page.getByRole("button", { name: "+ Library" }).click();
  await expect(page.getByRole("button", { name: "✓ In library" })).toBeVisible();

  await page.getByRole("link", { name: "Start reading" }).click();
  await expect(page.locator("[data-page-index]")).toHaveCount(5);

  // Scroll to page 3, leave, come back -> resumes there
  await page.locator('[data-page-index="2"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(2500);
  await page.goto("/");
  await expect(page.getByText("Continue reading")).toBeVisible();
  await page.getByRole("link", { name: /Skyward Blade/ }).first().click();
  await expect(page.locator('[data-page-index="2"]')).toBeInViewport();

  // Finish chapter -> next card -> chapter 1 marked read
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.getByRole("link", { name: "Next: Ch. 2" }).click();
  await expect(page).toHaveURL(/\/read\/mock%3Aalpha\/2$/);
});

test("last readable chapter disables next (external skipped)", async ({ page }) => {
  await page.goto("/read/mock%3Aalpha/3");
  await expect(page.locator("[data-page-index]")).toHaveCount(5);
  await expect(page.getByRole("button", { name: "Next ›" })).toBeDisabled();
});

test("search", async ({ page }) => {
  await page.goto("/search");
  await page.getByLabel("Search manhwa").fill("bak");
  await expect(page.getByText("Moonlit Bakery")).toBeVisible();
  await page.getByLabel("Search manhwa").fill("zzzz");
  await expect(page.getByText(/No results/)).toBeVisible();
});

test("unknown title shows not found", async ({ page }) => {
  await page.goto("/title/mock%3Anope");
  await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
});
