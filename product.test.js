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

const dashboardProductsShortcut = () => driver.$('~Products');
const productsSearchField = () => driver.$('//android.widget.EditText[@hint="Search..."]');
const addProductButton = () => driver.$('~Add Product');
const noProductsText = () => driver.$('android=new UiSelector().text("No Products Available")');

const nameField = () => driver.$('//android.widget.EditText[@hint="Enter product name"]');
const codeField = () => driver.$('//android.widget.EditText[@hint="Code"]');
const descField = () => driver.$('//android.widget.EditText[@hint="write about product"]');
// Purchase/Sale/Wholesale/Dealer price all share the same hint ("10.00") - index into them in form order.
const priceFields = () => driver.$$('//android.widget.EditText[@hint="10.00"]');
const salePriceField = async () => (await priceFields())[1];
const activeToggle = () => driver.$('~Active');
const inactiveToggle = () => driver.$('~Inactive');
const saveButton = () => driver.$('~Save');

const productDetailHeader = () => driver.$('android=new UiSelector().text("Product Detail")');
const overviewTab = () => driver.$('~Overview');
const purchaseHistoryTab = () => driver.$('~Purchase History');
const saleHistoryTab = () => driver.$('~Sale History');
const stockAdjustmentTab = () => driver.$('~Stock Adjustment');

const editMenuOption = () => driver.$('~Edit');
const deleteMenuOption = () => driver.$('~Delete');
const deleteConfirmYes = () => driver.$('~Yes');
const deleteConfirmNo = () => driver.$('~No');

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
  await dashboardProductsShortcut().waitForDisplayed({ timeout: 20000 });
}

async function goToProductsScreen() {
  await ensureLoggedInOnDashboard();
  await dashboardProductsShortcut().click();
  await addProductButton().waitForDisplayed({ timeout: 10000 });
}

async function openAddProductForm() {
  await addProductButton().click();
  await nameField().waitForDisplayed({ timeout: 10000 });
}

async function fillProductForm({ name, code, description, salePrice, status }) {
  if (name !== undefined) {
    const field = nameField();
    await field.waitForDisplayed({ timeout: 10000 });
    await field.clearValue().catch(() => {});
    await field.setValue(name);
  }
  if (code !== undefined) {
    await codeField().setValue(code);
  }
  if (description !== undefined) {
    await descField().setValue(description);
  }
  if (salePrice !== undefined) {
    const field = await salePriceField();
    await field.clearValue().catch(() => {});
    await field.setValue(salePrice);
  }
  if (status === 'Inactive') {
    await inactiveToggle().click();
  } else if (status === 'Active') {
    await activeToggle().click();
  }
}

async function submitProductForm() {
  await saveButton().click();
}

async function assertLeftProductForm() {
  await driver.waitUntil(
    async () => !(await nameField().isDisplayed().catch(() => false)),
    { timeout: 15000, timeoutMsg: 'Expected to navigate away from the product form after a successful save' }
  );
}

async function assertStillOnProductForm() {
  await driver.pause(2000);
  const stillThere = await nameField().isDisplayed().catch(() => false);
  assert.ok(stillThere, 'Expected to remain on the product form, but the Name field is gone');
}

async function openProductDetail(name) {
  const row = driver.$(`android=new UiSelector().textContains("${name}")`);
  await row.waitForDisplayed({ timeout: 10000 });
  await row.click();
  await productDetailHeader().waitForDisplayed({ timeout: 10000 });
}

// Taps the pencil/menu icon near the top-right of the pricing block on Product Detail.
async function openDetailActionsMenu() {
  await driver.execute('mobile: clickGesture', { x: 999, y: 548 });
  await editMenuOption().waitForDisplayed({ timeout: 5000 });
}

async function searchProducts(term) {
  const field = productsSearchField();
  await field.waitForDisplayed({ timeout: 10000 });
  await field.clearValue().catch(() => {});
  if (term) await field.setValue(term);
  await driver.pause(1500);
}

function uniqueName(prefix) {
  return `${prefix}_${Date.now()}`;
}

describe('Hisab Kitab 360 - Product (Add/Edit/Delete/Detail/Search/Filter)', function () {
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
    await goToProductsScreen();
  });

  // ---------- Navigation ----------

  it('TC01: Dashboard se Products shortcut Products screen kholta hai', async () => {
    assert.ok(await addProductButton().isDisplayed());
    assert.ok(await productsSearchField().isDisplayed());
  });

  // ---------- Add Product: positive ----------

  it('TC02: Valid name + valid price se product add hota hai', async () => {
    const name = uniqueName('QA_Product');
    await openAddProductForm();
    await fillProductForm({ name, salePrice: '50' });
    await submitProductForm();
    await assertLeftProductForm();
    await searchProducts(name);
    assert.ok(await driver.$(`android=new UiSelector().textContains("${name}")`).isDisplayed());
  });

  it('TC03: Code + description ke sath product add hota hai', async () => {
    const name = uniqueName('QA_Product_Full');
    await openAddProductForm();
    await fillProductForm({ name, code: `CODE${Date.now()}`, description: 'QA automated product', salePrice: '50' });
    await submitProductForm();
    await assertLeftProductForm();
  });

  it('TC04: Inactive status ke sath product add hota hai', async () => {
    const name = uniqueName('QA_Product_Inactive');
    await openAddProductForm();
    await fillProductForm({ name, status: 'Inactive', salePrice: '50' });
    await submitProductForm();
    await assertLeftProductForm();
  });

  it('TC05: Naya add kiya product Search se milta hai', async () => {
    const name = uniqueName('QA_Product_Findable');
    await openAddProductForm();
    await fillProductForm({ name, salePrice: '50' });
    await submitProductForm();
    await assertLeftProductForm();
    await searchProducts(name);
    assert.ok(await driver.$(`android=new UiSelector().textContains("${name}")`).isDisplayed());
  });

  // ---------- Add Product: negative ----------

  it('TC06: Empty product name par validation error aani chahiye', async () => {
    await openAddProductForm();
    await submitProductForm();
    await assertStillOnProductForm();
  });

  it('TC07: Sirf whitespace naam par behavior verify', async () => {
    await openAddProductForm();
    await fillProductForm({ name: '   ', salePrice: '50' });
    await submitProductForm();
    await driver.pause(2000);
    const blocked = await nameField().isDisplayed().catch(() => false);
    console.log(blocked ? 'Whitespace-only name REJECTED' : 'Whitespace-only name ACCEPTED (possible validation gap)');
  });

  it('TC08: Sale Price khali kar ke submit karne par behavior verify', async () => {
    const name = uniqueName('QA_Product_NoPrice');
    await openAddProductForm();
    await fillProductForm({ name });
    const field = await salePriceField();
    await field.clearValue().catch(() => {});
    await submitProductForm();
    await driver.pause(2000);
    const blocked = await nameField().isDisplayed().catch(() => false);
    console.log(blocked ? 'Empty Sale Price REJECTED' : 'Empty Sale Price ACCEPTED (check default applied)');
  });

  it('TC09: Bohot lamba naam (300+ chars) crash na kare', async () => {
    await openAddProductForm();
    await fillProductForm({ name: uniqueName('QA') + 'a'.repeat(300), salePrice: '50' });
    await submitProductForm();
    await driver.pause(2000);
    const state = await driver.queryAppState(APP_PACKAGE);
    assert.strictEqual(state, 4, `Expected app to still be running in foreground, got state ${state}`);
  });

  it('TC10: Special characters/emoji naam mein crash na kare', async () => {
    await openAddProductForm();
    await fillProductForm({ name: uniqueName('QA') + ' !@#$%^&*()_+😀🔥', salePrice: '50' });
    await submitProductForm();
    await driver.pause(2000);
    const state = await driver.queryAppState(APP_PACKAGE);
    assert.strictEqual(state, 4, `Expected app to still be running in foreground, got state ${state}`);
  });

  it('TC11: SQL-injection-style string naam mein crash na kare', async () => {
    await openAddProductForm();
    await fillProductForm({ name: `' OR '1'='1`, salePrice: '50' });
    await submitProductForm();
    await driver.pause(2000);
    const state = await driver.queryAppState(APP_PACKAGE);
    assert.strictEqual(state, 4, `Expected app to still be running in foreground, got state ${state}`);
  });

  // ---------- Edit Product: positive ----------

  it('TC12: Product ka naam edit karne se list mein naya naam reflect hota hai', async () => {
    const original = uniqueName('QA_Product_Edit');
    await openAddProductForm();
    await fillProductForm({ name: original, salePrice: '50' });
    await submitProductForm();
    await assertLeftProductForm();

    await openProductDetail(original);
    await openDetailActionsMenu();
    await editMenuOption().click();
    await nameField().waitForDisplayed({ timeout: 10000 });

    const updated = original + '_Updated';
    await fillProductForm({ name: updated });
    await submitProductForm();
    await assertLeftProductForm();

    // Saving from Edit returns to Product Detail (not the list), so verify the new name right here.
    assert.ok(await driver.$(`android=new UiSelector().textContains("${updated}")`).isDisplayed());
  });

  it('TC13: Product ki sale price edit hoti hai', async () => {
    const name = uniqueName('QA_Product_EditPrice');
    await openAddProductForm();
    await fillProductForm({ name, salePrice: '50' });
    await submitProductForm();
    await assertLeftProductForm();

    await openProductDetail(name);
    await openDetailActionsMenu();
    await editMenuOption().click();
    await nameField().waitForDisplayed({ timeout: 10000 });

    await fillProductForm({ salePrice: '75' });
    await submitProductForm();
    await assertLeftProductForm();
  });

  it('TC14: Edit ke doraan status Active se Inactive toggle hota hai', async () => {
    const name = uniqueName('QA_Product_EditStatus');
    await openAddProductForm();
    await fillProductForm({ name, status: 'Active', salePrice: '50' });
    await submitProductForm();
    await assertLeftProductForm();

    await openProductDetail(name);
    await openDetailActionsMenu();
    await editMenuOption().click();
    await nameField().waitForDisplayed({ timeout: 10000 });

    await fillProductForm({ status: 'Inactive' });
    await submitProductForm();
    await assertLeftProductForm();
  });

  // ---------- Edit Product: negative ----------

  it('TC15: Edit ke doraan naam empty kar ke submit karne par validation error', async () => {
    const name = uniqueName('QA_Product_EditEmpty');
    await openAddProductForm();
    await fillProductForm({ name, salePrice: '50' });
    await submitProductForm();
    await assertLeftProductForm();

    await openProductDetail(name);
    await openDetailActionsMenu();
    await editMenuOption().click();
    await nameField().waitForDisplayed({ timeout: 10000 });

    await fillProductForm({ name: '' });
    await submitProductForm();
    await assertStillOnProductForm();
  });

  it('TC16: Edit ke doraan sale price empty kar ke submit karne par behavior verify', async () => {
    const name = uniqueName('QA_Product_EditNoPrice');
    await openAddProductForm();
    await fillProductForm({ name, salePrice: '50' });
    await submitProductForm();
    await assertLeftProductForm();

    await openProductDetail(name);
    await openDetailActionsMenu();
    await editMenuOption().click();
    await nameField().waitForDisplayed({ timeout: 10000 });

    const field = await salePriceField();
    await field.clearValue().catch(() => {});
    await submitProductForm();
    await driver.pause(2000);
    const blocked = await nameField().isDisplayed().catch(() => false);
    console.log(blocked ? 'Empty Sale Price on edit REJECTED' : 'Empty Sale Price on edit ACCEPTED');
  });

  // ---------- Detail ----------

  it('TC17: Product row tap karne se Product Detail screen sahi naam ke sath khulta hai', async () => {
    const name = uniqueName('QA_Product_Detail');
    await openAddProductForm();
    await fillProductForm({ name, salePrice: '50' });
    await submitProductForm();
    await assertLeftProductForm();

    await openProductDetail(name);
    assert.ok(await productDetailHeader().isDisplayed());
    assert.ok(await driver.$(`android=new UiSelector().textContains("${name}")`).isDisplayed());
  });

  it('TC18: Detail screen ke tabs (Overview/Purchase/Sale/Stock) crash ke bina tappable hain', async () => {
    const name = uniqueName('QA_Product_Tabs');
    await openAddProductForm();
    await fillProductForm({ name, salePrice: '50' });
    await submitProductForm();
    await assertLeftProductForm();

    await openProductDetail(name);
    assert.ok(await overviewTab().isDisplayed());
    await purchaseHistoryTab().click();
    await driver.pause(1000);
    await saleHistoryTab().click();
    await driver.pause(1000);
    await stockAdjustmentTab().click();
    await driver.pause(1000);
    const state = await driver.queryAppState(APP_PACKAGE);
    assert.strictEqual(state, 4, `Expected app to still be running in foreground, got state ${state}`);
  });

  // ---------- Delete ----------

  it('TC19: Delete confirmation par "No" tap karne se product delete nahi hota', async () => {
    const name = uniqueName('QA_Product_CancelDelete');
    await openAddProductForm();
    await fillProductForm({ name, salePrice: '50' });
    await submitProductForm();
    await assertLeftProductForm();

    await openProductDetail(name);
    await openDetailActionsMenu();
    await deleteMenuOption().click();
    await deleteConfirmNo().waitForDisplayed({ timeout: 5000 });
    await deleteConfirmNo().click();
    await driver.pause(1500);

    // Cancelling stays on Product Detail (not the list), so verify the name is still shown right here.
    assert.ok(await driver.$(`android=new UiSelector().textContains("${name}")`).isDisplayed());
  });

  it('TC20: Delete confirmation par "Yes" tap karne se product delete ho jata hai', async () => {
    const name = uniqueName('QA_Product_ConfirmDelete');
    await openAddProductForm();
    await fillProductForm({ name, salePrice: '50' });
    await submitProductForm();
    await assertLeftProductForm();

    await openProductDetail(name);
    await openDetailActionsMenu();
    await deleteMenuOption().click();
    await deleteConfirmYes().waitForDisplayed({ timeout: 5000 });
    await deleteConfirmYes().click();
    await driver.pause(3000);

    await searchProducts(name);
    await driver.waitUntil(async () => noProductsText().isDisplayed(), {
      timeout: 10000,
      interval: 1000,
      timeoutMsg: 'Expected deleted product to no longer be found',
    });
  });

  // ---------- Search ----------

  it('TC21: Exact product name search karne se sahi product milta hai', async () => {
    const name = uniqueName('QA_Product_ExactSearch');
    await openAddProductForm();
    await fillProductForm({ name, salePrice: '50' });
    await submitProductForm();
    await assertLeftProductForm();

    await searchProducts(name);
    assert.ok(await driver.$(`android=new UiSelector().textContains("${name}")`).isDisplayed());
  });

  it('TC22: Non-existent product search karne par "No Data Found" dikhta hai', async () => {
    await searchProducts(`NoSuchProduct_${Date.now()}`);
    assert.ok(await noProductsText().isDisplayed());
  });

  it('TC23: Search clear karne se pura list wapas aa jata hai', async () => {
    await searchProducts(`NoSuchProduct_${Date.now()}`);
    assert.ok(await noProductsText().isDisplayed());

    await searchProducts('');
    await driver.pause(1000);
    const emptyStateGone = !(await noProductsText().isDisplayed().catch(() => false));
    assert.ok(emptyStateGone, 'Expected the full product list to return after clearing search');
  });

  // ---------- Filter ----------

  it('TC24: "Current Month" filter tap karne se is mahine ke products dikhte hain', async () => {
    const name = uniqueName('QA_Product_ThisMonth');
    await openAddProductForm();
    await fillProductForm({ name, salePrice: '50' });
    await submitProductForm();
    await assertLeftProductForm();

    const currentMonthChip = driver.$('~Current Month');
    await currentMonthChip.waitForDisplayed({ timeout: 10000 });
    await currentMonthChip.click();
    await driver.pause(2000);
    assert.ok(await driver.$(`android=new UiSelector().textContains("${name}")`).isDisplayed());
  });
});
