import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('/usr/local/share/bun-global/node_modules/playwright-core');
const fs = await import('fs');

const url = 'http://localhost:3000';
const browser = await chromium.launch({
  executablePath: '/ms-playwright/chrome-headless-shell-linux64/chrome-headless-shell',
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--no-sandbox',
  ],
});

const errors = [];
const failedRequests = [];

function attachListeners(page, label) {
  page.on('pageerror', (err) => errors.push(`[${label}] PAGEERROR: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const txt = msg.text();
      if (!txt.includes('WebSocket')) {
        errors.push(`[${label}] CONSOLE_ERROR: ${txt}`);
      }
    }
  });
  page.on('response', (res) => {
    if (res.status() >= 400) failedRequests.push(`[${label}] ${res.status()} ${res.url()}`);
  });
}

async function enterMenu(page, label) {
  console.log(`[${label}] Navigating to ${url}...`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('button', { timeout: 15000 });

  // Skip cutscene via Space key
  const hasSkip = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button')).some((b) =>
      (b.textContent || '').toUpperCase().includes('SKIP')
    )
  );
  if (hasSkip) {
    console.log(`[${label}] Skipping opening cutscene...`);
    await page.keyboard.press('Space');
    await page.waitForSelector('button:has-text("ESC")', { timeout: 15000 });
    await page.click('button:has-text("ESC")');
    await page.waitForSelector('text=EXIT TO MAIN MENU', { timeout: 8000 });
    await page.click('text=EXIT TO MAIN MENU');
  }
  await page.waitForSelector('text=TRAINING PROTOCOL (TUTORIAL)', { timeout: 15000 });
  console.log(`[${label}] Reached Main Menu.`);
}

try {
  const ctxA = await browser.newContext({ viewport: { width: 960, height: 540 } });
  const ctxB = await browser.newContext({ viewport: { width: 960, height: 540 } });
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();
  attachListeners(pageA, 'PlayerA');
  attachListeners(pageB, 'PlayerB');

  // 1. Verify Tutorial Level from Main Menu
  await enterMenu(pageA, 'PlayerA');
  console.log('[PlayerA] Launching Tutorial Level...');
  await pageA.click('text=TRAINING PROTOCOL (TUTORIAL)');
  await pageA.waitForSelector('text=TRAINING CHECKLIST', { timeout: 15000 });
  await pageA.waitForTimeout(800);

  await pageA.keyboard.down('KeyW');
  await pageA.waitForTimeout(1600);
  await pageA.keyboard.up('KeyW');
  await pageA.waitForTimeout(400);

  const tutText = await pageA.evaluate(() => document.body.innerText);
  console.log('TUTORIAL CHECKLIST PRESENT:', tutText.includes('TRAINING CHECKLIST'));
  console.log('TUTORIAL PROGRESSED:', tutText.includes('CROUCH') || tutText.includes('STEP 2/8'));

  const cdpA = await ctxA.newCDPSession(pageA);
  const tutShot = await cdpA.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('tmp_verify/tutorial_hud.png', Buffer.from(tutShot.data, 'base64'));

  // Exit tutorial to Menu
  await pageA.click('button:has-text("ESC")');
  await pageA.waitForSelector('text=EXIT TO MAIN MENU', { timeout: 5000 });
  await pageA.click('text=EXIT TO MAIN MENU');
  await pageA.waitForSelector('text=MULTIPLAYER (CO-OP / PVP)', { timeout: 10000 });

  // 2. Verify Real WebSocket Multiplayer Lobby & 2-Client Launch
  await pageA.click('text=MULTIPLAYER (CO-OP / PVP)');
  await pageA.waitForSelector('text=WS UPLINK ONLINE', { timeout: 10000 });
  await pageA.click('text=CREATE MULTIPLAYER ROOM');
  await pageA.waitForSelector('text=SQUAD ROSTER (1/4)', { timeout: 10000 });

  const roomCode = await pageA.evaluate(() => {
    const m = document.body.innerText.match(/CODE:\s*([A-Z0-9]{4,6})/);
    return m ? m[1] : null;
  });
  console.log('CREATED ROOM CODE:', roomCode);
  if (!roomCode) throw new Error('Room code not found on host lobby');

  await enterMenu(pageB, 'PlayerB');
  await pageB.click('text=MULTIPLAYER (CO-OP / PVP)');
  await pageB.waitForSelector('text=WS UPLINK ONLINE', { timeout: 10000 });
  await pageB.fill('input[placeholder*="E.G."]', roomCode);
  await pageB.click('button:has-text("JOIN ROOM")');
  await pageB.waitForSelector('text=SQUAD ROSTER (2/4)', { timeout: 10000 });
  await pageA.waitForSelector('text=SQUAD ROSTER (2/4)', { timeout: 10000 });

  await pageB.fill('input[placeholder*="Transmit message"]', 'ALPHA ON STATION');
  await pageB.click('button[aria-label="Send Chat"]');
  await pageA.waitForSelector('text=ALPHA ON STATION', { timeout: 8000 });
  console.log('REALTIME CHAT VERIFIED ACROSS TWO BROWSER CONTEXTS!');

  await pageA.click('button:has-text("DEPLOY SQUAD (2)")');
  await pageA.waitForSelector('text=CO-OP SQUAD', { timeout: 15000 });
  await pageB.waitForSelector('text=CO-OP SQUAD', { timeout: 15000 });
  await pageA.waitForTimeout(1200);

  const mpShot = await cdpA.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('tmp_verify/multiplayer_hud.png', Buffer.from(mpShot.data, 'base64'));

  if (errors.length > 0) {
    throw new Error('Runtime errors detected:\n' + errors.join('\n'));
  }
  if (failedRequests.length > 0) {
    throw new Error('Failed HTTP requests:\n' + failedRequests.join('\n'));
  }
  console.log('TUTORIAL + MULTIPLAYER PLAYWRIGHT VERIFICATION PASSED!');
} finally {
  await browser.close();
}
