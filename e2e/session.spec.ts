import { expect, test } from "@playwright/test";

test("viewer joins and upgrades to leader without duplicate reconnects", async ({ browser, page, request }) => {
  await page.goto("/");
  await expect(page.getByText("HOST · LIVE", { exact: true })).toBeVisible();

  const bootstrapResponse = await request.get("/api/session/bootstrap");
  expect(bootstrapResponse.ok()).toBe(true);
  const bootstrap = (await bootstrapResponse.json()) as { viewerToken: string; leaderPin: string };

  const deviceContext = await browser.newContext();
  const device = await deviceContext.newPage();
  await device.goto(`/join?t=${bootstrap.viewerToken}`);
  await device.getByLabel("Device name").fill("Pianist iPad");
  await device.getByRole("button", { name: "Join", exact: true }).click();
  await expect(device.getByText("VIEW ONLY · LIVE", { exact: true })).toBeVisible();

  await device.getByRole("button", { name: "Request leader access", exact: true }).click();
  await device.getByLabel("Leader PIN").fill(bootstrap.leaderPin);
  await device.getByRole("button", { name: "Request access", exact: true }).click();
  await expect(device.getByText("LEADER · LIVE", { exact: true })).toBeVisible();
  await expect(device.getByLabel("Main Volume")).toBeVisible();
  const xy = device.getByRole("application", { name: /Tone and shimmer surface/ });
  await expect(xy).toBeVisible();
  await expect(device.locator("#slider-shimmer")).toHaveCount(0);
  await expect(device.locator("#slider-pad-motion")).toHaveCount(0);
  await expect(device.locator("#slider-crossfade")).toHaveCount(0);
  await expect(device.locator("#slider-brightness")).toHaveCount(0);
  await expect(device.locator("#slider-stereo-width")).toHaveCount(0);
  await expect(device.getByRole("button", { name: "Switch now", exact: true })).toHaveCount(0);
  await expect(device.getByRole("button", { name: "Prepare", exact: true })).toHaveCount(0);

  await device.getByLabel("Main Volume").fill("48");
  await expect(page.getByLabel("Main Volume")).toHaveValue("48");
  await xy.press("ArrowRight");
  await expect(page.getByRole("slider", { name: "Tone", exact: true })).toHaveValue("46");

  await deviceContext.close();
});
