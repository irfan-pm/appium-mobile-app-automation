require('dotenv').config();
const { remote } = require('webdriverio');
const assert = require('assert');

const APP_PACKAGE = 'com.metadevzone.hisabkitab360';
const APP_PATH = 'C:\\Users\\Meta Logix\\Downloads\\Hisab_Kitab_360_1.0.13.apk';

const VALID_EMAIL = process.env.VALID_EMAIL;
const VALID_PASSWORD = process.env.VALID_PASSWORD;

const capabilities = {
  platformName: 'Android',
  'appium:deviceName': 'Pixel_6',
  'appium:udid': '18271FDF600ATB',
  'appium:automationName': 'UiAutomator2',
  'appium:app': APP_PATH,
  'appium:noReset': true,
  'appium:autoGrantPermissions': true,
  'appium:newCommandTimeout': 240,
  'appium:androidInstallTimeout': 300000,
  'appium:uiautomator2ServerLaunchTimeout': 90000,
  'appium:uiautomator2ServerInstallTimeout': 90000,
  'appium:adbExecTimeout': 90000,
};

let driver;

// ---------- Locators ----------
const welcomeLoginButton = () => driver.$('~LOGIN'); // also doubles as the login-form submit button
const loginEmailField = () => driver.$('//android.widget.EditText[@hint="Enter your email"]');
const loginPasswordField = () => driver.$('//android.widget.EditText[@hint="Enter your password"]');

const dashboardBrandsShortcut = () => driver.$('~Brands');
const brandsSearchField = () => driver.$('//android.widget.EditText[@hint="Search..."]');
const addBrandButton = () => driver.$('~Add Brand');
const noDataFoundText = () => driver.$('android=new UiSelector().text("No Data Found")');

const brandNameField = () => driver.$('//android.widget.EditText[@hint="Brand Name"]');
const brandDescField = () => driver.$('//android.widget.EditText[@hint="Enter description"]');
const activeToggle = () => driver.$('~Active');
const inactiveToggle = () => driver.$('~Inactive');
const brandSubmitButton = () => driver.$('~Submit');

// ---------- Navigation helpers ----------

async function ensureLoggedInOnDashboard() {
  await driver.terminateApp(APP_PACKAGE);
  await driver.activateApp(APP_PACKAGE);
  const onWelcome = await welcomeLoginButton().waitForDisplayed({ timeout: 8000 }).catch(() => false);
  if (onWelcome) {
    await welcomeLoginButton().click();
    await loginEmailField().waitForDisplayed({ timeout: 10000 });
    await loginEmailField().setValue(VALID_EMAIL);
    await loginPasswordField().setValue(VALID_PASSWORD);
    await welcomeLoginButton().click();
  }
  await dashboardBrandsShortcut().waitForDisplayed({ timeout: 20000 });
}

async function goToBrandsScreen() {
  await ensureLoggedInOnDashboard();
  await dashboardBrandsShortcut().click();
  await addBrandButton().waitForDisplayed({ timeout: 10000 });
}

async function openAddBrandForm() {
  await addBrandButton().click();
  await brandNameField().waitForDisplayed({ timeout: 10000 });
}

async function fillBrandForm({ name, description, status }) {
  if (name !== undefined) {
    const field = brandNameField();
    await field.waitForDisplayed({ timeout: 10000 });
    await field.clearValue().catch(() => {});
    await field.setValue(name);
  }
  if (description !== undefined) {
    await brandDescField().setValue(description);
  }
  if (status === 'Inactive') {
    await inactiveToggle().click();
  } else if (status === 'Active') {
    await activeToggle().click();
  }
}

async function submitBrandForm() {
  await brandSubmitButton().click();
}

async function assertLeftBrandForm() {
  await driver.waitUntil(
    async () => !(await brandNameField().isDisplayed().catch(() => false)),
    { timeout: 15000, timeoutMsg: 'Expected to navigate away from the brand form after a successful submit' }
  );
}

async function assertStillOnBrandForm() {
  await driver.pause(2000);
  const stillThere = await brandNameField().isDisplayed().catch(() => false);
  assert.ok(stillThere, 'Expected to remain on the brand form, but the Brand Name field is gone');
}

// Opens the Edit/Delete context menu for a row identified by its exact visible name, then taps Edit.
async function openEditForBrand(name) {
  const row = driver.$(`android=new UiSelector().text("${name}")`);
  await row.waitForDisplayed({ timeout: 10000 });
  const loc = await row.getLocation();
  await driver.execute('mobile: clickGesture', { x: 999, y: Math.round(loc.y) + 9 });
  const editOption = driver.$('~Edit');
  await editOption.waitForDisplayed({ timeout: 5000 });
  await editOption.click();
  await brandNameField().waitForDisplayed({ timeout: 10000 });
}

async function searchBrands(term) {
  const field = brandsSearchField();
  await field.waitForDisplayed({ timeout: 10000 });
  await field.clearValue().catch(() => {});
  if (term) await field.setValue(term);
  await driver.pause(1500); // list filters as-you-type
}

function uniqueName(prefix) {
  return `${prefix}_${Date.now()}`;
}

describe('Hisab Kitab 360 - Brand (Add/Edit/Search/Filter)', function () {
  this.timeout(180000);

  before(async () => {
    driver = await remote({
      protocol: 'http',
      hostname: '127.0.0.1',
      port: 4723,
      path: '/',
      connectionRetryTimeout: 300000,
      connectionRetryCount: 1,
      capabilities,
    });
  });

  after(async () => {
    if (driver) await driver.deleteSession();
  });

  beforeEach(async () => {
    await goToBrandsScreen();
  });

  // ---------- Navigation ----------

  it('TC01: Dashboard se Brands shortcut Brands screen kholta hai', async () => {
    assert.ok(await addBrandButton().isDisplayed());
    assert.ok(await brandsSearchField().isDisplayed());
  });

  // ---------- Add Brand: positive ----------

  it('TC02: Valid unique name se brand add hota hai', async () => {
    const name = uniqueName('QA_Brand');
    await openAddBrandForm();
    await fillBrandForm({ name });
    await submitBrandForm();
    await assertLeftBrandForm();
    await searchBrands(name);
    assert.ok(await driver.$(`android=new UiSelector().text("${name}")`).isDisplayed());
  });

  it('TC03: Name + description dono ke sath brand add hota hai', async () => {
    const name = uniqueName('QA_Brand_Desc');
    await openAddBrandForm();
    await fillBrandForm({ name, description: 'QA automated description' });
    await submitBrandForm();
    await assertLeftBrandForm();
  });

  it('TC04: Inactive status ke sath brand add hota hai', async () => {
    const name = uniqueName('QA_Brand_Inactive');
    await openAddBrandForm();
    await fillBrandForm({ name, status: 'Inactive' });
    await submitBrandForm();
    await assertLeftBrandForm();
  });

  it('TC05: Naya add kiya brand Search se milta hai', async () => {
    const name = uniqueName('QA_Brand_Findable');
    await openAddBrandForm();
    await fillBrandForm({ name });
    await submitBrandForm();
    await assertLeftBrandForm();
    await searchBrands(name);
    assert.ok(await driver.$(`android=new UiSelector().text("${name}")`).isDisplayed());
  });

  // ---------- Add Brand: negative ----------

  it('TC06: Empty brand name par validation error aani chahiye', async () => {
    await openAddBrandForm();
    await submitBrandForm();
    await assertStillOnBrandForm();
  });

  it('TC07: Sirf whitespace naam par validation error', async () => {
    await openAddBrandForm();
    await fillBrandForm({ name: '   ' });
    await submitBrandForm();
    await assertStillOnBrandForm();
  });

  it('TC08: Bohot lamba naam (300+ chars) crash na kare', async () => {
    await openAddBrandForm();
    await fillBrandForm({ name: uniqueName('QA') + 'a'.repeat(300) });
    await submitBrandForm();
    await driver.pause(2000);
    // Behavior (accept vs reject) unknown ahead of time - just confirm no crash.
    const state = await driver.queryAppState(APP_PACKAGE);
    assert.strictEqual(state, 4, `Expected app to still be running in foreground, got state ${state}`);
  });

  it('TC09: Special characters/emoji naam mein crash na kare', async () => {
    await openAddBrandForm();
    await fillBrandForm({ name: uniqueName('QA') + ' !@#$%^&*()_+😀🔥' });
    await submitBrandForm();
    await driver.pause(2000);
    const state = await driver.queryAppState(APP_PACKAGE);
    assert.strictEqual(state, 4, `Expected app to still be running in foreground, got state ${state}`);
  });

  it('TC10: SQL-injection-style string naam mein crash na kare', async () => {
    await openAddBrandForm();
    await fillBrandForm({ name: `' OR '1'='1` });
    await submitBrandForm();
    await driver.pause(2000);
    const state = await driver.queryAppState(APP_PACKAGE);
    assert.strictEqual(state, 4, `Expected app to still be running in foreground, got state ${state}`);
  });

  it('TC11: Duplicate brand name (behavior verify)', async () => {
    const name = uniqueName('QA_Brand_Dup');
    await openAddBrandForm();
    await fillBrandForm({ name });
    await submitBrandForm();
    await assertLeftBrandForm();

    await openAddBrandForm();
    await fillBrandForm({ name });
    await submitBrandForm();
    await driver.pause(3000);
    const blocked = await brandNameField().isDisplayed().catch(() => false);
    console.log(blocked ? 'Duplicate name REJECTED (stayed on form)' : 'Duplicate name ACCEPTED (allowed)');
  });

  // ---------- Edit Brand: positive ----------

  it('TC12: Brand ka naam edit karne se list mein naya naam reflect hota hai', async () => {
    const original = uniqueName('QA_Brand_Edit');
    await openAddBrandForm();
    await fillBrandForm({ name: original });
    await submitBrandForm();
    await assertLeftBrandForm();

    const updated = original + '_Updated';
    await openEditForBrand(original);
    await fillBrandForm({ name: updated });
    await submitBrandForm();
    await assertLeftBrandForm();

    await searchBrands(updated);
    assert.ok(await driver.$(`android=new UiSelector().text("${updated}")`).isDisplayed());
  });

  it('TC13: Brand ki description edit hoti hai', async () => {
    const name = uniqueName('QA_Brand_EditDesc');
    await openAddBrandForm();
    await fillBrandForm({ name, description: 'original description' });
    await submitBrandForm();
    await assertLeftBrandForm();

    await openEditForBrand(name);
    await fillBrandForm({ description: 'updated description' });
    await submitBrandForm();
    await assertLeftBrandForm();
  });

  it('TC14: Edit ke doraan status Active se Inactive toggle hota hai', async () => {
    const name = uniqueName('QA_Brand_EditStatus');
    await openAddBrandForm();
    await fillBrandForm({ name, status: 'Active' });
    await submitBrandForm();
    await assertLeftBrandForm();

    await openEditForBrand(name);
    await fillBrandForm({ status: 'Inactive' });
    await submitBrandForm();
    await assertLeftBrandForm();
  });

  // ---------- Edit Brand: negative ----------

  it('TC15: Edit ke doraan naam empty kar ke submit karne par validation error', async () => {
    const name = uniqueName('QA_Brand_EditEmpty');
    await openAddBrandForm();
    await fillBrandForm({ name });
    await submitBrandForm();
    await assertLeftBrandForm();

    await openEditForBrand(name);
    await fillBrandForm({ name: '' });
    await submitBrandForm();
    await assertStillOnBrandForm();
  });

  it('TC16: Edit ke doraan sirf whitespace naam par validation error', async () => {
    const name = uniqueName('QA_Brand_EditWs');
    await openAddBrandForm();
    await fillBrandForm({ name });
    await submitBrandForm();
    await assertLeftBrandForm();

    await openEditForBrand(name);
    await fillBrandForm({ name: '   ' });
    await submitBrandForm();
    await assertStillOnBrandForm();
  });

  // ---------- Search ----------

  it('TC17: Exact brand name search karne se sirf wahi brand milta hai', async () => {
    const name = uniqueName('QA_Brand_ExactSearch');
    await openAddBrandForm();
    await fillBrandForm({ name });
    await submitBrandForm();
    await assertLeftBrandForm();

    await searchBrands(name);
    assert.ok(await driver.$(`android=new UiSelector().text("${name}")`).isDisplayed());
  });

  it('TC18: Partial substring search se matching brand milta hai', async () => {
    const name = uniqueName('QA_Brand_Partial');
    await openAddBrandForm();
    await fillBrandForm({ name });
    await submitBrandForm();
    await assertLeftBrandForm();

    await searchBrands('QA_Brand_Partial');
    assert.ok(await driver.$(`android=new UiSelector().text("${name}")`).isDisplayed());
  });

  it('TC19: Non-existent brand search karne par "No Data Found" dikhta hai', async () => {
    await searchBrands(`NoSuchBrand_${Date.now()}`);
    assert.ok(await noDataFoundText().isDisplayed());
  });

  it('TC20: Search clear karne se pura list wapas aa jata hai', async () => {
    await searchBrands(`NoSuchBrand_${Date.now()}`);
    assert.ok(await noDataFoundText().isDisplayed());

    await searchBrands('');
    await driver.pause(1000);
    const emptyStateGone = !(await noDataFoundText().isDisplayed().catch(() => false));
    assert.ok(emptyStateGone, 'Expected the full brand list to return after clearing search');
  });

  // ---------- Filter ----------

  it('TC21: "Today" filter tap karna crash na kare (behavior verify)', async () => {
    const todayChip = driver.$('~Today');
    await todayChip.waitForDisplayed({ timeout: 10000 });
    await todayChip.click();
    await driver.pause(2000);
    const state = await driver.queryAppState(APP_PACKAGE);
    assert.strictEqual(state, 4, `Expected app to still be running in foreground, got state ${state}`);
    console.log('NOTE: verify manually whether "Today" actually excludes brands not created today.');
  });

  it('TC22: "Current Month" filter tap karne se is mahine ke brands dikhte hain', async () => {
    const name = uniqueName('QA_Brand_ThisMonth');
    await openAddBrandForm();
    await fillBrandForm({ name });
    await submitBrandForm();
    await assertLeftBrandForm();

    const currentMonthChip = driver.$('~Current Month');
    await currentMonthChip.waitForDisplayed({ timeout: 10000 });
    await currentMonthChip.click();
    await driver.pause(2000);
    assert.ok(await driver.$(`android=new UiSelector().text("${name}")`).isDisplayed());
  });
});
