// Shared entry gate: include immediately after <body> on every site document.
(() => {
  const storageKey = 'fiz.ageGate.acceptedAt';
  const validity = 30 * 24 * 60 * 60 * 1000;
  let acceptedInMemory = 0;
  let scrollPosition = 0;
  let previousFocus;

  function isAccepted() {
    let acceptedAt = acceptedInMemory;
    try {
      acceptedAt = Number(localStorage.getItem(storageKey)) || acceptedAt;
    } catch {
      // Storage may be disabled; confirmation still works for this document.
    }
    const age = Date.now() - acceptedAt;
    return acceptedAt > 0 && age >= 0 && age < validity;
  }

  const dialog = document.createElement('dialog');
  dialog.className = 'age-gate';
  dialog.setAttribute('closedby', 'none');
  dialog.setAttribute('aria-labelledby', 'ageGateTitle');
  dialog.setAttribute('aria-describedby', 'ageGateDescription');
  dialog.innerHTML = `
    <div class="age-gate-card">
      <h1 id="ageGateTitle" tabindex="-1">Are you 21 years of age or older?</h1>
      <p id="ageGateDescription">By entering this website, you acknowledge and certify that you are at least 21 years of age.</p>
      <div class="age-gate-actions">
        <button type="button" class="age-gate-yes">Yes, I am 21+</button>
        <button type="button" class="age-gate-no">No</button>
      </div>
      <svg class="age-gate-logo" viewBox="0 0 203.57867 70.127329" role="img" aria-label="FIZ">
        <use href="#fizBrandLogo"></use>
      </svg>
    </div>`;
  document.body.append(dialog);
  const title = dialog.querySelector('h1');

  function showGate() {
    if (dialog.open || isAccepted()) return;
    if (!document.documentElement.classList.contains('age-gate-active')) {
      previousFocus = document.activeElement;
      scrollPosition = window.scrollY;
      document.body.style.setProperty('--age-gate-scroll', `-${scrollPosition}px`);
      document.documentElement.classList.add('age-gate-active');
    }
    dialog.showModal();
    title.focus({ preventScroll: true });
    document.dispatchEvent(new Event('fiz:overlaychange'));
  }

  // Escape and backdrop clicks must never grant access.
  dialog.addEventListener('cancel', (event) => event.preventDefault());
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') event.preventDefault();
  });
  dialog.addEventListener('close', () => {
    // Platform dismissal must not bypass acceptance or strand the scroll lock.
    if (!isAccepted()) { showGate(); return; }
    document.documentElement.classList.remove('age-gate-active');
    document.body.style.removeProperty('--age-gate-scroll');
    window.scrollTo({ top: scrollPosition, behavior: 'instant' });
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    document.dispatchEvent(new Event('fiz:overlaychange'));
  });
  dialog.querySelector('.age-gate-yes').addEventListener('click', () => {
    acceptedInMemory = Date.now();
    try {
      localStorage.setItem(storageKey, String(acceptedInMemory));
    } catch {
      // Do not prevent access when browser storage is unavailable.
    }
    dialog.close();
  });
  dialog.querySelector('.age-gate-no').addEventListener('click', () => {
    title.textContent = 'This website is restricted to adults 21 and older.';
    dialog.querySelector('#ageGateDescription').textContent = 'You must be 21 years of age or older to access this website.';
    dialog.querySelector('.age-gate-actions').hidden = true;
    title.focus({ preventScroll: true });
  });

  showGate();
  // Revalidate when a document is restored from the browser's back/forward cache.
  window.addEventListener('pageshow', showGate);
})();
