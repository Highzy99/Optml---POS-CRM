import sys, os, html
base = sys.argv[1] if len(sys.argv) > 1 else 'https://wpda-protocol-hub.vercel.app'
B = os.path.dirname(os.path.abspath(__file__))
rd = lambda f: open(os.path.join(B, f), encoding='utf-8').read()
shell = rd('shell.html')
lib = rd('htm-preact-standalone.umd.js')
app = '\n'.join(rd(f) for f in ['shopdata.js', 'shop.js', 'app1.js', 'app2.js', 'app3.js', 'app4.js', 'app5.js'])
js_all = rd('data.js') + rd('logic.js') + app
assert '</script' not in js_all.lower() and '</script' not in lib.lower()
title = 'optml · price list and dosing guide'
desc = 'Research-grade peptides with free bac water, batch-matched certificates and a step-by-step dosing guide for every vial. Order on WhatsApp in under a minute.'
og = ''
if base:
    og = '\n'.join([
        f'<link rel="canonical" href="{base}/">',
        '<meta property="og:type" content="website">',
        '<meta property="og:site_name" content="optml">',
        f'<meta property="og:title" content="{html.escape(title)}">',
        f'<meta property="og:description" content="{html.escape(desc)}">',
        f'<meta property="og:url" content="{base}/">',
        f'<meta property="og:image" content="{base}/og.jpg?v=3">',
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        '<meta property="og:image:alt" content="optml price list: research-grade peptides, properly tested">',
        '<meta name="twitter:card" content="summary_large_image">',
        f'<meta name="twitter:title" content="{html.escape(title)}">',
        f'<meta name="twitter:description" content="{html.escape(desc)}">',
        f'<meta name="twitter:image" content="{base}/og.jpg?v=3">',
    ])
out = shell.replace('%%OG%%', og).replace('%%LIB%%', lib).replace('%%DATA%%', rd('data.js')).replace('%%LOGIC%%', rd('logic.js')).replace('%%APP%%', app)
open(os.path.join(B, '..', 'index.html'), 'w', encoding='utf-8').write(out)
print('built', len(out), 'bytes', 'base=' + (base or '(none)'))
