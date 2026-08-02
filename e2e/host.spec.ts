import { expect, test } from "@playwright/test";

test("ships only Sound Walls and provides header song controls", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Gathering" })).toBeVisible();

  const preset = page.locator("#pad-preset");
  await expect(preset).toHaveValue("sound-walls");
  await expect(preset.locator("option")).toHaveCount(1);
  await expect(preset.locator("option")).toHaveText("Sound Wall Pads · Major + Minor");
  await expect(page.getByLabel("Brightness")).toBeVisible();
  await expect(page.getByLabel("Stereo Width")).toBeVisible();

  await expect(page.getByRole("button", { name: /Previous song/ })).toBeDisabled();
  await page.getByRole("button", { name: /Next song/ }).click();
  await expect(page.getByRole("heading", { name: "Prayer" })).toBeVisible();
  await page.getByRole("button", { name: /Previous song/ }).click();
  await expect(page.getByRole("heading", { name: "Gathering" })).toBeVisible();
  await page.getByRole("button", { name: "Edit song", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Edit song" })).toBeVisible();
});

test("exports and reimports a validated setlist", async ({ page }) => {
  await page.goto("/");
  const setlistName = page.getByLabel("Setlist name");
  await setlistName.fill("Imported Sunday");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export setlist" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.worship-keys\.json$/);
  const path = await download.path();
  expect(path).not.toBeNull();

  await setlistName.fill("Changed locally");
  await page.locator('input[type="file"][accept*="json"]').setInputFiles(path as string);
  await expect(setlistName).toHaveValue("Imported Sunday");
  await expect(page.getByText("Setlist imported and saved locally.")).toBeVisible();
});

test("decodes all Sound Walls keys in the live Web Audio graph", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Enable audio", exact: true }).click();
  await expect(page.getByText("12 of 12 ready", { exact: true })).toBeVisible({ timeout: 30_000 });
});
