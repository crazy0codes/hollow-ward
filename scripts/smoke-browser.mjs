import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const baseURL = 'http://127.0.0.1:4173';
const server = spawn(process.execPath, [
  'node_modules/vite/bin/vite.js', 'preview',
  '--host', '127.0.0.1', '--port', '4173', '--strictPort',
], { stdio: 'inherit', env: process.env });
let browser;
const pageErrors = [];
async function waitForServer() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error('Vite preview exited early with code ' + server.exitCode);
    try {
      const response = await fetch(baseURL);
      if (response.ok) return;
    } catch { /* server is still starting */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Vite preview did not start within 30 seconds');
}
try {
  await waitForServer();
  browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', error => pageErrors.push(error.stack || error.message));
  await page.goto(baseURL + '/?smokeTest=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__HOLLOW_WARD__?.ready === true, null, { timeout: 30000 }).catch(async error => {
    const diagnostic = await page.evaluate(() => ({
      debug: window.__HOLLOW_WARD__ ? {
        ready: window.__HOLLOW_WARD__.ready,
        error: window.__HOLLOW_WARD__.error,
        state: window.__HOLLOW_WARD__.state,
      } : null,
      loadingText: document.querySelector('#loading-screen')?.innerText,
      story: document.querySelector('.story-card')?.innerText,
    }));
    throw new Error('Game failed to initialise: ' + JSON.stringify(diagnostic) + '\n' + error.message);
  });

  await page.locator('#start-button').click();
  await page.waitForFunction(() => window.__HOLLOW_WARD__?.state === 'playing', null, { timeout: 5000 });
  await page.waitForTimeout(250);
  const before = await page.evaluate(() => window.__HOLLOW_WARD__.playerPosition);
  await page.keyboard.down('w');
  await page.waitForTimeout(1200);
  const forwardSample = await page.evaluate(() => ({ pos: window.__HOLLOW_WARD__.playerPosition, keys: window.__HOLLOW_WARD__.inputKeys, desired: window.__HOLLOW_WARD__.desiredMovement, actual: window.__HOLLOW_WARD__.actualMovement, locked: window.__HOLLOW_WARD__.pointerLocked, facing: window.__HOLLOW_WARD__.facing, collisions: window.__HOLLOW_WARD__.collisions }));
  await page.keyboard.up('w');
  await page.waitForTimeout(150);
  const afterForward = await page.evaluate(() => window.__HOLLOW_WARD__.playerPosition);
  const forwardDistance = Math.hypot(afterForward.x - before.x, afterForward.z - before.z);
  if (forwardDistance < 0.5) {
    throw new Error('WASD movement failed: before=' + JSON.stringify(before) + ', after=' + JSON.stringify(afterForward) + ', sample=' + JSON.stringify(forwardSample) + ', pageErrors=' + JSON.stringify(pageErrors));
  }

  await page.keyboard.down('d');
  await page.waitForTimeout(900);
  const rightSample = await page.evaluate(() => ({ pos: window.__HOLLOW_WARD__.playerPosition, keys: window.__HOLLOW_WARD__.inputKeys, desired: window.__HOLLOW_WARD__.desiredMovement, actual: window.__HOLLOW_WARD__.actualMovement, locked: window.__HOLLOW_WARD__.pointerLocked, facing: window.__HOLLOW_WARD__.facing, collisions: window.__HOLLOW_WARD__.collisions }));
  await page.keyboard.up('d');
  const afterRight = await page.evaluate(() => window.__HOLLOW_WARD__.playerPosition);
  const rightDistance = Math.abs(afterRight.x - afterForward.x);
  if (rightDistance < 0.35) {
    throw new Error('Right movement failed: before=' + JSON.stringify(afterForward) + ', after=' + JSON.stringify(afterRight) + ', sample=' + JSON.stringify(rightSample) + ', forwardSample=' + JSON.stringify(forwardSample) + ', pageErrors=' + JSON.stringify(pageErrors));
  }
  if (pageErrors.length) throw new Error('Browser runtime errors: ' + pageErrors.join('\n'));

  console.log('BROWSER MOVEMENT PASS');
  console.log('Forward movement: ' + forwardDistance.toFixed(2) + ' units in 1.2s');
  console.log('Right movement: ' + rightDistance.toFixed(2) + ' units in 0.9s');
  console.log('Initial position: ' + JSON.stringify(before));
  console.log('Final position: ' + JSON.stringify(afterRight));
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
