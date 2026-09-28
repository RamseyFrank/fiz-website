// Browser regression checks for the cart, age gate, gallery and responsive media.
// No dependencies: node tests/site-check.cjs (optionally set CHROME_PATH).
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const root = path.resolve(__dirname, '..');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'fiz-polish-check-'));
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const report = { widths: [], checks: [], errors: [], missing: [] };
const server = http.createServer((req, res) => {
  const filename = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]));
  if (!filename.startsWith(root + path.sep) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) {
    res.writeHead(404); return res.end();
  }
  const length = fs.statSync(filename).size;
  res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webm': 'video/webm' })[path.extname(filename)] || 'application/octet-stream');
  res.setHeader('Accept-Ranges', 'bytes');
  const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
  if (range) {
    const start = Number(range[1]), end = range[2] ? Number(range[2]) : length - 1;
    res.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${length}`, 'Content-Length': end - start + 1 });
    fs.createReadStream(filename, { start, end }).pipe(res);
  } else {
    res.setHeader('Content-Length', length);
    fs.createReadStream(filename).pipe(res);
  }
});
server.listen(0, '127.0.0.1', async () => {
  const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless=new', '--no-first-run', '--remote-debugging-pipe', '--user-data-dir=' + path.join(output, 'profile'),
  ], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'], windowsHide: true });
  let id = 0, buffer = '', requests = [];
  const pending = new Map();
  chrome.on('error', (error) => { console.error(error); server.close(); process.exitCode = 1; });
  chrome.stdio[4].on('data', (data) => {
    buffer += data;
    let end;
    while ((end = buffer.indexOf('\0')) >= 0) {
      const message = JSON.parse(buffer.slice(0, end)); buffer = buffer.slice(end + 1);
      if (message.method === 'Runtime.exceptionThrown') report.errors.push(message.params);
      if (message.method === 'Network.requestWillBeSent') requests.push(message.params.request.url);
      if (message.method === 'Network.responseReceived' && message.params.response.status === 404) report.missing.push(message.params.response.url);
      if (pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
    }
  });
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const next = ++id;
    pending.set(next, (message) => message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result));
    chrome.stdio[3].write(JSON.stringify({ id: next, method, params, sessionId }) + '\0');
  });
  const timeout = setTimeout(() => { console.error('Browser check timed out'); chrome.kill(); server.close(); process.exit(1); }, 150000);
  try {
    const target = await send('Target.createTarget', { url: 'about:blank' });
    const session = (await send('Target.attachToTarget', { targetId: target.targetId, flatten: true })).sessionId;
    for (const method of ['Runtime.enable', 'Page.enable', 'Network.enable']) await send(method, {}, session);
    await send('Network.setCacheDisabled', { cacheDisabled: true }, session);
    const evaluate = async (expression) => {
      const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, session);
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    const waitFor = async (expression, label = expression) => {
      for (let attempt = 0; attempt < 80; attempt++) {
        if (await evaluate(expression)) return;
        await pause(100);
      }
      console.error('Media state:', await evaluate("[...document.querySelectorAll('video')].map(v=>({src:v.currentSrc,paused:v.paused,ready:v.readyState,frame:v.parentElement.className,hidden:v.parentElement.hidden,bounds:v.getBoundingClientRect().toJSON(),scrollY,header:document.getElementById('topFixed').offsetHeight}))"));
      throw new Error('Timed out: ' + label);
    };
    const size = (width, height) => send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }, session);
    const navigate = async () => {
      requests = [];
      await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` }, session);
      await waitFor("document.readyState === 'complete'");
      await pause(100);
    };
    const press = async (key, code, number) => {
      await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, windowsVirtualKeyCode: number }, session);
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: number }, session);
      await pause(80);
    };
    const screenshot = async (name, full = false) => {
      const params = { captureBeyondViewport: full };
      if (full) {
        const dimensions = await evaluate('({width:innerWidth,height:document.documentElement.scrollHeight})');
        params.clip = { x: 0, y: 0, ...dimensions, scale: 1 };
      }
      const image = await send('Page.captureScreenshot', params, session);
      fs.writeFileSync(path.join(output, name + '.png'), Buffer.from(image.data, 'base64'));
    };
    const check = (label) => { report.checks.push(label); console.log('PASS: ' + label); };

    await size(390, 844); await navigate();
    assert(await evaluate("document.querySelector('.age-gate').open"));
    assert.equal(requests.filter((url) => url.endsWith('.webm')).length, 0);
    for (let attempt = 0; attempt < 3; attempt++) await press('Escape', 'Escape', 27);
    assert(await evaluate("document.querySelector('.age-gate').open && !localStorage.getItem('fiz.ageGate.acceptedAt')"));
    await evaluate("document.querySelector('.age-gate').close()"); await pause(100);
    assert(await evaluate("document.querySelector('.age-gate').open"));
    await evaluate("document.querySelector('.age-gate-yes').click()");
    await waitFor("!document.documentElement.classList.contains('age-gate-active')");
    await waitFor("!document.querySelector('.hero-video').paused && document.querySelector('.hero-video').readyState >= 2");
    check('Age gate resists repeated Escape/platform dismissal; no video fetch behind gate; acceptance unlocks and starts video');

    const imageOrder = ['FIZ_2_cans.png', 'FIZ_5_cans.png', 'FIZ_Product_Front_Side.png', 'FIZ_back_label.png', 'FIZ_stack_5.png'];
    for (const [width, height] of [[1440, 900], [1024, 768], [768, 1024], [560, 844], [390, 844], [320, 720], [844, 390], [320, 256]]) {
      await size(width, height); await navigate();
      await waitFor("document.querySelector('.hero-media').classList.contains('is-playing')");
      const metrics = await evaluate(`(() => {
        const rect = (e) => {const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
        const v=document.querySelector('.hero-video'),c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;const ctx=c.getContext('2d');ctx.drawImage(v,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height).data;
        let transparent=0,opaque=0;for(let i=3;i<pixels.length;i+=4){if(pixels[i]===0)transparent++;if(pixels[i]===255)opaque++;}
        return {width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,src:v.currentSrc,transparent,opaque,hero:rect(v),padding:parseFloat(getComputedStyle(document.querySelector('.hero')).paddingBottom),warning:rect(document.querySelector('.warning-banner-wrap')),warningText:rect(document.querySelector('.warning-bar p')),thumbs:[...document.querySelectorAll('.gallery-thumb')].map(rect),order:[...document.querySelectorAll('.gallery-thumb[data-image]')].map(e=>e.dataset.image.split('/').pop()),gallery:rect(document.querySelector('.gallery-stage')),muted:v.muted,loop:v.loop,inline:v.playsInline};
      })()`);
      assert(!metrics.overflow); assert(metrics.transparent > 0 && metrics.opaque > 0);
      assert(metrics.muted && metrics.loop && metrics.inline);
      assert(metrics.src.endsWith(width <= 560 ? 'fiz-hero-section-alpha-mobile-transparent.webm' : 'fiz-hero-section-alpha.webm'));
      assert.equal(new Set(requests.filter((url) => url.endsWith('.webm'))).size, 1);
      assert(Math.abs(metrics.padding - (width <= 560 ? Math.min(208, Math.max(144, width * .4)) : Math.min(420, Math.max(260, width * .28)))) < 1);
      assert(metrics.warningText.y >= metrics.warning.y && metrics.warningText.bottom <= metrics.warning.bottom);
      assert.deepEqual(metrics.order, imageOrder); assert.equal(metrics.thumbs.length, 6);
      assert(metrics.thumbs.every((r) => Math.abs(r.y - metrics.thumbs[0].y) < 1));
      if (width > 560) assert(metrics.thumbs[5].right <= metrics.gallery.right + 1);
      if ([1440, 390, 320].includes(width) && height > 700) await screenshot('page-' + width, true);
      await evaluate("document.querySelector('.site-nav a').click()"); await pause(700);
      assert(await evaluate("document.getElementById('product').getBoundingClientRect().top >= document.getElementById('topFixed').getBoundingClientRect().bottom"));
      await waitFor("document.querySelector('.hero-video').paused");
      report.widths.push(metrics); console.log('PASS: layout, warning, alpha, sources, gallery order and anchors at ' + width + 'x' + height);
    }

    await size(390, 844); await navigate();
    await evaluate("document.querySelectorAll('.gallery-thumb')[5].click();document.querySelector('.gallery-stage').scrollIntoView({block:'center',behavior:'instant'})");
    await waitFor("document.getElementById('galleryMotion').classList.contains('is-playing')");
    assert((await evaluate('galleryVideo.currentSrc')).endsWith('Hero_animation_2_mobile.webm'));
    assert.equal(new Set(requests.filter((url) => url.includes('Hero_animation_2') && url.endsWith('.webm'))).size, 1);
    await screenshot('gallery-video');
    await size(1024, 768);
    await pause(100);
    await evaluate("galleryMotion.scrollIntoView({block:'center',behavior:'instant'})");
    await waitFor("galleryVideo.currentSrc.endsWith('Hero_animation_2.webm') && !galleryVideo.paused");
    await evaluate("document.querySelectorAll('.gallery-thumb')[3].click();galleryZoom.focus();galleryZoom.click()");
    await waitFor('photoDialog.open');
    assert(await evaluate("galleryVideo.paused && photoImage.src.endsWith('FIZ_back_label.png')"));
    await evaluate('photoScale.click()');
    assert(await evaluate('photoScroll.scrollWidth > photoScroll.clientWidth || photoScroll.scrollHeight > photoScroll.clientHeight'));
    await screenshot('photo-enlarged');
    await press('Escape', 'Escape', 27);
    assert(await evaluate("!photoDialog.open && document.activeElement === galleryZoom && !document.documentElement.classList.contains('dialog-active')"));
    check('Gallery source changes on resize; deselection pauses; photo enlargement, zoom, Escape and focus restoration');

    await evaluate('qtyPlus.click();addToCart.click()');
    assert(await evaluate("cartCount.textContent==='2' && addToCart.textContent==='Added' && !cartDialog.open && cartStatus.textContent.includes('2 five-packs added')"));
    await evaluate('cartBtn.focus();cartBtn.click()');
    await waitFor('cartDialog.open');
    assert.equal(await evaluate('cartSubtotal.textContent'), '$59.90');
    await evaluate('cartPlus.click()'); assert.equal(await evaluate('cartSubtotal.textContent'), '$89.85');
    await evaluate('cartMinus.click()'); assert.equal(await evaluate('cartQuantity.textContent'), '2');
    await size(390, 844); await pause(300);
    assert(await evaluate("(()=>{const r=cartDialog.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&cartDialog.scrollWidth<=cartDialog.clientWidth;})()"));
    await screenshot('cart-mobile');
    await size(320, 720); await pause(100);
    assert(await evaluate("(()=>{const r=cartDialog.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&cartDialog.scrollWidth<=cartDialog.clientWidth;})()"));
    await screenshot('cart-narrow');
    for (let attempt = 0; attempt < 8; attempt++) {
      await press('Tab', 'Tab', 9);
      assert(await evaluate('cartDialog.contains(document.activeElement) || document.activeElement === document.body'));
    }
    await press('Escape', 'Escape', 27);
    assert(await evaluate('!cartDialog.open && document.activeElement === cartBtn'));
    await navigate(); assert.equal(await evaluate('cartCount.textContent'), '2');
    await evaluate('cartBtn.click();cartRemove.click()');
    assert(await evaluate('!cartEmpty.hidden && cartContents.hidden && cartCount.textContent === "0" && document.activeElement.classList.contains("cart-continue")'));
    await press('Escape', 'Escape', 27);
    await evaluate('for(let i=0;i<25;i++)qtyPlus.click();addToCart.click();addToCart.click()');
    assert(await evaluate('cartCount.textContent === "20" && qtyPlus.disabled && addToCart.textContent === "Cart full"'));
    await evaluate("localStorage.setItem('fiz.cart.v1', '{broken')"); await navigate();
    assert.equal(await evaluate('cartCount.textContent'), '0');
    check('Cart totals, quantity controls, persistent state, manual opening, removal/focus, bounds and malformed storage');

    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }, session);
    await navigate();
    await evaluate("document.querySelectorAll('.gallery-thumb')[5].click();galleryMotion.scrollIntoView({block:'center',behavior:'instant'})"); await pause(300);
    assert.equal(requests.filter((url) => url.endsWith('.webm')).length, 0);
    assert(await evaluate("[...document.querySelectorAll('video')].every(v=>v.paused) && getComputedStyle(document.documentElement).scrollBehavior==='auto' && getComputedStyle(document.querySelector('.hero'),'::after').animationName==='none'"));
    await send('Emulation.setEmulatedMedia', { features: [] }, session);
    await waitFor("galleryMotion.classList.contains('is-playing')");
    await evaluate("document.querySelector('.hero-media').scrollIntoView({block:'center',behavior:'instant'})");
    await waitFor("document.querySelector('.hero-media').classList.contains('is-playing')");
    check('Reduced motion: no video downloads, stills, stopped dots, instant scrolling, runtime preference recovery');

    await send('Network.setBlockedURLs', { urls: ['*fiz-hero-section-alpha-mobile-transparent.webm'] }, session);
    await size(390, 844); await navigate();
    await waitFor("document.querySelector('.hero-video').error !== null");
    assert(await evaluate("!document.querySelector('.hero-media').classList.contains('is-playing') && document.querySelector('.hero-media .media-poster').naturalWidth > 0"));
    await send('Network.setBlockedURLs', { urls: [] }, session);
    check('Video failure leaves a visible still image');

    await send('Network.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/153.0.0.0 Mobile/15E148 Safari/604.1', platform: 'iPhone' }, session);
    await navigate();
    await evaluate("document.querySelectorAll('.gallery-thumb')[5].click();galleryMotion.scrollIntoView({block:'center',behavior:'instant'})"); await pause(300);
    assert.equal(requests.filter((url) => /\.(webm|mov)$/.test(url)).length, 0);
    assert(await evaluate("[...document.querySelectorAll('.media-poster')].every(e=>e.complete&&e.naturalWidth>0) && !galleryMotion.classList.contains('is-playing')"));
    await screenshot('apple-still-fallback');
    check('Emulated iPhone Chrome selects transparent stills pending owner HEVC exports; no incompatible or missing video requests');
    assert.equal(report.errors.length, 0, JSON.stringify(report.errors));
    assert.equal(report.missing.length, 0, JSON.stringify(report.missing));
    check('No JavaScript exceptions or missing asset responses');
    console.log('Screenshots and report: ' + output);
  } catch (error) {
    console.error(error); process.exitCode = 1;
  } finally {
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    clearTimeout(timeout);
    await send('Browser.close').catch(() => chrome.kill());
    server.close();
  }
});
