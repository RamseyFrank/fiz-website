# Transparent video handoff

The original hero stays in the hero. `Hero_animation_2` stays last in the product gallery.

## Current behavior

- Non-Apple browsers select one WebM per video, based on viewport width: 560px for the hero and 768px for the gallery.
- The original mobile hero WebM has opaque alpha pixels. It is retained unchanged. The site uses the new `fiz-hero-section-alpha-mobile-transparent.webm`, derived from the transparent desktop original.
- Existing desktop WebMs and product photographs remain unchanged.
- iOS browsers and macOS Safari currently show transparent stills. HEVC-with-alpha exports are pending from the owner; the page does not request missing MOV files or an incompatible WebM on these browsers.
- Reduced-motion visitors receive stills without fetching video. Media pauses off-screen, in a hidden tab, or while a dialog covers the page. Gallery video loads only when selected and visible.

## Mac exports to supply

Export **HEVC with alpha**, not ordinary HEVC/H.265. Use an encoder that explicitly supports Apple's alpha layer. Start from the transparent desktop WebM with alpha-aware decoding, or the original project/ProRes 4444 source. Do not use the old opaque mobile hero as the source.

| Animation | Desktop filename | Mobile filename |
| --- | --- | --- |
| Original hero | `fiz-hero-section-alpha-hevc.mov` | `fiz-hero-section-alpha-mobile-hevc.mov` |
| Gallery animation | `Hero_animation_2-hevc.mov` | `Hero_animation_2_mobile-hevc.mov` |

Preserve duration, frame rate, transparent edges and aspect ratio. Keep desktop at the existing export resolution. A 1280×720 mobile export preserves the 16:9 source without non-square pixels. No audio is needed. Use the `hvc1` video tag and a fast-start MOV container.

Apple reference: https://developer.apple.com/videos/play/wwdc2019/506/

## Connect only after the files exist

Place the exports in `images/`. On the corresponding `<video>` in `index.html`, add:

```html
data-apple-desktop-src="images/fiz-hero-section-alpha-hevc.mov"
data-apple-mobile-src="images/fiz-hero-section-alpha-mobile-hevc.mov"
```

For `#galleryVideo`, use the two `Hero_animation_2` filenames from the table instead. `media.js` already selects the right attribute. Keep the WebM attributes for other browsers; do not add eager `<source>` or preload links for both formats.

Then verify on the owner's iPhone in Chrome (and Safari): transparent edges over the dotted hero background; mobile source only; autoplay after age acceptance; looping/muted/inline playback; pause on scrolling away; gallery behavior; reduced-motion stills. Also test a desktop Apple browser and a non-Apple browser. The current emulated Apple tests verify source selection and still fallback, not Apple's real video decoder.

## Local regression checks

Run `node tests/site-check.cjs` from the project root. Set `CHROME_PATH` if Chrome is not installed at the usual Windows path. Screenshots and browser profiles are written under the system temporary directory; no site changes are made by the checks.
