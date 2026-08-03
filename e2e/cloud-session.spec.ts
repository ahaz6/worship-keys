import { expect, test } from "@playwright/test";

test("Vercel-style host creates a cloud room and publishes Nashville to a join device", async ({ browser, page }) => {
  test.setTimeout(60_000);
  await page.goto("/play");
  await expect(page.getByText("CLOUD HOST · LIVE", { exact: true })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Show join code", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Join this session" });
  await expect(dialog).toBeVisible();
  const joinUrl = (await dialog.locator(".field").filter({ hasText: "Join address" }).locator("strong").textContent())?.trim();
  const joinCode = (await dialog.locator(".field").filter({ hasText: "Six-digit session code" }).locator("strong").textContent())?.trim();
  const leaderPin = (await dialog.locator(".field").filter({ hasText: "Leader PIN" }).locator(".pin-display").textContent())?.trim();
  expect(joinUrl).toContain("/join?cloud=1&t=");
  expect(joinCode).toMatch(/^\d{6}$/);
  expect(leaderPin).toMatch(/^\d{6}$/);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.locator("#slider-fade-in").fill("1");
  await page.locator("#slider-crossfade").fill("2");
  await page.getByRole("button", { name: "Fade in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Fade out", exact: true })).toBeEnabled({ timeout: 5_000 });

  const deviceContext = await browser.newContext();
  const device = await deviceContext.newPage();
  await device.goto("/join-app");
  await expect(device.locator('link[rel="manifest"]')).toHaveAttribute("href", "/join-manifest.webmanifest");
  await device.getByLabel("Session code").fill(joinCode as string);
  await device.getByRole("button", { name: "Join session", exact: true }).click();
  await device.waitForURL(/\/join\?cloud=1&t=/, { timeout: 15_000 });
  await device.getByLabel("Device name").fill("Cloud pianist");
  await device.getByRole("button", { name: "Join", exact: true }).click();
  await expect(device.getByText("VIEW ONLY · LIVE", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(device.getByText("Sunday Morning · Gathering · Song 1 of 3", { exact: true })).toBeVisible();

  await device.getByRole("button", { name: "Request leader access", exact: true }).click();
  await device.getByLabel("Leader PIN").fill(leaderPin as string);
  await device.getByRole("button", { name: "Request access", exact: true }).click();
  await expect(device.getByText("LEADER · LIVE", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(device.getByText("Leader access granted.", { exact: true })).toHaveCount(0);

  await device.getByRole("button", { name: /Next song:/ }).click();
  await expect(page.getByRole("heading", { name: "Prayer" })).toBeVisible({ timeout: 15_000 });
  await expect(device.getByText(/Prepared: .*Crossfading/)).toBeVisible();
  await deviceContext.close();
});
