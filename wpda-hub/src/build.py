import sys, os, html
base = sys.argv[1] if len(sys.argv) > 1 else 'https://wpda-protocol-hub.vercel.app'
B = os.path.dirname(os.path.abspath(__file__))
rd = lambda f: open(os.path.join(B, f), encoding='utf-8').read()
shell = rd('shell.html')
lib = rd('htm-preact-standalone.umd.js')
app = '\n'.join(rd(f) for f in ['app1.js', 'app2.js', 'app3.js', 'app4.js', 'app5.js'])
js_all = rd('data.js') + rd('logic.js') + app
assert '</script' not in js_all.lower() and '</script' not in lib.lower()
title = 'WPDA Protocol Hub · exact doses, mixing and protocol builder'
desc = 'See exactly what to draw for every compound in the optml range, learn to mix and inject, and build a protocol you can export as a PDF. Free bac water with every vial.'
og = ''
if base:
    og = '\n'.join([
        f'<link rel="canonical" href="{base}/">',
        '<meta property="og:type" content="website">',
        '<meta property="og:site_name" content="World Peptide Dosage Association">',
        f'<meta property="og:title" content="{html.escape(title)}">',
        f'<meta property="og:description" content="{html.escape(desc)}">',
        f'<meta property="og:url" content="{base}/">',
        f'<meta property="og:image" content="{base}/og.jpg">',
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        '<meta property="og:image:alt" content="WPDA Protocol Hub: every protocol in plain numbers">',
        '<meta name="twitter:card" content="summary_large_image">',
        f'<meta name="twitter:title" content="{html.escape(title)}">',
        f'<meta name="twitter:description" content="{html.escape(desc)}">',
        f'<meta name="twitter:image" content="{base}/og.jpg">',
    ])
out = shell.replace('%%OG%%', og).replace('%%LIB%%', lib).replace('%%DATA%%', rd('data.js')).replace('%%LOGIC%%', rd('logic.js')).replace('%%APP%%', app)
open(os.path.join(B, '..', 'index.html'), 'w', encoding='utf-8').write(out)
print('built', len(out), 'bytes', 'base=' + (base or '(none)'))
