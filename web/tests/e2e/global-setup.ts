import { chromium, FullConfig } from "@playwright/test";
import { inviteAdmin2AsAdmin1, loginAs } from "./utils/auth";

async function globalSetup(config: FullConfig) {
  const browser = await chromium.launch();

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await loginAs(adminPage, "admin");
  // await inviteAdmin2AsAdmin1(adminPage);
  await adminContext.storageState({ path: "admin_auth.json" });
  await adminContext.close();

  const userContext = await browser.newContext();
  const userPage = await userContext.newPage();
  await loginAs(userPage, "user");
  await userContext.storageState({ path: "user_auth.json" });
  await userContext.close();

  const admin2Context = await browser.newContext();
  const admin2Page = await admin2Context.newPage();
  await loginAs(admin2Page, "admin2");
  await admin2Context.storageState({ path: "admin2_auth.json" });
  await admin2Context.close();

  const adminContext2 = await browser.newContext({
    storageState: "admin_auth.json",
  });
  const adminPage2 = await adminContext2.newPage();
  await inviteAdmin2AsAdmin1(adminPage2);
  await adminContext2.close();

  await browser.close();
}

export default globalSetup;
