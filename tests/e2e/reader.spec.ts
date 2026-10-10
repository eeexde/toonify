import { expect, test } from "@playwright/test";

test("browse, open title, read, resume, complete", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("title-card")).toHaveCount(2);
  await page.getByTestId("title-card").filter({ hasText: "Skyward Blade" }).click();
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

test("search from the header turns home into results", async ({ page }) => {
  await page.goto("/library");
  await page.getByLabel("Search manhwa").fill("bak");
  await expect(page).toHaveURL(/\/\?q=bak$/);
  await expect(page.getByTestId("title-card")).toHaveCount(1);
  await expect(page.getByText("Moonlit Bakery")).toBeVisible();
  await page.getByLabel("Search manhwa").fill("zzzz");
  await expect(page.getByText(/No results/)).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("title-card")).toHaveCount(2);
});

test("old /search links redirect to home", async ({ page }) => {
  await page.goto("/search?q=moon");
  await expect(page).toHaveURL(/\/\?q=moon$/);
  await expect(page.getByLabel("Search manhwa")).toHaveValue("moon");
});

test("filters: genre and sort apply to browse; cards show series status", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("title-card")).toHaveCount(2);
  await expect(page.getByTestId("title-card").filter({ hasText: "Moonlit Bakery" }).getByText("Completed")).toBeVisible();
  await expect(page.getByTestId("title-card").filter({ hasText: "Skyward Blade" }).getByText("Ongoing")).toBeVisible();

  await page.getByRole("button", { name: "Filters" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Fantasy" }).click();
  await page.getByRole("button", { name: "Show results" }).click();
  await expect(page).toHaveURL(/tags=fantasy/);
  await expect(page.getByTestId("title-card")).toHaveCount(1);
  await expect(page.getByText("Skyward Blade").first()).toBeVisible();

  await page.getByRole("button", { name: "Remove Fantasy" }).click();
  await expect(page.getByTestId("title-card")).toHaveCount(2);
  await page.getByRole("button", { name: /^Sort:/ }).click();
  await page.getByRole("option", { name: "A–Z" }).click();
  await expect(page).toHaveURL(/sort=title/);
  await expect(page.getByTestId("title-card").first()).toContainText("Moonlit Bakery");
});

test("unknown title shows not found", async ({ page }) => {
  await page.goto("/title/mock%3Anope");
  await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
});

test("resume stays on the saved page when images above it load late (no scroll anchoring, as in Safari)", async ({ page }) => {
  await page.goto("/read/mock%3Aalpha/1");
  await expect(page.locator("[data-page-index]")).toHaveCount(5);
  await page.locator('[data-page-index="3"]').evaluate((el) => el.scrollIntoView({ block: "start" }));
  await page.waitForTimeout(2500); // periodic save

  // Simulate WebKit: no scroll anchoring, and images that arrive after the restore scroll.
  await page.addInitScript(() => {
    const s = document.createElement("style");
    s.textContent = "*{overflow-anchor:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(s));
  });
  await page.route("**/api/img/**", async (route) => {
    await new Promise((r) => setTimeout(r, 1200));
    await route.continue();
  });
  await page.goto("/");
  await page.goto("/read/mock%3Aalpha/1");
  await page.waitForTimeout(4000);
  const top = await page.locator('[data-page-index="3"]').evaluate((el) => el.getBoundingClientRect().top);
  expect(Math.abs(top)).toBeLessThan(40);
});

test("branded dropdown: reader chapter picker by mouse and keyboard", async ({ page }) => {
  await page.goto("/read/mock%3Aalpha/1");
  await expect(page.locator("[data-page-index]")).toHaveCount(5);
  const trigger = page.getByRole("button", { name: /^Chapter:/ });
  await expect(trigger).toHaveAttribute("aria-haspopup", "listbox");
  await trigger.click();
  const list = page.getByRole("listbox", { name: "Chapter" });
  await expect(list).toBeVisible();
  await expect(list.getByRole("option", { name: /Ch\. 1/ })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Escape");
  await expect(list).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.press("Enter");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/read\/mock%3Aalpha\/2$/);

  await page.getByRole("button", { name: /^Chapter:/ }).click();
  await page.getByRole("option", { name: /Ch\. 3/ }).click();
  await expect(page).toHaveURL(/\/read\/mock%3Aalpha\/3$/);
});

test("featured banner: slides, list, pause, view series; hidden while searching", async ({ page }) => {
  await page.goto("/");
  const banner = page.getByRole("region", { name: "Featured" });
  await expect(banner.getByRole("heading", { name: "Featured" })).toBeVisible();
  const slide = (name: string) => banner.getByRole("group", { name: new RegExp(`featured: ${name}$`), includeHidden: true });
  await expect(slide("Skyward Blade")).toHaveAttribute("aria-hidden", "false");
  await expect(banner.getByRole("list", { name: "Featured titles" }).getByRole("listitem")).toHaveCount(2);

  await banner.getByRole("button", { name: "Pause featured slideshow" }).click();
  await expect(banner.getByRole("button", { name: "Play featured slideshow" })).toBeVisible();

  await banner.getByRole("button", { name: "Next featured" }).click();
  await expect(slide("Moonlit Bakery")).toHaveAttribute("aria-hidden", "false");
  await expect(slide("Skyward Blade")).toHaveAttribute("aria-hidden", "true");
  await banner.getByRole("button", { name: "Show Skyward Blade" }).click();
  await expect(slide("Skyward Blade")).toHaveAttribute("aria-hidden", "false");

  await slide("Skyward Blade").getByRole("button", { name: "Add Skyward Blade to library" }).click();
  await expect(slide("Skyward Blade").getByRole("button", { name: "Remove Skyward Blade from library" })).toBeVisible();

  await slide("Skyward Blade").getByRole("link", { name: "View series" }).click();
  await expect(page.getByRole("heading", { name: "Skyward Blade" })).toBeVisible();
  await expect(page.getByRole("button", { name: "✓ In library" })).toBeVisible();

  await page.goto("/?q=bak");
  await expect(page.getByTestId("title-card")).toHaveCount(1);
  await expect(page.getByRole("region", { name: "Featured" })).toHaveCount(0);
});

test("featured banner autoplays to the next slide", async ({ page }) => {
  await page.goto("/");
  const banner = page.getByRole("region", { name: "Featured" });
  await expect(banner.getByRole("group", { name: /featured: Skyward Blade$/, includeHidden: true })).toHaveAttribute("aria-hidden", "false");
  await page.mouse.move(5, 830);
  await expect(banner.getByRole("group", { name: /featured: Moonlit Bakery$/, includeHidden: true })).toHaveAttribute("aria-hidden", "false", { timeout: 12_000 });
});
