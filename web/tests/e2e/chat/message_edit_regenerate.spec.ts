import { test, expect } from "@chromatic-com/playwright";
import { loginAsRandomUser } from "../utils/auth";
import { sendMessage } from "../utils/chatActions";

test.describe("Message Edit and Regenerate Tests", () => {
  test.beforeEach(async ({ page }) => {
    // Clear cookies and log in as a random user
    await page.context().clearCookies();
    await loginAsRandomUser(page);

    // Navigate to the chat page
    await page.goto("http://localhost:3000/chat");
    await page.waitForLoadState("networkidle");
  });

  test("Complete message editing functionality", async ({ page }) => {
    // Step 1: Send initial message
    await sendMessage(page, "What is 2+2?");
    await page.waitForSelector('[data-testid="onyx-ai-message"]');
    await page.waitForTimeout(3000);

    // Step 2: Test cancel editing
    let userMessage = page.locator("#onyx-human-message").first();
    await userMessage.hover();
    let editButton = userMessage
      .locator('[data-testid="edit-button"], svg.text-text-600')
      .first();
    await editButton.click();

    let textarea = userMessage.locator("textarea");
    await textarea.fill("This edit will be cancelled");

    const cancelButton = userMessage.locator('button:has-text("Cancel")');
    await cancelButton.click();

    // Verify original message is preserved
    let messageContent = await userMessage.textContent();
    expect(messageContent).toContain("What is 2+2?");
    expect(messageContent).not.toContain("This edit will be cancelled");

    // Step 3: Edit the message for real
    await userMessage.hover();
    editButton = userMessage
      .locator('[data-testid="edit-button"], svg.text-text-600')
      .first();
    await editButton.click();

    textarea = userMessage.locator("textarea");
    await textarea.fill("What is 3+3?");

    let submitButton = userMessage.locator('button:has-text("Submit")');
    await submitButton.click();
    await page.waitForTimeout(3000);

    // Verify edited message is displayed
    messageContent = await page
      .locator("#onyx-human-message")
      .first()
      .textContent();
    expect(messageContent).toContain("What is 3+3?");

    // Step 4: Verify version switcher appears and shows 2/2
    // Look for the switcher by finding text containing "2 / 2"
    await page.waitForTimeout(1000); // Give switcher time to appear
    let messageSwitcher = page.locator('span:has-text("2 / 2")').first();
    await expect(messageSwitcher).toBeVisible();

    // Get the parent div that contains the whole switcher
    messageSwitcher = messageSwitcher.locator("..").first();

    // Step 5: Edit again to create a third version
    userMessage = page.locator("#onyx-human-message").first();
    await userMessage.hover();
    editButton = userMessage
      .locator('[data-testid="edit-button"], svg.text-text-600')
      .first();
    await editButton.click();

    textarea = userMessage.locator("textarea");
    await textarea.fill("What is 4+4?");

    submitButton = userMessage.locator('button:has-text("Submit")');
    await submitButton.click();
    await page.waitForTimeout(3000);

    // Step 6: Verify navigation between versions
    // Find the switcher showing "3 / 3"
    let switcherSpan = page.locator('span:has-text("3 / 3")').first();
    await expect(switcherSpan).toBeVisible();

    // Navigate to previous version - click the first svg icon's parent (left chevron)
    await switcherSpan
      .locator("..")
      .locator("svg")
      .first()
      .locator("..")
      .click();
    await page.waitForTimeout(1000);

    // Check we're now at "2 / 3"
    switcherSpan = page.locator('span:has-text("2 / 3")').first();
    await expect(switcherSpan).toBeVisible();

    // Navigate to first version - re-find the button each time
    await switcherSpan
      .locator("..")
      .locator("svg")
      .first()
      .locator("..")
      .click();
    await page.waitForTimeout(1000);

    // Check we're now at "1 / 3"
    switcherSpan = page.locator('span:has-text("1 / 3")').first();
    await expect(switcherSpan).toBeVisible();

    // Navigate forward using next button - click the last svg icon's parent (right chevron)
    await switcherSpan
      .locator("..")
      .locator("svg")
      .last()
      .locator("..")
      .click();
    await page.waitForTimeout(1000);

    // Check we're back at "2 / 3"
    switcherSpan = page.locator('span:has-text("2 / 3")').first();
    await expect(switcherSpan).toBeVisible();
  });
});
