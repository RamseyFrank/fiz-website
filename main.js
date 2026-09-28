// Start muted playback and retry when a tab returns or a user gesture allows it.
const heroVideo = document.querySelector('.hero-video');
if (heroVideo) {
  heroVideo.muted = true;
  heroVideo.defaultMuted = true;
  const playHeroVideo = () => {
    if (document.hidden || !heroVideo.paused) return;
    heroVideo.play().catch((error) => {
      if (error.name !== 'AbortError' && error.name !== 'NotAllowedError') {
        console.warn('Hero video playback failed:', error);
      }
    });
  };
  heroVideo.addEventListener('canplay', playHeroVideo);
  // Assign just one URL so the preload scanner cannot fetch both versions.
  const smallScreen = window.matchMedia('(max-width: 560px)');
  const updateHeroSource = () => {
    const source = smallScreen.matches ? heroVideo.dataset.mobileSrc : heroVideo.dataset.desktopSrc;
    if (heroVideo.getAttribute('src') === source) return;
    heroVideo.src = source;
    heroVideo.load();
    playHeroVideo();
  };
  smallScreen.addEventListener('change', updateHeroSource);
  updateHeroSource();
  document.addEventListener('visibilitychange', playHeroVideo);
  document.addEventListener('pointerdown', playHeroVideo, { once: true });
  document.addEventListener('keydown', playHeroVideo, { once: true });
  playHeroVideo();
}

// Reserve space under the fixed warning bar + header stack
const topFixed = document.getElementById('topFixed');
const hero = document.querySelector('.hero');
const setHeroOffset = () => {
  const h = topFixed.offsetHeight;
  hero.style.setProperty('--hero-top', (h + 40) + 'px');
};
setHeroOffset();
window.addEventListener('resize', setHeroOffset);

// Product animation loads only when selected, using one source for the viewport.
const galleryImage = document.getElementById('galleryImage');
const galleryVideo = document.getElementById('galleryVideo');
const galleryPlaceholder = document.getElementById('galleryPlaceholder');
const galleryCaption = document.getElementById('galleryCaption');
const galleryThumbnails = document.querySelectorAll('.gallery-thumb');
const gallerySmallScreen = window.matchMedia('(max-width: 768px)');
const playGalleryVideo = (thumbnail) => {
  const { video, mobileVideo } = thumbnail.dataset;
  const source = gallerySmallScreen.matches && mobileVideo ? mobileVideo : video;
  galleryVideo.muted = true;
  if (galleryVideo.getAttribute('src') !== source) galleryVideo.src = source;
  galleryVideo.play().catch(() => {});
};
gallerySmallScreen.addEventListener('change', () => {
  const selected = document.querySelector('.gallery-thumb[aria-pressed="true"][data-video]');
  if (selected) playGalleryVideo(selected);
});
galleryThumbnails.forEach((thumbnail) => {
  thumbnail.addEventListener('click', () => {
    galleryThumbnails.forEach((item) => item.setAttribute('aria-pressed', String(item === thumbnail)));
    const { image, video, alt } = thumbnail.dataset;
    galleryVideo.pause();
    galleryVideo.hidden = !video;
    galleryImage.hidden = !image;
    galleryPlaceholder.hidden = Boolean(image || video);
    if (video) {
      playGalleryVideo(thumbnail);
      galleryCaption.textContent = alt;
    } else if (image) {
      galleryImage.src = image;
      galleryImage.alt = alt;
      galleryCaption.textContent = alt;
    } else {
      galleryPlaceholder.textContent = `${alt} — photo to be supplied.`;
      galleryCaption.textContent = 'Temporary gallery placeholder';
    }
  });
});

// Quantity and cart counts represent five-packs, never individual tins.
const qtyVal = document.getElementById('qtyVal');
let qty = 1;
const updateQuantity = () => {
  qtyVal.textContent = qty;
  document.getElementById('qtyMinus').disabled = qty === 1;
  document.getElementById('qtyPlus').disabled = qty === 20;
};
document.getElementById('qtyMinus').addEventListener('click', () => {
  qty = Math.max(1, qty - 1);
  updateQuantity();
});
document.getElementById('qtyPlus').addEventListener('click', () => {
  qty = Math.min(20, qty + 1);
  updateQuantity();
});

// Add to cart -> bump cart badge (placeholder client-side only)
const cartCount = document.getElementById('cartCount');
let cartTotal = 0;
document.getElementById('addToCart').addEventListener('click', () => {
  cartTotal += qty;
  cartCount.textContent = cartTotal;
  cartCount.classList.add('show');
  document.getElementById('cartBtn').setAttribute('aria-label', `Cart: ${cartTotal} five-packs`);
});
