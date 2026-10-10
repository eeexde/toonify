import { expect, test } from "@playwright/test";

test("18+ requires confirmation", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("switch", { name: "Show 18+ content" }).click();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("switch", { name: "Show 18+ content" })).toHaveAttribute("aria-checked", "false");
  await page.getByRole("switch", { name: "Show 18+ content" }).click();
  await page.getByRole("button", { name: "I am 18 or older" }).click();
  await expect(page.getByRole("switch", { name: "Show 18+ content" })).toHaveAttribute("aria-checked", "true");
  await page.goto("/");
  await expect(page.getByTestId("title-card").filter({ hasText: "Crimson Night" })).toBeVisible();
});

test("export then import backup; bad file rejected", async ({ page }) => {
  await page.goto("/title/mock%3Abeta");
  await page.getByRole("button", { name: "+ Library" }).click();
  await page.goto("/settings");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export" }).click()]);
  const path = await download.path();

  await page.getByTestId("import-input").setInputFiles(path!);
  await expect(page.getByText(/Imported 1 library titles/)).toBeVisible();

  await page.getByTestId("import-input").setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from('{"version":9}') });
  await expect(page.getByText("This file is not a valid Toonify backup.")).toBeVisible();
});
