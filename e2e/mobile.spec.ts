import { expect, test } from "@playwright/test";

test("phone host, viewer and leader use the focused touch layout", async ({ browser, page, request }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByText("OFFLINE CHURCH · LIVE", { exact: true })).toBeVisible();

  await expect(page.locator(".key-ribbon .key-pad")).toHaveCount(12);
  await expect(page.locator(".midi-keyboard-section")).toBeHidden();
  await expect(page.getByRole("region", { name: "Pad sound" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Live session" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.body.scrollWidth)).toBe(390);
  await expect
    .poll(() =>
      page.locator(".key-ribbon").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length),
    )
    .toBe(3);

  await page.getByRole("button", { name: "Show local join QR", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Join this session" });
  await expect(dialog).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(dialog).toBeHidden();

  const bootstrapResponse = await request.get("/api/session/bootstrap");
  const bootstrap = (await bootstrapResponse.json()) as { viewerToken: string; leaderPin: string };
  const deviceContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const device = await deviceContext.newPage();
  await device.goto(`/join?host=127.0.0.1:3100&t=${bootstrap.viewerToken}`);
  await device.getByLabel("Device name").fill("Phone pianist");
  await device.getByRole("button", { name: "Join", exact: true }).click();
  await expect(device.getByText("VIEW ONLY · LIVE", { exact: true })).toBeVisible();
  await expect(device.locator(".viewer-keyboard-layer")).toBeHidden();
  await expect(device.locator(".transcript")).toBeHidden();
  await expect.poll(() => device.evaluate(() => document.body.scrollWidth)).toBe(390);

  await device.getByRole("button", { name: "Request leader access", exact: true }).click();
  await device.getByLabel("Leader PIN").fill(bootstrap.leaderPin);
  await device.getByRole("button", { name: "Request access", exact: true }).click();
  await expect(device.getByText("LEADER · LIVE", { exact: true })).toBeVisible();
  await expect(device.locator(".key-ribbon .key-pad")).toHaveCount(12);
  await expect(device.locator(".leader-keyboard-layer")).toBeHidden();
  await expect(device.locator(".leader-timing-controls")).toBeHidden();
  await expect
    .poll(() =>
      device.locator(".key-ribbon").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length),
    )
    .toBe(3);

  const keySize = await device.locator(".key-pad").first().boundingBox();
  expect(keySize?.width).toBeGreaterThan(100);
  expect(keySize?.height).toBeGreaterThanOrEqual(68);
  await expect.poll(() => device.evaluate(() => document.body.scrollWidth)).toBe(390);

  // Release the shared in-memory leader lease so this responsive test does not
  // influence the session flow covered by the following end-to-end test.
  await page.getByRole("button", { name: "Remove leader", exact: true }).click();
  await expect(device.getByText("VIEW ONLY · LIVE", { exact: true })).toBeVisible();
  await deviceContext.close();
});
