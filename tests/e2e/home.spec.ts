import { expect, test } from "@playwright/test";

test("homepage shell renders", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("ETHOSALPHA")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mindshare arena" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tier x project heatmap" })).toBeVisible();
});

test("mindshare controls and board render", async ({ page }) => {
  await page.goto("/");

  const arena = page.locator("#mindshare-board");
  await expect(arena).toBeVisible();

  await page.getByRole("button", { name: "24H" }).click();
  const emptyState = page.getByText("No live project mindshare yet");
  if (await emptyState.isVisible().catch(() => false)) {
    await expect(emptyState).toBeVisible();
    return;
  }

  await page.locator(".mindshare-filter-tabs button").last().click();
  await expect(page.locator(".mindshare-board")).toBeVisible();
  await expect(page.locator(".mindshare-tile-shell").first()).toBeVisible();
});
