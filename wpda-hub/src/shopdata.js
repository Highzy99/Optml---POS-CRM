// ---- Price list data (from the OPTML price list, locked 1 Sep 2026 sheet) ----
const SHOP_PRODUCTS = [
  { sku:'RE10', name:'Retatrutide 10mg', goal:'weight', prices:{1:149, 3:402, 5:649, 10:799}, was:{1:169, 3:449, 5:679} },
  { sku:'RE20', name:'Retatrutide 20mg', goal:'weight', prices:{1:239, 3:645, 5:999, 10:1199}, was:{1:279, 3:749, 5:1099} },
  { sku:'RE30', name:'Retatrutide 30mg', goal:'weight', prices:{1:299, 3:807, 5:1249, 10:1499}, was:{1:329, 3:879, 5:1299} },
  { sku:'GH50', name:'GHK-Cu 50mg', goal:'glow', prices:{1:59, 3:149, 5:219, 10:389}, was:{1:79, 3:209, 5:309} },
  { sku:'GH100', name:'GHK-Cu 100mg', goal:'glow', prices:{1:79, 3:209, 5:299, 10:539}, was:{1:109, 3:289, 5:439} },
  { sku:'ME10', name:'Melanotan II 10mg', goal:'glow', prices:{1:79, 3:209, 5:299, 10:489}, was:{1:99, 3:259, 5:399} },
  { sku:'WO20', name:'Wolverine Stack 20mg', goal:'restore', prices:{1:129, 3:348, 5:549, 10:739}, was:{1:149, 3:399, 5:599} },
  { sku:'GL70', name:'Glow Stack 70mg', goal:'glow', prices:{1:149, 3:402, 5:633, 10:889}, was:{1:179, 3:479, 5:709} },
  { sku:'KL80', name:'Klow Stack 80mg', goal:'glow', prices:{1:179, 3:483, 5:739, 10:989}, was:{1:199, 3:529, 5:789} },
  { sku:'MO10', name:'MOTS-c 10mg', goal:'energy', prices:{1:69, 3:179, 5:249, 10:389}, was:{1:79, 3:209, 5:319} },
  { sku:'MO40', name:'MOTS-c 40mg', goal:'energy', prices:{1:209, 3:564, 5:839, 10:1089}, was:{1:219, 3:599, 5:879} },
  { sku:'TE10', name:'Tesamorelin 10mg', goal:'weight', prices:{1:149, 3:402, 5:649, 10:889}, was:{1:179, 3:479, 5:719} },
  { sku:'BA50', name:'BPC-157 Arginate', goal:'restore', prices:{1:89, 3:240, 5:369, 10:439} },
  { sku:'BP10', name:'BPC-157 10mg', goal:'restore', prices:{1:69, 3:179, 5:249, 10:489}, was:{1:99, 3:259, 5:389} },
  { sku:'CJ10', name:'CJC / Ipamorelin', goal:'growth', prices:{1:129, 3:348, 5:509, 10:689}, was:{1:139, 3:369, 5:549} },
  { sku:'DS10', name:'DSIP 10mg', goal:'sleep', prices:{1:89, 3:240, 5:399, 10:539}, was:{1:109, 3:289, 5:429} },
  { sku:'GH10', name:'GHRP-6 10mg', goal:'growth', prices:{1:59, 3:159, 5:259, 10:439}, was:{1:89, 3:239, 5:349} },
  { sku:'KI10', name:'Kisspeptin 10mg', goal:'vitality', prices:{1:89, 3:240, 5:399, 10:589}, was:{1:119, 3:319, 5:469} },
  { sku:'KP10', name:'KPV 10mg', goal:'restore', prices:{1:89, 3:239, 5:349, 10:439} },
  { sku:'NA1000', name:'NAD+ 1000mg', goal:'energy', prices:{1:169, 3:456, 5:749, 10:939}, was:{1:189, 3:509} },
  { sku:'SK10', name:'Selank 10mg', goal:'edge', prices:{1:79, 3:209, 5:319, 10:439}, was:{1:89, 3:239, 5:359} },
  { sku:'SL10', name:'SLU-PP-332', goal:'weight', prices:{1:89, 3:219, 5:359, 10:589}, was:{1:119, 3:319, 5:479} },
  { sku:'SX10', name:'Semax 10mg', goal:'edge', prices:{1:79, 3:209, 5:319, 10:439}, was:{1:89, 3:239, 5:359} },
  { sku:'TB10', name:'TB-500 10mg', goal:'restore', prices:{1:119, 3:319, 5:479, 10:699} },
  { sku:'TI10', name:'Tirzepatide 10mg', goal:'weight', prices:{1:119, 3:319, 5:479, 10:589} },
  { sku:'TI20', name:'Tirzepatide 20mg', goal:'weight', prices:{1:179, 3:479, 5:719, 10:879} },
  { sku:'TI30', name:'Tirzepatide 30mg', goal:'weight', prices:{1:219, 3:589, 5:879, 10:1089} }
];

const COA_BASE = 'https://stayoptml.com/wp-content/uploads/optml-coa/';
const COAS = {
  RE10:   ['99.60%', '21 May 2026', 'OZ-HPLCMS-SHVJ_Retatrutide-10mg.pdf'],
  RE20:   ['99.53%', '16 Jul 2026', 'retatrutide-20mg.pdf'],
  RE30:   ['99.81%', '16 Jul 2026', 'retatrutide-30mg.pdf'],
  GH50:   ['99.52%', '16 Jul 2026', 'OZ-HPLCMS-OP01_GHK-Cu-50mg.pdf'],
  GH100:  ['99.71%', '16 Jul 2026', 'OZ-HPLCMS-OP02_GHK-Cu-100mg.pdf'],
  ME10:   ['99.59%', '16 Jul 2026', 'OZ-HPLCMS-290A_Melanotan-2-10mg.pdf'],
  WO20:   ['98.71%', '16 Jul 2026', 'OZ-HPLCMS-8790_BPC-157-TB-500.pdf'],
  GL70:   ['99.52%', '25 Jul 2026', 'OZ-HPLCMS-7911_GLOW-70mg.pdf'],
  KL80:   ['99.76%', '16 Jul 2026', 'OZ-HPLCMS-0A0A_KLOW-80mg.pdf'],
  MO10:   ['99.30%', '16 Jul 2026', 'OZ-HPLCMS-01AA_MOTS-C-10mg.pdf'],
  MO40:   ['99.05%', '16 Jul 2026', 'OZ-HPLCMS-MOT9_MOTS-C-40mg.pdf'],
  TE10:   ['99.32%', '16 Jul 2026', 'OZ-HPLCMS-OP06_Tesamorelin-10mg.pdf'],
  BP10:   ['99.58%', '26 Jul 2026', 'OZ-HPLCMS-BP10_BPC-157-10mg.pdf'],
  CJ10:   ['99.04%', '16 Jul 2026', 'OZ-HPLCMS-29AS_CJC-1295-Ipamorelin.pdf'],
  DS10:   ['98.43%', '16 Jul 2026', 'OZ-HPLCMS-DS92_DSIP-10mg.pdf'],
  GH10:   ['99.54%', '16 Jul 2026', 'OZ-HPLCMS-RPGH_GHRP-6-10mg.pdf'],
  KI10:   ['98.85%', '13 Jul 2026', 'OZ-HPLCMS-OPTA_Kisspeptin-10mg.pdf'],
  KP10:   ['99.59%', '16 Jul 2026', 'OZ-HPLCMS-02A9_KPV-10mg.pdf'],
  NA1000: ['98.87%', '25 Jul 2026', 'nad-1000mg.pdf'],
  SK10:   ['98.97%', '13 Jul 2026', 'OZ-HPLCMS-9OPT_Selank-10mg.pdf'],
  SX10:   ['98.56%', '16 Jul 2026', 'OZ-HPLCMS-1A09_Semax-10mg.pdf'],
  TB10:   ['99.27%', '25 Jul 2026', 'OZ-HPLCMS-DGC4_TB-500-10mg.pdf'],
  TI10:   ['99.49%', '16 Jul 2026', 'tirzepatide-10mg.pdf'],
  TI20:   ['99.02%', '16 Jul 2026', 'tirzepatide-20mg.pdf']
};
const SHOP_STORAGE = 'Lyophilised powder: keep refrigerated at 2–8°C and out of light (a few days at room temperature in transit is fine). Once reconstituted with bacteriostatic water, refrigerate and use within about 28 days.';
const INFO = {
  RE10: 'Triple agonist peptide acting on GLP-1, GIP and glucagon receptors — the most studied of the newer weight-management compounds. Dosed weekly.',
  GH50: 'Copper peptide complex studied for skin remodelling, collagen support and wound repair. Used topically and subcutaneously in research.',
  ME10: 'Synthetic α-MSH analogue studied for melanogenesis (skin pigmentation).',
  WO20: 'BPC-157 and TB-500 in one vial — the classic recovery pairing for soft-tissue, tendon and joint research.',
  GL70: 'GHK-Cu, BPC-157 and TB-500 blended in one vial for skin, hair and tissue-repair research.',
  KL80: 'The Glow blend plus KPV — GHK-Cu, BPC-157, TB-500 and KPV — adding anti-inflammatory support to the skin and repair stack.',
  MO10: 'Mitochondrial-derived peptide studied for metabolic regulation, exercise capacity and insulin sensitivity.',
  TE10: 'GHRH analogue studied for visceral fat reduction and growth-hormone release.',
  BA50: 'Arginate salt form of BPC-157 with improved stability — the same tendon, gut and tissue-repair research profile.',
  BP10: 'Body Protection Compound — a gastric pentadecapeptide studied for tendon, ligament, muscle and gut repair.',
  CJ10: 'CJC-1295 (no DAC) with Ipamorelin — a GHRH/GHRP pairing studied for pulsatile growth-hormone release, recovery and sleep quality.',
  DS10: 'Delta sleep-inducing peptide, studied for sleep architecture and stress modulation.',
  GH10: 'Growth-hormone-releasing peptide studied for GH release and appetite stimulation.',
  KI10: 'Neuropeptide upstream of GnRH, studied for reproductive hormone signalling and libido.',
  KP10: 'Tripeptide fragment of α-MSH studied for anti-inflammatory activity, particularly in the gut and skin.',
  NA1000: 'Nicotinamide adenine dinucleotide — a coenzyme central to cellular energy and repair, studied in ageing and metabolic research.',
  SK10: 'Synthetic tuftsin analogue studied for anxiolytic and nootropic effects without sedation.',
  SL10: 'ERR agonist studied as an exercise mimetic for endurance and fat oxidation. Typically used pre-workout in research settings.',
  SX10: 'Heptapeptide nootropic studied for focus, memory and BDNF expression.',
  TB10: 'Thymosin beta-4 fragment studied for tissue repair, flexibility and reduced inflammation.',
  TI10: 'Dual GIP/GLP-1 receptor agonist studied for weight and glycaemic research. Dosed weekly.'
};
INFO.RE20 = INFO.RE10; INFO.RE30 = INFO.RE10; INFO.GH100 = INFO.GH50; INFO.MO40 = INFO.MO10; INFO.TI20 = INFO.TI10; INFO.TI30 = INFO.TI10;
const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];
const NZ_REGIONS = ["Northland","Auckland","Waikato","Bay of Plenty","Gisborne","Hawke's Bay","Taranaki","Manawatū-Whanganui","Wellington","Tasman","Nelson","Marlborough","West Coast","Canterbury","Otago","Southland"];
const FREE_SHIP_AT = 200;
const SHIP_FLAT = 15;
const DEFAULT_CODES = 'OPTML10:10, OPTML20:20, OPTML25:25, OPTML50:50';
const SAVED_KEYS = ['cart', 'name', 'phone', 'email', 'street', 'suburb', 'region', 'postcode', 'notes', 'code', 'ref', 'sent', 'country', 'nzShip'];

function stateFromPostcode(pc) {
  const n = parseInt(pc, 10);
  if (isNaN(n)) return '';
  if ((n >= 200 && n <= 299) || (n >= 2600 && n <= 2618) || (n >= 2900 && n <= 2920)) return 'ACT';
  if ((n >= 1000 && n <= 2599) || (n >= 2619 && n <= 2899) || (n >= 2921 && n <= 2999)) return 'NSW';
  if ((n >= 3000 && n <= 3999) || (n >= 8000 && n <= 8999)) return 'VIC';
  if ((n >= 4000 && n <= 4999) || (n >= 9000 && n <= 9999)) return 'QLD';
  if (n >= 5000 && n <= 5999) return 'SA';
  if (n >= 6000 && n <= 6999) return 'WA';
  if (n >= 7000 && n <= 7999) return 'TAS';
  if (n >= 800 && n <= 999) return 'NT';
  return '';
}
function parseCodes(str) {
  const out = {};
  String(str || '').split(',').forEach(part => {
    const m = part.trim().match(/^([A-Za-z0-9]+)\s*:\s*(\$?)(\d+(?:\.\d+)?)\s*%?\s*(?:@\s*(\d+))?$/);
    if (m) out[m[1].toUpperCase()] = { fixed: m[2] === '$', value: parseFloat(m[3]), min: m[4] ? parseInt(m[4], 10) : 0 };
  });
  return out;
}
function makeRef() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return 'OPT-' + s;
}


// Product photos for the shop cards, keyed by SKU (path under assets/products/). A card without one shows its goal badge.
const PRODUCT_PHOTOS = {};
['RE10','RE20','RE30','GH50','GH100','ME10','WO20','GL70','KL80','MO10','MO40','TE10','BA50','BP10','CJ10','DS10','GH10','KI10','KP10','NA1000','SK10','SL10','SX10','TB10','TI10','TI20','TI30'].forEach(k => { PRODUCT_PHOTOS[k] = 'assets/products/' + k + '.webp'; });
// Pink (glow) label versions; the ?v bumps past the 7-day asset cache.
['GL70','KL80'].forEach(k => { PRODUCT_PHOTOS[k] += '?v=2'; });

// Top sellers carousel, best first. From POS sales 25 Oct to 23 Nov 2026 (vials sold and number of orders). Edit this list to change the carousel.
const TOP_SELLERS = ['RE20', 'WO20', 'CJ10', 'KL80', 'MO10', 'TE10'];

// ---- Sale (Black Friday) ----
// on:false  → nobody sees it. Open the site with ?bf=1 to preview it on your own device (?bf=0 to leave the preview).
// on:true   → everyone sees it from `starts` until `ends`, then prices go back by themselves.
// pct       → % off every retail price (1, 3 and 5 vials). Wholesale 10-packs are never discounted.
// door      → doorbusters: sku → sale price for ONE vial (packs are that price × vials).
// claim     → the biggest "up to X% off" the headline may say. It is capped at the real biggest saving, so it can't overclaim.
// PLACEHOLDER PRICING: pct and door are stand-ins for the design preview until the real deal is chosen.
const SALE = { on: false, name: 'Black Friday', starts: '2026-11-27T00:00:00+10:00', ends: '2026-11-30T23:59:59+10:00',
  pct: 40, door: { ME10: 23, GH10: 17, GH50: 17 }, claim: 70 };
