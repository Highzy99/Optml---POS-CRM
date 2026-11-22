# WPDA Protocol Hub

The World Peptide Dosage Association protocol hub: compound catalogue with exact draws, injection-site body map, mixing and injection guide, dose calculator, protocol builder with custom compounds and weekly-mg titrations, PDF export, share links and a daily client tracker.

Live: https://wpda-protocol-hub.vercel.app (Vercel project `wpda-hub`, root directory `wpda-hub/`).

## Structure

```
index.html        built single-file app (do not edit by hand)
og.jpg            1200x630 link-preview image
assets/           brand images, box photos, Onest font
src/              editable sources
  shell.html      page shell and all CSS
  data.js         compounds, schedules, guide content (from the original WPDA page)
  logic.js        dose maths: titration ladders, unit conversion, share-link encoding
  app1-5.js       UI: catalogue + sheet, body map + guide, builder, PDF document, tracker + root
  build.py        bundles everything into ../index.html
```

## Editing

Edit files in `src/`, then run `python3 src/build.py` from this folder and commit `index.html` with your changes. Pushing to `main` redeploys the site.
