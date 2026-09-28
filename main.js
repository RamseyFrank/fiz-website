(() => {
  const $ = (id) => document.getElementById(id);
  const notifyMedia = () => document.dispatchEvent(new Event('fiz:overlaychange'));

  // Measure the sticky stack so anchor destinations remain visible at every width.
  const updateHeaderOffset = () => {
    document.documentElement.style.setProperty('--header-offset', `${$('topFixed').offsetHeight + 16}px`);
  };
  new ResizeObserver(updateHeaderOffset).observe($('topFixed'));
  updateHeaderOffset();

  // Native dialogs provide focus containment, Escape dismissal and focus restoration.
  const openDialog = (dialog) => {
    if (document.querySelector('.age-gate[open]') || dialog.open) return;
    dialog.showModal();
    document.documentElement.classList.add('dialog-active');
    notifyMedia();
  };
  [$('cartDialog'), $('photoDialog')].forEach((dialog) => {
    dialog.querySelectorAll('[data-close-dialog]').forEach((button) => {
      button.addEventListener('click', () => dialog.close());
    });
    let startedOnBackdrop = false;
    const isBackdrop = (event) => {
      const rect = dialog.getBoundingClientRect();
      return event.clientX < rect.left || event.clientX > rect.right ||
        event.clientY < rect.top || event.clientY > rect.bottom;
    };
    dialog.addEventListener('pointerdown', (event) => { startedOnBackdrop = isBackdrop(event); });
    dialog.addEventListener('click', (event) => {
      if (startedOnBackdrop && isBackdrop(event)) dialog.close();
      startedOnBackdrop = false;
    });
    dialog.addEventListener('close', () => {
      if (!document.querySelector('.cart-drawer[open], .photo-dialog[open]')) {
        document.documentElement.classList.remove('dialog-active');
      }
      notifyMedia();
    });
  });

  const galleryImage = $('galleryImage');
  const galleryZoom = $('galleryZoom');
  const galleryMotion = $('galleryMotion');
  const thumbnails = [...document.querySelectorAll('.gallery-thumb')];
  thumbnails.forEach((thumbnail) => {
    thumbnail.addEventListener('click', () => {
      thumbnails.forEach((item) => item.setAttribute('aria-pressed', String(item === thumbnail)));
      const { image, video, alt } = thumbnail.dataset;
      galleryZoom.hidden = Boolean(video);
      galleryMotion.hidden = !video;
      if (image) {
        galleryImage.src = image;
        galleryImage.alt = alt;
        galleryZoom.setAttribute('aria-label', `Enlarge ${alt}`);
      }
      $('galleryCaption').textContent = alt;
      document.dispatchEvent(new Event('fiz:mediachange'));
    });
  });
  galleryZoom.addEventListener('click', () => {
    $('photoScroll').classList.remove('is-zoomed');
    $('photoScale').setAttribute('aria-pressed', 'false');
    $('photoScale').textContent = 'Zoom in';
    $('photoImage').src = galleryImage.src;
    $('photoImage').alt = galleryImage.alt;
    $('photoCaption').textContent = galleryImage.alt;
    openDialog($('photoDialog'));
    $('photoScroll').scrollTo(0, 0);
  });
  $('photoScale').addEventListener('click', () => {
    const enlarged = $('photoScroll').classList.toggle('is-zoomed');
    $('photoScale').setAttribute('aria-pressed', String(enlarged));
    $('photoScale').textContent = enlarged ? 'Fit photo' : 'Zoom in';
  });

  // All quantities represent five-packs; prices stay in integer cents.
  const unitPrice = 2995;
  const maximumQuantity = 20;
  const storageKey = 'fiz.cart.v1';
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const validQuantity = (value) => Number.isInteger(value) && value >= 0 && value <= maximumQuantity;
  const readCart = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      return saved?.version === 1 && validQuantity(saved.quantity) ? saved.quantity : 0;
    } catch {
      return 0;
    }
  };
  let cartQuantity = readCart();
  let quantity = 1;
  let feedbackTimer;
  const announce = (message) => {
    const status = $('cartDialog').open ? $('drawerStatus') : $('cartStatus');
    status.replaceChildren(document.createTextNode(message));
  };
  const renderCart = () => {
    $('cartCount').textContent = cartQuantity;
    $('cartCount').classList.toggle('show', cartQuantity > 0);
    $('cartBtn').setAttribute('aria-label', cartQuantity ? `Cart: ${cartQuantity} five-pack${cartQuantity === 1 ? '' : 's'}` : 'Cart, empty');
    $('cartEmpty').hidden = cartQuantity > 0;
    $('cartContents').hidden = cartQuantity === 0;
    $('cartQuantity').textContent = cartQuantity;
    $('cartSubtotal').textContent = money.format(cartQuantity * unitPrice / 100);
    $('cartMinus').disabled = cartQuantity <= 1;
    $('cartPlus').disabled = cartQuantity >= maximumQuantity;
  };
  const saveCart = (nextQuantity) => {
    cartQuantity = Math.max(0, Math.min(maximumQuantity, nextQuantity));
    try {
      localStorage.setItem(storageKey, JSON.stringify({ version: 1, quantity: cartQuantity }));
    } catch {
      // Shopping remains available for this visit when browser storage is disabled.
    }
    renderCart();
  };
  const renderQuantity = () => {
    $('qtyVal').textContent = quantity;
    $('qtyMinus').disabled = quantity === 1;
    $('qtyPlus').disabled = quantity === maximumQuantity;
  };
  $('qtyMinus').addEventListener('click', () => { quantity = Math.max(1, quantity - 1); renderQuantity(); });
  $('qtyPlus').addEventListener('click', () => { quantity = Math.min(maximumQuantity, quantity + 1); renderQuantity(); });
  $('addToCart').addEventListener('click', () => {
    const added = Math.min(quantity, maximumQuantity - cartQuantity);
    clearTimeout(feedbackTimer);
    if (added > 0) {
      saveCart(cartQuantity + added);
      $('addToCart').textContent = 'Added';
      announce(`${added} five-pack${added === 1 ? '' : 's'} added. Cart contains ${cartQuantity} five-pack${cartQuantity === 1 ? '' : 's'}.${added < quantity ? ' Maximum of 20 five-packs reached.' : ''}`);
    } else {
      $('addToCart').textContent = 'Cart full';
      announce('Your cart already contains the maximum of 20 five-packs.');
    }
    feedbackTimer = setTimeout(() => { $('addToCart').textContent = 'Add to cart'; }, 1600);
  });
  $('cartBtn').addEventListener('click', () => openDialog($('cartDialog')));
  $('cartMinus').addEventListener('click', () => {
    saveCart(Math.max(1, cartQuantity - 1));
    announce(`Cart quantity: ${cartQuantity} five-packs. Subtotal ${money.format(cartQuantity * unitPrice / 100)}.`);
  });
  $('cartPlus').addEventListener('click', () => {
    saveCart(cartQuantity + 1);
    announce(`Cart quantity: ${cartQuantity} five-packs. Subtotal ${money.format(cartQuantity * unitPrice / 100)}.`);
  });
  $('cartRemove').addEventListener('click', () => {
    saveCart(0);
    $('cartDialog').querySelector('.cart-continue').focus();
    announce('FIZ Wintergreen removed. Your cart is empty.');
  });
  window.addEventListener('storage', (event) => {
    if (event.key === storageKey || event.key === null) { cartQuantity = readCart(); renderCart(); }
  });
  renderQuantity();
  renderCart();
})();
