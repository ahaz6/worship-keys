import { expect, test } from "@playwright/test";

test("public cloud performance mode loads pads without a LAN session", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/play");

  await expect(page.getByText("CLOUD · PLAY", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enable audio", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect MIDI keyboard", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "IP Connect", exact: true }).click();
  const connectDialog = page.getByRole("dialog", { name: "Connect to a local Worship Keys session" });
  await expect(connectDialog).toBeVisible();
  await page.getByLabel("Host IP").fill("8.8.8.8:3000");
  await page.getByLabel("Join key").fill("viewer_token-123");
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.getByText("Enter a private host IP", { exact: false })).toBeVisible();
  await connectDialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("region", { name: "Live session" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Cloud performance mode" })).toBeVisible();

  const manifest = await page.request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  await expect(manifest.json()).resolves.toMatchObject({ name: "Worship Keys", display: "standalone" });

  await page.getByRole("button", { name: "Enable audio", exact: true }).click();
  await expect(page.getByText("12 of 12 ready", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Fade in", exact: true })).toBeEnabled();
});
