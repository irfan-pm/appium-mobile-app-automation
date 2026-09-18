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

// Email/password fields have no resource-id in this app, only a hint - locate by hint via xpath.
const emailField = () => driver.$('//android.widget.EditText[@hint="Enter your email"]');
const passwordField = () => driver.$('//android.widget.EditText[@hint="Enter your password"]');
const welcomeLoginButton = () => driver.$('~LOGIN'); // used both as welcome nav button and login-form submit button, only one is on screen at a time
const welcomeSignUpButton = () => driver.$('~SIGN UP');
const forgotPasswordLink = () => driver.$('~Forgot Password?');
const loginScreenSignUpLink = () => driver.$('~Sign Up');

async function relaunchApp() {
  await driver.terminateApp(APP_PACKAGE);
  await driver.activateApp(APP_PACKAGE);
  const onWelcome = await welcomeLoginButton().waitForDisplayed({ timeout: 15000 }).catch(() => false);
  if (!onWelcome) {
    // A previous test left an active session (e.g. successful login) - wipe app data so we're back at Welcome/logged-out.
    await driver.execute('mobile: clearApp', { appId: APP_PACKAGE });
    await driver.activateApp(APP_PACKAGE);
    await welcomeLoginButton().waitForDisplayed({ timeout: 15000 });
  }
}

async function goToLoginForm() {
  await relaunchApp();
  await welcomeLoginButton().click();
  await emailField().waitForDisplayed({ timeout: 10000 });
}

async function fillLoginForm(email, password) {
  if (email !== null) {
    const field = emailField();
    await field.waitForDisplayed({ timeout: 10000 });
    await field.setValue(email);
  }
  if (password !== null) {
    const field = passwordField();
    await field.waitForDisplayed({ timeout: 10000 });
    await field.setValue(password);
  }
}

async function submitLogin() {
  await welcomeLoginButton().click();
}

// After a failed/invalid login attempt we expect to still be on the login form.
async function assertStillOnLoginForm() {
  await driver.pause(2000);
  const stillThere = await emailField().isDisplayed().catch(() => false);
  assert.ok(stillThere, 'Expected to remain on the login form, but email field is gone');
}

// After a successful login we expect to have left the login form.
async function assertLeftLoginForm() {
  await driver.waitUntil(
    async () => !(await emailField().isDisplayed().catch(() => false)),
    { timeout: 15000, timeoutMsg: 'Expected to navigate away from the login form after successful login' }
  );
}

describe('Hisab Kitab 360 - Login', function () {
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

  beforeEach(async function () {
    // TC20 deliberately continues from the logged-in state TC19 leaves behind - skip the reset.
    if (this.currentTest.title.startsWith('TC20')) return;
    await goToLoginForm();
  });

  // ---------- UI / Navigation ----------

  it('TC01: App launch par Welcome screen aata hai (SIGN UP + LOGIN buttons)', async () => {
    await relaunchApp();
    assert.ok(await welcomeLoginButton().isDisplayed());
    assert.ok(await welcomeSignUpButton().isDisplayed());
  });

  it('TC02: Welcome screen se LOGIN tap karne par Login form khulta hai', async () => {
    // beforeEach already navigates here; just confirm the form is up
    assert.ok(await emailField().isDisplayed());
    assert.ok(await passwordField().isDisplayed());
  });

  it('TC03: Login form ke sab elements visible hain', async () => {
    assert.ok(await emailField().isDisplayed());
    assert.ok(await passwordField().isDisplayed());
    assert.ok(await welcomeLoginButton().isDisplayed());
    assert.ok(await forgotPasswordLink().isDisplayed());
    assert.ok(await loginScreenSignUpLink().isDisplayed());
  });

  it('TC04: Password field masked/secure hai', async () => {
    const pwd = passwordField();
    await pwd.waitForDisplayed();
    const isPassword = await pwd.getAttribute('password');
    assert.strictEqual(isPassword, 'true');
  });

  // ---------- Negative: validation ----------

  it('TC05: Empty email + empty password par validation error aani chahiye', async () => {
    await submitLogin();
    await assertStillOnLoginForm();
  });

  it('TC06: Valid email + empty password par validation error', async () => {
    await fillLoginForm(VALID_EMAIL, null);
    await submitLogin();
    await assertStillOnLoginForm();
  });

  it('TC07: Empty email + valid password par validation error', async () => {
    await fillLoginForm(null, VALID_PASSWORD);
    await submitLogin();
    await assertStillOnLoginForm();
  });

  it('TC08: Invalid email format ("@" missing) par validation error', async () => {
    await fillLoginForm('cmsgmail.com', VALID_PASSWORD);
    await submitLogin();
    await assertStillOnLoginForm();
  });

  it('TC09: Invalid email format (incomplete domain) par validation error', async () => {
    await fillLoginForm('cms@gmail', VALID_PASSWORD);
    await submitLogin();
    await assertStillOnLoginForm();
  });

  it('TC10: Sirf whitespace email/password par validation error', async () => {
    await fillLoginForm('   ', '   ');
    await submitLogin();
    await assertStillOnLoginForm();
  });

  // ---------- Negative: wrong credentials ----------

  it('TC11: Valid format email + wrong password par error', async () => {
    await fillLoginForm(VALID_EMAIL, 'wrongPassword123');
    await submitLogin();
    await assertStillOnLoginForm();
  });

  it('TC12: Unregistered email + koi bhi password par error', async () => {
    await fillLoginForm(`no-such-user-${Date.now()}@gmail.com`, VALID_PASSWORD);
    await submitLogin();
    await assertStillOnLoginForm();
  });

  // ---------- Negative: robustness ----------

  it('TC13: SQL-injection-style string email field mein crash na kare', async () => {
    await fillLoginForm(`' OR '1'='1`, VALID_PASSWORD);
    await submitLogin();
    await assertStillOnLoginForm();
  });

  it('TC14: Bohot lamba string (300+ chars) crash na kare', async () => {
    const longString = 'a'.repeat(300) + '@gmail.com';
    await fillLoginForm(longString, 'p'.repeat(300));
    await submitLogin();
    await assertStillOnLoginForm();
  });

  it('TC15: Special characters/emoji password mein crash na kare', async () => {
    await fillLoginForm(VALID_EMAIL, '!@#$%^&*()_+😀🔥');
    await submitLogin();
    await assertStillOnLoginForm();
  });

  // ---------- Negative: interaction ----------

  it('TC16: LOGIN button par rapid multiple taps se crash/duplicate na ho', async () => {
    await fillLoginForm(VALID_EMAIL, 'wrongPassword123');
    const btn = welcomeLoginButton();
    await btn.waitForDisplayed();
    await btn.click();
    await btn.click().catch(() => {});
    await btn.click().catch(() => {});
    await driver.pause(3000);
    const state = await driver.queryAppState(APP_PACKAGE);
    assert.strictEqual(state, 4, `Expected app to still be running in foreground, got state ${state}`);
  });

  it('TC17: Back button se Welcome screen par wapas jaye, crash na ho', async () => {
    await driver.back();
    await driver.pause(2000);
    assert.ok(await welcomeLoginButton().isDisplayed());
  });

  // ---------- Behavior check (may itself succeed in logging in) ----------

  it('TC18: Correct email different case + correct password (behavior verify)', async () => {
    await fillLoginForm(VALID_EMAIL.toUpperCase(), VALID_PASSWORD);
    await submitLogin();
    await driver.pause(3000);
    const stillOnLogin = await emailField().isDisplayed().catch(() => false);
    console.log(stillOnLogin ? 'Uppercase email rejected (case-sensitive)' : 'Uppercase email accepted (case-insensitive)');
  });

  // ---------- Positive - run last so a successful, persisted login doesn't break earlier cases ----------

  it('TC19: Valid email + valid password se login successful hota hai', async () => {
    await fillLoginForm(VALID_EMAIL, VALID_PASSWORD);
    await submitLogin();
    await assertLeftLoginForm();
  });

  it('TC20: App relaunch ke baad bhi session persist (TC19 ke turant baad, koi reset nahi)', async () => {
    await driver.terminateApp(APP_PACKAGE);
    await driver.activateApp(APP_PACKAGE);
    await driver.pause(3000);
    const backOnLogin = await emailField().isDisplayed().catch(() => false);
    assert.strictEqual(backOnLogin, false, 'Expected session to persist after relaunch (login screen should not reappear)');
  });
});
