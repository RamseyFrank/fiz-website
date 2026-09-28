# Transparent website animations

The original hero stays in the hero. `Hero_animation_2` stays last in the product gallery.

## Source selection

`index.html` declares the four source paths for each video. The existing `media.js` selects one path when playback is allowed, using each video's `matchMedia` breakpoint:

| Location | Viewport | Apple/WebKit source | Other browsers |
| --- | --- | --- | --- |
| Hero | <= 560px | `images/fiz-hero-section_mobile_apple.mov` | `images/fiz-hero-section-alpha-mobile-transparent.webm` |
| Hero | > 560px | `images/fiz-hero-section_apple.mov` | `images/fiz-hero-section-alpha.webm` |
| Gallery | <= 768px | `images/Hero_animation_2_mobile_apple.mov` | `images/Hero_animation_2_mobile.webm` |
| Gallery | > 768px | `images/Hero_animation_2_apple.mov` | `images/Hero_animation_2.webm` |

The existing Apple branch recognizes iPhone/iPad/iPod, iPads using a Mac platform with touch support, and Safari's Apple vendor. Desktop Chrome/Firefox keep WebM. Resolution follows viewport width, including after resizing or rotating; an iPad above a breakpoint receives the desktop asset, as before.

The selector remains JavaScript-based because it already controls visibility, gallery selection, reduced motion, dialog pauses, and live breakpoint changes. Ordinary codec support does not establish alpha decoding support. Native source fallback may accept a video but render it without transparency, so the existing Apple branch is retained. Apple playback failures retain the transparent still instead of trying a potentially opaque WebM.

- Only the selected format/resolution is assigned; no eager source or preload links fetch other variants.
- Playback remains automatic when visible and allowed, looping, muted, inline, and without controls.
- Reduced-motion visitors receive stills without fetching video. Media pauses off-screen, in a hidden tab, or while a dialog covers the page. Gallery video loads only when selected and visible.
- Existing dimensions, positioning, CSS, gallery order, photographs, and WebMs are unchanged.
- The older `fiz-hero-section-alpha-mobile.webm` remains unused because it has opaque alpha pixels. The working mobile hero source remains `fiz-hero-section-alpha-mobile-transparent.webm`.

## Apple assets and hosting

All four MOV exports are present in `images/`, and all eight declared animation paths resolve. Inspection confirms HEVC (`hvc1`), alpha-layer signaling, 30 fps, and 8-second duration for each MOV. Desktop exports are 3840 x 2160; mobile exports are 960 x 540.

Serve `.mov` as `video/quicktime` and `.webm` as `video/webm`, with byte-range support. The website assigns `video.src` directly, so MIME type comes from the server response; a `type` attribute on `<video>` would not configure it. The local regression server includes both MIME types. Production hosting configuration is not included in this repository.

Exports must contain HEVC with alpha, preserve the source aspect ratio/timing, and use Apple's compatible encoding. No transcoding or modification of the supplied assets is performed by this integration.

References: [Apple HEVC with alpha](https://developer.apple.com/videos/play/wwdc2019/506/), [WebKit VP9 transparency issue](https://bugs.webkit.org/show_bug.cgi?id=275908).

## Verification

Run `node tests/site-check.cjs` from the project root. Set `CHROME_PATH` if Chrome is not installed at the usual Windows path. Screenshots and browser profiles are written under the system temporary directory.

The checks verify all eight asset paths, local MIME types and byte-range responses, plus WebM transparency/playback, layout, gallery ordering, pauses, reduced motion, and both sides of the 560px/768px breakpoints. Emulated iPhone Safari/Chrome, macOS Safari, and iPad profiles check MOV selection and one-resolution-only requests. MOV requests are deliberately blocked in those routing tests to verify still-image fallback; emulation does not validate Apple decoding.

Test on real Safari/macOS and Safari/Chrome on iPhone: transparent edges over the dotted background, correct resolution, autoplay after age acceptance, looping/muted/inline playback, and gallery playback. Actual Apple alpha decoding cannot be verified in Windows Chrome.
