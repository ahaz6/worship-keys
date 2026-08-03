import { expect, test } from "@playwright/test";

test("public cloud performance mode loads pads without a LAN session", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/play");

  await expect(page.getByText("CLOUD HOST · LIVE", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Enable audio", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect MIDI keyboard", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "IP Connect", exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Live session" })).toBeVisible();
  await expect(page.getByText(/Supabase Realtime · Vercel/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Cloud planner" })).toHaveCount(0);

  await page.getByRole("button", { name: "Google Drive", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Google Drive setlist" })).toBeVisible();
  await expect(page.getByText("Sign in with the authorized Worship Keys account.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Google Drive", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create account", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Close", exact: true }).click();

  const unauthorizedDeploy = await page.request.post("/api/deploy-setlist", { data: {} });
  expect(unauthorizedDeploy.status()).toBe(401);

  const manifest = await page.request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  await expect(manifest.json()).resolves.toMatchObject({ name: "Worship Keys", display: "standalone" });

  await page.getByRole("button", { name: "Enable audio", exact: true }).click();
  await expect(page.getByText("12 of 12 ready", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Fade in", exact: true })).toBeEnabled();
});

test("the play app saves Saturday preparation locally and /cloud redirects to it", async ({ page }) => {
  await page.goto("/play");
  const setlistName = page.getByLabel("Setlist name");
  await setlistName.fill("Saturday preparation");
  await page.getByRole("button", { name: "Save setlist", exact: true }).first().click();
  await expect(page.getByText("Setlist saved on this device.", { exact: true })).toBeVisible();

  await page.reload();
  await expect(setlistName).toHaveValue("Saturday preparation");
  await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible();

  await page.goto("/cloud");
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByLabel("Setlist name")).toHaveValue("Saturday preparation");
});
