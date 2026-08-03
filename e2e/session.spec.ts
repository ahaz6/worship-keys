import { expect, test } from "@playwright/test";

test("viewer joins and upgrades to leader without duplicate reconnects", async ({ browser, page, request }) => {
  test.setTimeout(60_000);
  const externalRequests: string[] = [];
  page.on("request", (outgoing) => {
    if (!outgoing.url().startsWith("http://127.0.0.1:3100")) externalRequests.push(outgoing.url());
  });
  await page.goto("/");
  await expect(page.getByText("OFFLINE CHURCH · LIVE", { exact: true })).toBeVisible();
  await expect(page.getByText("Offline Church Mode", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Show local join QR", exact: true }).click();
  await expect(page.getByText("12 of 12 ready", { exact: true })).toBeVisible({ timeout: 30_000 });

  const bootstrapResponse = await request.get("/api/session/bootstrap");
  expect(bootstrapResponse.ok()).toBe(true);
  const bootstrap = (await bootstrapResponse.json()) as {
    viewerToken: string;
    leaderPin: string;
    joinCode: string;
    cloudJoinUrl: string;
    localJoinUrl: string;
  };
  expect(bootstrap.cloudJoinUrl).toContain("https://worship-keys-psi.vercel.app/join?host=");
  expect(bootstrap.cloudJoinUrl).toContain(`t=${bootstrap.viewerToken}`);
  expect(bootstrap.localJoinUrl).toContain(`/join?t=${bootstrap.viewerToken}`);
  expect(bootstrap.joinCode).toMatch(/^\d{6}$/);
  const resolved = await request.get(`/api/session/resolve-code?code=${bootstrap.joinCode}`);
  expect(resolved.ok()).toBe(true);
  expect((await resolved.json()).joinUrl).toBe(`http://127.0.0.1:3100/join?t=${bootstrap.viewerToken}`);
  expect((await request.get("/api/session/resolve-code?code=000000")).status()).toBe(404);
  await expect(page.getByText(bootstrap.localJoinUrl, { exact: true })).toBeVisible();
  await expect(page.getByText("This QR stays entirely inside the local church network", { exact: false })).toBeVisible();
  await expect(page.getByText("READY · INTERNET NOT REQUIRED", { exact: true })).toBeVisible();
  expect(externalRequests).toEqual([]);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.locator("#slider-fade-in").fill("2");
  await page.locator("#slider-fade-out").fill("2");
  await page.locator("#slider-crossfade").fill("2");
  await page.locator("#slider-crescendo").fill("1");

  const preflight = await request.fetch("/api/session/leader", {
    method: "OPTIONS",
    headers: {
      Origin: "https://worship-keys-psi.vercel.app",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Private-Network": "true",
    },
  });
  expect(preflight.status()).toBe(204);
  expect(preflight.headers()["access-control-allow-origin"]).toBe("https://worship-keys-psi.vercel.app");
  expect(preflight.headers()["access-control-allow-private-network"]).toBe("true");

  const deviceContext = await browser.newContext();
  const device = await deviceContext.newPage();
  const deviceExternalRequests: string[] = [];
  device.on("request", (outgoing) => {
    if (!outgoing.url().startsWith("http://127.0.0.1:3100")) deviceExternalRequests.push(outgoing.url());
  });
  await device.goto("/join-app");
  await device.getByLabel("Session code").fill(bootstrap.joinCode);
  await device.getByRole("button", { name: "Join session", exact: true }).click();
  await device.waitForURL(/\/join\?t=/);
  await device.getByLabel("Device name").fill("Pianist iPad");
  await device.getByRole("button", { name: "Join", exact: true }).click();
  await expect(device.getByText("VIEW ONLY · LIVE", { exact: true })).toBeVisible();
  expect(deviceExternalRequests).toEqual([]);

  await device.getByRole("button", { name: "Request leader access", exact: true }).click();
  await device.getByLabel("Leader PIN").fill(bootstrap.leaderPin);
  await device.getByRole("button", { name: "Request access", exact: true }).click();
  await expect(device.getByText("LEADER · LIVE", { exact: true })).toBeVisible();
  await expect(device.getByLabel("Main Volume")).toBeVisible();
  const xy = device.getByRole("application", { name: /Tone & Shimmer/ });
  await expect(xy).toBeVisible();
  await expect(device.locator("#slider-shimmer")).toHaveCount(0);
  await expect(device.locator("#slider-pad-motion")).toHaveCount(0);
  await expect(device.locator("#slider-brightness")).toHaveCount(0);
  await expect(device.locator("#slider-stereo-width")).toHaveCount(0);
  await expect(device.getByRole("button", { name: "Switch now", exact: true })).toHaveCount(0);
  await expect(device.getByRole("button", { name: "Prepare", exact: true })).toHaveCount(0);

  await device.getByLabel("Main Volume").fill("48");
  await expect(page.getByLabel("Main Volume")).toHaveValue("48");
  await xy.press("ArrowLeft");
  await expect(page.getByRole("application", { name: /Tone & Shimmer\. Tone 98 percent/ })).toBeVisible();
  const brightnessWidth = device.getByRole("application", { name: /Brightness & Stereo Width/ });
  const brightnessWidthName = await brightnessWidth.getAttribute("aria-label");
  expect(brightnessWidthName).not.toBeNull();
  await device.locator("#slider-fade-out").fill("6");
  await expect(brightnessWidth).toHaveAccessibleName(brightnessWidthName as string);

  await device.getByRole("button", { name: "Fade in", exact: true }).click();
  await expect(device.getByRole("button", { name: "Fading in", exact: true })).toBeVisible();
  const fadeProgress = device.locator(".leader-top-transport-button.is-running .progress");
  await expect(fadeProgress).toBeVisible();
  await expect.poll(async () => Number.parseFloat((await fadeProgress.getAttribute("style"))?.match(/[\d.]+/)?.[0] ?? "0"))
    .toBeGreaterThan(0);
  await expect(device.getByRole("button", { name: "Fade in", exact: true })).toBeVisible({ timeout: 4_000 });

  // A manual XY position must cancel a running Crescendo return animation.
  // Moving an unrelated volume control may never reveal the old return point.
  await device.getByRole("button", { name: "Crescendo", exact: true }).click();
  await expect(device.getByRole("button", { name: "Release Crescendo", exact: true })).toBeVisible();
  await page.waitForTimeout(1_300);
  await expect(device.getByRole("button", { name: "Release Crescendo", exact: true })).toBeVisible();
  await device.getByRole("button", { name: "Release Crescendo", exact: true }).click();
  await brightnessWidth.dblclick();
  const spatialDefault = /Brightness 0 percent, Stereo width 0 percent/;
  await expect(brightnessWidth).toHaveAccessibleName(spatialDefault);
  await expect(page.getByRole("application", { name: /Brightness & Stereo Width/ })).toHaveAccessibleName(spatialDefault);
  await device.getByLabel("Main Volume").fill("47");
  await expect(page.getByLabel("Main Volume")).toHaveValue("47");
  await page.waitForTimeout(1_200);
  await expect(brightnessWidth).toHaveAccessibleName(spatialDefault);
  await expect(page.getByRole("application", { name: /Brightness & Stereo Width/ })).toHaveAccessibleName(spatialDefault);

  await device.getByRole("button", { name: /Next song:/ }).click();
  await expect(device.getByText(/Prepared: .* · Crossfading \d+%/)).toBeVisible();
  const crossfadeProgress = device.locator(".leader-transition-progress");
  await expect(crossfadeProgress).toBeVisible();
  await expect.poll(async () => Number.parseFloat((await crossfadeProgress.getAttribute("style"))?.match(/[\d.]+/)?.[0] ?? "0"))
    .toBeGreaterThan(0);
  await expect(page.getByLabel("Main Volume")).toHaveValue("47");
  await expect(brightnessWidth).toHaveAccessibleName(spatialDefault);
  await expect(device.locator("#slider-fade-out")).toHaveValue("6");

  await expect(device.getByText(/Crossfading/)).toHaveCount(0, { timeout: 4_000 });
  await device.getByRole("button", { name: "Fade out", exact: true }).click();
  await expect(device.getByRole("button", { name: "Fading out", exact: true })).toBeVisible();
  await expect(device.locator(".leader-top-transport-button.is-running .progress")).toBeVisible();

  await deviceContext.close();
});
