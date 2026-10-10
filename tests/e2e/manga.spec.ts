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

const shown = (page: import("@playwright/test").Page) => page.locator("[data-page-index]");

test("paged right-to-left: taps, arrows, end card", async ({ page }) => {
  await page.goto("/read/mock%3Adelta/1");
  await expect(shown(page)).toHaveCount(1);
  await expect(shown(page)).toHaveAttribute("data-page-index", "0");

  const vp = page.viewportSize()!;
  await page.mouse.click(vp.width * 0.15, vp.height / 2); // left third = next in RTL
  await expect(shown(page)).toHaveAttribute("data-page-index", "1");
  await page.mouse.click(vp.width * 0.85, vp.height / 2); // right third = prev
  await expect(shown(page)).toHaveAttribute("data-page-index", "0");

  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("region", { name: "End of chapter" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Next: Ch. 2" })).toBeVisible();
  await page.getByRole("button", { name: "Back to page 5" }).click();
  await expect(shown(page)).toHaveAttribute("data-page-index", "4");
});

test("a swipe turns exactly one page", async ({ page }) => {
  await page.goto("/read/mock%3Adelta/1");
  await expect(shown(page)).toHaveAttribute("data-page-index", "0");
  const vp = page.viewportSize()!;
  // Swipe right (RTL next) starting in the left third: must not also count as a left-third tap.
  await page.mouse.move(vp.width * 0.2, vp.height / 2);
  await page.mouse.down();
  await page.mouse.move(vp.width * 0.8, vp.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(shown(page)).toHaveAttribute("data-page-index", "1");
});

test("paged position resumes", async ({ page }) => {
  await page.goto("/read/mock%3Adelta/1");
  await expect(shown(page)).toHaveAttribute("data-page-index", "0");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(shown(page)).toHaveAttribute("data-page-index", "2");
  await page.waitForTimeout(2500); // periodic save
  await page.goto("/");
  await page.goto("/read/mock%3Adelta/1");
  await expect(shown(page)).toHaveAttribute("data-page-index", "2");
});

test("mode override persists per title", async ({ page }) => {
  await page.goto("/read/mock%3Adelta/1");
  await expect(shown(page)).toHaveCount(1);
  await page.getByRole("button", { name: /^Reading mode:/ }).click();
  await page.getByRole("option", { name: "Long strip" }).click();
  await expect(shown(page)).toHaveCount(5);
  await page.reload();
  await expect(shown(page)).toHaveCount(5);

  await page.goto("/read/mock%3Aalpha/1"); // manhwa stays a strip
  await expect(shown(page)).toHaveCount(5);
});

test("falls back to strip when the title fails to load", async ({ page }) => {
  await page.route("**/api/title/**", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "Source unavailable" }),
    }),
  );
  await page.goto("/read/mock%3Aalpha/1");
  await expect(page.locator("[data-page-index]")).toHaveCount(5, { timeout: 20_000 });
});

test("switching paged direction keeps the current page", async ({ page }) => {
  await page.goto("/read/mock%3Adelta/1");
  await expect(shown(page)).toHaveAttribute("data-page-index", "0");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(shown(page)).toHaveAttribute("data-page-index", "2");
  const vp = page.viewportSize()!;
  const modeBtn = page.getByRole("button", { name: /^Reading mode:/ });
  if (await modeBtn.evaluate((el) => getComputedStyle(el).pointerEvents === "none")) await page.mouse.click(vp.width / 2, vp.height / 2);
  await modeBtn.click();
  await page.getByRole("option", { name: "Paged, left to right" }).click();
  await expect(modeBtn).toHaveAccessibleName("Reading mode: Paged, left to right");
  await expect(shown(page)).toHaveAttribute("data-page-index", "2");
  await page.keyboard.press("ArrowRight"); // ltr: right = next
  await expect(shown(page)).toHaveAttribute("data-page-index", "3");
});
