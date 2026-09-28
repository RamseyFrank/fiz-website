(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  // iOS browsers share WebKit's video decoding; macOS Safari also needs HEVC alpha.
  const appleVideo = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
    navigator.vendor === 'Apple Computer, Inc.';
  const states = [...document.querySelectorAll('.media-frame video')].map((video) => ({
    video,
    frame: video.closest('.media-frame'),
    query: window.matchMedia(`(max-width: ${video.dataset.breakpoint}px)`),
    visible: false,
    failedSource: null,
  }));
  const sourceFor = ({ video, query }) => {
    if (appleVideo) {
      // Add these attributes only when real HEVC-with-alpha exports exist; see MEDIA.md.
      return query.matches ? video.dataset.appleMobileSrc : video.dataset.appleDesktopSrc;
    }
    return query.matches ? video.dataset.mobileSrc : video.dataset.desktopSrc;
  };
  const mayPlay = (state) => state.visible && !state.frame.hidden && !document.hidden &&
    !reducedMotion.matches && !document.querySelector('dialog[open]');
  const update = (state) => {
    const { video, frame } = state;
    const source = sourceFor(state);
    if (!mayPlay(state) || !source) {
      video.pause();
      if (reducedMotion.matches || !source) frame.classList.remove('is-playing');
      return;
    }
    if (video.getAttribute('src') !== source) {
      frame.classList.remove('is-playing');
      state.failedSource = null;
      video.src = source;
    }
    if (!video.paused || state.failedSource === source) return;
    video.play().catch((error) => {
      if (error.name === 'AbortError' || video.getAttribute('src') !== source) return;
      frame.classList.remove('is-playing');
      if (error.name !== 'NotAllowedError') state.failedSource = source;
    });
  };
  const updateAll = () => states.forEach(update);
  let observer;
  let headerHeight = -1;
  const observeVisibility = () => {
    const nextHeight = document.getElementById('topFixed').offsetHeight;
    if (headerHeight === nextHeight) return;
    headerHeight = nextHeight;
    observer?.disconnect();
    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const state = states.find((item) => item.frame === entry.target);
        state.visible = entry.isIntersecting && entry.intersectionRatio >= .01;
        update(state);
      });
    }, { threshold: .01, rootMargin: `-${headerHeight}px 0px 0px 0px` });
    states.forEach((state) => {
      state.visible = false;
      update(state);
      observer.observe(state.frame);
    });
  };
  states.forEach((state) => {
    const { video, frame } = state;
    video.muted = true;
    video.defaultMuted = true;
    video.addEventListener('playing', () => {
      if (mayPlay(state)) frame.classList.add('is-playing');
      else update(state);
    });
    video.addEventListener('canplay', () => update(state));
    // Keep the video visible through transient buffering and native loop seeks.
    // Only initial loading, source changes, or playback failures need the poster.
    video.addEventListener('error', () => {
      state.failedSource = video.getAttribute('src');
      frame.classList.remove('is-playing');
    });
    state.query.addEventListener('change', () => update(state));
  });
  observeVisibility();
  new ResizeObserver(observeVisibility).observe(document.getElementById('topFixed'));
  reducedMotion.addEventListener('change', updateAll);
  ['visibilitychange', 'fiz:overlaychange', 'fiz:mediachange', 'pointerdown', 'keydown'].forEach((event) => {
    document.addEventListener(event, updateAll);
  });
})();
