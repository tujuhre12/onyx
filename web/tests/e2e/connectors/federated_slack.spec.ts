import { test, expect } from "@chromatic-com/playwright";
import type { Page } from "@playwright/test";
import { loginAs, loginAsRandomUser } from "../utils/auth";

test.use({ storageState: "admin_auth.json" });

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID || "";
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET || "";

async function createFederatedSlackConnector(page: Page) {
  // Navigate to add connector page
  await page.goto("http://localhost:3000/admin/add-connector");
  await page.waitForLoadState("networkidle");

  // Click on Slack connector tile (specifically the one with "Logo Slack" text, not "Slack Bots")
  await page.getByRole("link", { name: "Logo Slack" }).first().click();
  await page.waitForLoadState("networkidle");

  // Fill in the client ID and client secret
  await page.getByLabel(/client id/i).fill(SLACK_CLIENT_ID);
  await page.getByLabel(/client secret/i).fill(SLACK_CLIENT_SECRET);

  // Submit the form to create or update the federated connector
  const createOrUpdateButton = await page.getByRole("button", {
    name: /create|update/i,
  });
  await createOrUpdateButton.click();

  // Wait for success message or redirect
  await page.waitForTimeout(2000);
}

async function navigateToUserSettings(page: Page) {
  // Wait for any existing modals to close
  await page.waitForTimeout(1000);

  // Wait for potential modal backdrop to disappear
  await page
    .waitForSelector(".fixed.inset-0.bg-neutral-950\\/50", {
      state: "detached",
      timeout: 5000,
    })
    .catch(() => {});

  // Click on user dropdown/settings button
  await page.locator("#onyx-user-dropdown").click();

  // Click on settings option
  await page.getByText("User Settings").click();

  // Wait for settings modal to appear
  await expect(page.locator("h2", { hasText: "User Settings" })).toBeVisible();
}

async function openConnectorsTab(page: Page) {
  // Click on the Connectors tab in user settings
  await page.getByRole("button", { name: "Connectors" }).click();

  // Wait for connectors section to be visible
  // Allow multiple instances of "Connected Services" to be visible
  const connectedServicesLocators = page.getByText("Connected Services");
  await expect(connectedServicesLocators.first()).toBeVisible();
}

test("Federated Slack Connector - Create, OAuth Modal, and User Settings Flow", async ({
  page,
}) => {
  // Setup: Clear cookies and log in as admin
  await page.context().clearCookies();
  await loginAs(page, "admin");

  // Create a federated Slack connector in admin panel
  await createFederatedSlackConnector(page);

  // Log in as a random user
  await page.context().clearCookies();
  await loginAsRandomUser(page);

  // Navigate back to main page and verify OAuth modal appears
  await page.goto("http://localhost:3000/chat");
  await page.waitForLoadState("networkidle");

  // Check if the OAuth modal appears
  await expect(
    page.getByText(/improve answer quality by letting/i)
  ).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/slack/i)).toBeVisible();

  // Decline the OAuth connection
  await page.getByRole("button", { name: "Skip for now" }).click();

  // Wait for modal to disappear
  await expect(
    page.getByText(/improve answer quality by letting/i)
  ).not.toBeVisible();

  // Go to user settings and verify the connector appears
  await navigateToUserSettings(page);
  await openConnectorsTab(page);

  // Verify Slack connector appears in the federated connectors section
  await expect(page.getByText("Federated Connectors")).toBeVisible();
  await expect(page.getByText("Slack")).toBeVisible();
  await expect(page.getByText("Not connected")).toBeVisible();

  // Verify there's a Connect button available
  await expect(page.locator("button", { hasText: /^Connect$/ })).toBeVisible();
});
