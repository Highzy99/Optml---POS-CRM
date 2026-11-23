# optml price list + WPDA guide

The optml price list with the World Peptide Dosage Association guide built in. Customers order on WhatsApp (the message format is the one the CRM's "paste order" parser reads); everything they order becomes their personal guide under My plan: exact draws, mixing, injection sites, a daily tracker and a PDF.

Pages (hash routes): `#/` price list, `#/p/SKU` product (prices, how to use, mix and draw, certificate), `#/order`, `#/guide/mix|measure|inject|sites|store|faq`, `#/plan` (tracker), `#/build` (protocol builder with custom compounds and titrations), `#/coa`, `#/protocols` (every protocol in one list, with PDF export of the ones you tick). `/wholesale` shows wholesale rates including 10-vial packs. Old share links (`#plan=…`, `#p=…`) still open the shared plan.

Live: https://stayoptml.vercel.app (Vercel project `wpda-hub`, root directory `wpda-hub/`).

## Design

The shop page uses the original optml palette (white, #f5f6f7 paper, #222326 ink, goal gradients) and shows products the way stayoptml.com does: a square goal-gradient stage with a + button, goal chip, title, strength pills and price. The + button opens a bottom sheet to pick a pack. To show a product photo on a card, put the image in `assets/products/` and add it to `PRODUCT_PHOTOS` in `src/shopdata.js` (keyed by SKU); cards without one show the goal badge. Product pages use the goal colour as a header block and the order summary uses the box periwinkle (`--lid`).

## Structure

```
index.html        built single-file app (do not edit by hand)
og.jpg            1200x630 link-preview image
assets/           brand images, box photos, Onest font
src/              editable sources
  shell.html      page shell and all CSS
  data.js         compounds, schedules, guide content (from the original WPDA page)
  logic.js        dose maths: titration ladders, unit conversion, share-link encoding
  shopdata.js     price list: SKUs, prices, certificates, shipping, discount codes
  shop.js         price list, order form and WhatsApp message, certificates
  app1-5.js       product page, guide + body map, builder, PDF document, tracker + router/root
  build.py        bundles everything into ../index.html
```

## Editing

Edit files in `src/`, then run `python3 src/build.py` from this folder and commit `index.html` with your changes. Pushing to `main` redeploys the site.
