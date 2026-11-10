#!/usr/bin/env python3
"""build-standalone.py — membuat satu file HTML utuh untuk setiap menu (kecuali Beranda).

Setiap file berisi:
  • header (brand, nama menu, jam WIB, Creator/Donate, tema)
  • strip BERITA + cuaca dan strip LIVE SHIFT (sama seperti program utama)
  • halaman menu di dalam iframe srcdoc — seluruh CSS, JS, data & template di-inline
  • screensaver beranimasi saat tidak ada aktivitas
Program utama (index.html + pages/) tidak diubah. Penyimpanan lokal (draft, mode, dll.)
diberi awalan "sa-<menu>:" sehingga file standalone tidak menimpa data program utama.

Pakai:  python3 tools/build-standalone.py [folder-keluaran]   (bawaan: standalone/)
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(ROOT, 'standalone')

MENUS = [
    # id, file halaman, nama file keluaran, label, judul, ikon, warna
    ('shift',    'shift-live.html', 'shift-live.html', 'Shift Live', 'Shift Live',       '◷', '#C6F21B'),
    ('timecode', 'timecode.html',   'timecode.html',   'Timecode',   'Timecode Decoder', '⏱', '#7CC4FF'),
    ('hotspot',  'hotspot.html',    'hotspot.html',    'Hotspot',    'Hotspot Studio',   '✳', '#FF9BC8'),
    ('csv',      'csv-maker.html',  'csv-maker.html',  'CSV Maker',  'CSV Maker',        '▦', '#5EE6B5'),
    ('scene',    'scene-deck.html', 'scene-deck.html', 'Scene Deck', 'Scene Deck',       '▶', '#FFA94D'),
]


def read(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return f.read()


def js_block(code):
    """isi <script> yang aman: cegah penutupan tag di dalam string."""
    return code.replace('</script', '<\\/script').replace('<!--', '<\\!--')


def css_block(code):
    return code.replace('</style', '<\\/style')


STORAGE_SHIM = r"""(function(){var P='sa-%s:';try{var ls=window.localStorage;var keys=function(){var o=[];for(var i=0;i<ls.length;i++){var k=ls.key(i);if(k&&k.indexOf(P)===0)o.push(k.slice(P.length))}return o};
var w={getItem:function(k){return ls.getItem(P+k)},setItem:function(k,v){ls.setItem(P+k,String(v))},removeItem:function(k){ls.removeItem(P+k)},clear:function(){keys().forEach(function(k){ls.removeItem(P+k)})},key:function(i){var k=keys();return i<k.length?k[i]:null}};
Object.defineProperty(w,'length',{get:function(){return keys().length}});
Object.defineProperty(window,'localStorage',{configurable:true,get:function(){return w}});}catch(e){}})();"""


def embed_js():
    code = read('js/core/embed.js')
    # standalone tidak membaca konfigurasi Admin program utama
    code = code.replace("if(params.get('preview')!=='1'){try{cfg=JSON.parse(localStorage.getItem('ca-config-cache'))}catch(_){cfg=null}}",
                        "/* standalone: tanpa konfigurasi Admin */")
    assert 'standalone: tanpa konfigurasi Admin' in code, 'pola embed.js berubah'
    return code


def inline_page(page_file, route):
    html = read('pages/' + page_file)
    emb = embed_js()

    def link_sub(m):
        href = m.group(1)
        if href.startswith('http'):
            return m.group(0)
        return '<style>\n' + css_block(read(os.path.normpath(os.path.join('pages', href)))) + '\n</style>'

    def script_sub(m):
        src = m.group(1)
        if src.startswith('http'):
            return m.group(0)
        rel = os.path.normpath(os.path.join('pages', src))
        if rel.endswith('core/apply.js'):
            return ''                     # tanpa konfigurasi Admin
        code = emb if rel.endswith('core/embed.js') else read(rel)
        return '<script>\n' + js_block(code) + '\n</script>'

    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', link_sub, html)
    html = re.sub(r'<script src="([^"]+)"></script>', script_sub, html)
    shim = '<script>' + STORAGE_SHIM % route + '</script>'
    html = re.sub(r'(<head>)', r'\1\n' + shim.replace('\\', '\\\\'), html, count=1)
    leftover = re.findall(r'(?:src|href)="\.\./[^"]+"', html)
    assert not leftover, (page_file, leftover)
    return html


def section(html, start, end):
    i = html.index(start)
    j = html.index(end, i)
    return html[i:j]


def build_shell(menu, page_html):
    mid, page_file, out_name, label, title, icon, color = menu
    index = read('index.html')
    header = section(index, '<header class="mh" id="masterHeader">', '<main class="stage"')
    # tab menu → satu pil menu aktif
    header = header.replace('<nav class="mh-tabs" id="mhTabs" role="tablist" aria-label="Menu program"></nav>',
        '<nav class="mh-tabs sa-tabs" aria-label="Menu"><span class="mh-tab sa-pill" aria-selected="true" style="--tc:%s"><span class="ti" aria-hidden="true">%s</span><span>%s</span></span><span class="sa-badge">STANDALONE</span></nav>' % (color, icon, label))
    # buang badge peran & tombol sign out & pengumuman (tidak ada login di standalone)
    header = re.sub(r'\s*<span class="mh-role".*?</b></span>', '', header, flags=re.S)
    header = re.sub(r'\s*<button type="button" class="mh-out".*?</button>', '', header, flags=re.S)
    header = re.sub(r'\s*<div class="mh-announce".*?</div>', '', header, flags=re.S)
    header = header.replace('href="#home" data-go="home"', 'href="#" onclick="return false"')
    saver = section(index, '<div class="saver" id="saver"', '<!-- Gerbang masuk')
    saver = re.sub(r'\s*<form class="saver-unlock".*?</form>', '', saver, flags=re.S)
    saver = saver.replace('<button type="button" class="su-btn out" id="saverSignOut">⏻ Sign out</button>', '')
    assert 'mh-out' not in header and 'mh-role' not in header and 'saverSignOut' not in saver

    css = ''.join('/* %s */\n%s\n' % (p, css_block(read(p))) for p in ['css/base.css', 'css/shell.css', 'css/gate.css', 'css/saver.css'])
    css += """
/* ---- standalone ---- */
.sa-tabs{flex:1 1 auto;gap:10px;-webkit-mask:none;mask:none}
.sa-pill{cursor:default}
.sa-pill:hover{transform:none}
.sa-badge{display:inline-flex;align-items:center;min-height:28px;padding:2px 10px;border:2px dashed var(--hdr-line);border-radius:6px;font:700 .64rem/1 var(--ff);letter-spacing:.18em;color:var(--hdr-mut);white-space:nowrap}
.saver{--sv:var(--route)!important}
@media(max-width:760px){.sa-tabs{position:static!important;display:flex!important;grid-template-columns:none!important;padding:0!important;border:0!important;box-shadow:none!important;background:none!important}.sa-badge{display:none}.sa-pill{min-height:36px!important;flex-direction:row!important;font-size:.8rem!important;padding:4px 10px!important}body.shell{padding-bottom:0!important}}
"""
    libs = ['js/data/m-color-snapshot.js', 'js/data/weather-icons.js', 'js/core/shift-core.js',
            'js/shell/ticker.js', 'js/shell/news.js', 'js/shell/weather.js', 'js/shell/live-ticker.js']
    libjs = ''.join('<script>\n/* %s */\n%s\n</script>\n' % (p, js_block(read(p))) for p in libs)
    page_literal = json.dumps(page_html, ensure_ascii=False).replace('</', '<\\/').replace('<!--', '<\\!--')
    cfg = json.dumps({'id': mid, 'label': label, 'title': title, 'icon': icon, 'color': color})
    shell_js = js_block(read('tools/standalone-shell.js'))

    return """<!doctype html>
<html lang="id" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#11141A">
<meta name="description" content="%(title)s — Content Analyst Draft (standalone, satu file).">
<title>%(title)s · Content Analyst</title>
<link rel="icon" href="data:image/svg+xml,%%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%%3E%%3Crect x='4' y='4' width='56' height='56' rx='12' fill='%%2311141A' stroke='%%23C6F21B' stroke-width='6'/%%3E%%3Ccircle cx='32' cy='32' r='14' fill='none' stroke='%%23C6F21B' stroke-width='5'/%%3E%%3Cpath d='M32 24v9l6 4' stroke='%%23C6F21B' stroke-width='5' fill='none' stroke-linecap='round'/%%3E%%3C/svg%%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;600;700;800;900&family=JetBrains+Mono:wght@500;600;700&display=swap">
<script>(function(){var t=null;try{t=localStorage.getItem('sa-theme')}catch(_){}if(!t){try{t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}catch(_){t='dark'}}document.documentElement.dataset.theme=t==='light'?'light':'dark'})();</script>
<style>
%(css)s
</style>
</head>
<body class="shell">
%(header)s
<main class="stage" id="stage" aria-live="polite"></main>

%(saver)s
<div class="toasts" id="toasts" aria-live="polite"></div>

<script>window.CA_STANDALONE=%(cfg)s;</script>
<script>window.CA_STANDALONE_PAGE=%(page)s;</script>
%(libjs)s<script>
%(shell)s
</script>
</body>
</html>
""" % {'title': title, 'css': css, 'header': header, 'saver': saver, 'cfg': cfg, 'page': page_literal, 'libjs': libjs, 'shell': shell_js}


def main():
    os.makedirs(OUT, exist_ok=True)
    for m in MENUS:
        page = inline_page(m[1], m[0])
        html = build_shell(m, page)
        path = os.path.join(OUT, m[2])
        with open(path, 'w', encoding='utf-8') as f:
            f.write(html)
        print('%-16s %8.1f KB' % (m[2], len(html.encode('utf-8')) / 1024))


if __name__ == '__main__':
    main()
