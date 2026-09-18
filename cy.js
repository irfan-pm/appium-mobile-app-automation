const { remote } = require('webdriverio');

const APP_PATH = 'C:\\Users\\Meta Logix\\Downloads\\Hisab_Kitab_360_1.0.13.apk';

const capabilities = {
  platformName: 'Android',
  'appium:deviceName': 'Pixel_6',
  'appium:udid': '18271FDF600ATB', // `adb devices` se apna real device ka serial
  'appium:automationName': 'UiAutomator2',
  'appium:app': APP_PATH,
  'appium:noReset': true, // app pehle se installed hai, dobara install skip karo
  'appium:autoGrantPermissions': true,
  'appium:newCommandTimeout': 240,
  'appium:androidInstallTimeout': 300000, // bari APK ke liye zyada waqt
  'appium:uiautomator2ServerLaunchTimeout': 90000,
  'appium:uiautomator2ServerInstallTimeout': 90000,
  'appium:adbExecTimeout': 90000,
};

async function main() {
  const driver = await remote({
    protocol: 'http',
    hostname: '127.0.0.1',
    port: 4723,
    path: '/',
    connectionRetryTimeout: 300000, // client 2min pe hi retry na kare
    connectionRetryCount: 1,
    capabilities,
  });

  try {
    // TODO: Appium Inspector se apne app ke real elements ka locator lo aur yahan replace karo
    // const element = await driver.$('~someAccessibilityId');
    // await element.waitForDisplayed({ timeout: 5000 });
    // await element.click();

    console.log('App launch ho gayi, session active hai.');
    await driver.pause(5000);
  } finally {
    await driver.deleteSession();
  }
}

main().catch((err) => {
  console.error('Test fail ho gaya:', err);
  process.exit(1);
});
