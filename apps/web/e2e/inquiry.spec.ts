import { expect, test } from "@playwright/test";

const PRODUCT = process.env.E2E_PRODUCT ?? "product_df1dfb162403cf73df70fdf3"; // Apple 20W charger, 59 sellers

test("shopper asks sellers, a seller confirms, the shopper sees it live", async ({ browser, baseURL }) => {
  const shopper = await (await browser.newContext()).newPage();
  await shopper.goto(`/p/${PRODUCT}`);
  await expect(shopper.getByText("کجا بخرم؟")).toBeVisible();

  const boxes = shopper.getByRole("button", { name: "انتخاب برای استعلام" });
  await boxes.nth(0).click();
  await boxes.nth(1).click();
  await shopper.getByRole("button", { name: /^بپرس$/ }).click();
  await shopper.getByRole("button", { name: /ارسال به/ }).click();
  await shopper.waitForURL(/requests/);

  const { inquiries } = await (await shopper.request.get(`${baseURL}/api/inquiries`)).json();
  const target = inquiries[0].targets[0];

  const seller = await (await browser.newContext()).newPage();
  await seller.request.post(`${baseURL}/api/seller/login`, { data: { shopId: target.shopId } });
  await seller.goto("/seller/inbox");
  await seller.getByRole("button", { name: /موجوده، همین قیمت/ }).first().click();

  await expect(shopper.getByText("برو همین‌جا؛ فروشنده تأیید کرد")).toBeVisible({ timeout: 20_000 });
  await expect(shopper.getByText(target.shopName).first()).toBeVisible();
});

test("product page ranks sellers with transparency badges and hubs", async ({ page }) => {
  await page.goto(`/p/${PRODUCT}`);
  await expect(page.getByText("پیشنهاد هوشمند").first()).toBeVisible();
  await expect(page.getByText(/موجودی تأیید نشده|تأیید فروشنده/).first()).toBeVisible();
});

test("no horizontal overflow on key mobile pages", async ({ page }) => {
  for (const url of ["/", `/p/${PRODUCT}`, "/trip", "/requests", "/data", "/map", "/seller"]) {
    await page.goto(url);
    await page.waitForTimeout(1500);
    const [sw, vw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(sw, url).toBeLessThanOrEqual(vw);
  }
});
