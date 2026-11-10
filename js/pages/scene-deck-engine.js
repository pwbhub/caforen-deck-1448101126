/* Scene Deck template engine — membaca template PPTX 4 slide dan menyusun laporan.
   Revisi: Slide 1 Calibri (ukuran tetap), Slide 2 kolom ringkasan Calibri 16 pt spasi 1,5,
   slide scene Calibri 14 pt spasi 1,0 dengan kotak adaptif untuk breakdown panjang. */
(function (root) {
  'use strict';

  var NS = {
    a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
    p: 'http://schemas.openxmlformats.org/presentationml/2006/main',
    r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    pr: 'http://schemas.openxmlformats.org/package/2006/relationships',
    ct: 'http://schemas.openxmlformats.org/package/2006/content-types',
    ep: 'http://schemas.openxmlformats.org/officeDocument/2006/extended-properties',
    vt: 'http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes'
  };
  var MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  var slideType = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide';
  var imageType = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';
  var xmlParser = function () { return new DOMParser(); };

  function error(message) { throw new Error('Template PowerPoint tidak valid: ' + message); }
  function parseXml(text, label) {
    var doc = xmlParser().parseFromString(String(text), 'application/xml');
    var bad = doc && doc.getElementsByTagName('parsererror');
    if (!doc || (bad && bad.length)) error('XML ' + label + ' rusak.');
    return doc;
  }
  function local(n) { return n && (n.localName || n.nodeName.split(':').pop()); }
  function all(rootNode, name, namespace) {
    var list = namespace && rootNode.getElementsByTagNameNS ? rootNode.getElementsByTagNameNS(namespace, name) : null;
    /* happy-dom versions used by the Node test harness can expose the namespace
       but still return an empty NS collection for parsed Office XML. */
    if (!list || !list.length) {
      list = rootNode.getElementsByTagName(name);
      if (!list || !list.length) {
        var wildcard = rootNode.getElementsByTagName('*');
        list = Array.prototype.filter.call(wildcard || [], function (node) { return local(node) === name; });
      }
    }
    return Array.prototype.slice.call(list || []);
  }
  function first(rootNode, name, namespace) { var x = all(rootNode, name, namespace); return x[0] || null; }
  function attr(node, name) { return node && node.getAttribute(name); }

  /* ---- Metrik Calibri (lebar glyph identik dengan Carlito, unitsPerEm 2048) ----
     Dipakai untuk mengukur teks agar kotak PPT bisa disesuaikan tanpa mengecilkan font. */
  var CAL_UPM = 2048, CAL_LINE = 1.2207; /* (ascent 1536 + descent 512 + lineGap 452) / 2048 */
  var CAL_R = [463,667,821,1020,1038,1464,1397,452,621,621,1020,1020,511,627,517,791,1038,1038,1038,1038,1038,1038,1038,1038,1038,1038,548,548,1020,1020,1020,949,1831,1185,1114,1092,1260,1000,941,1292,1276,516,653,1064,861,1751,1322,1356,1058,1378,1112,941,998,1314,1162,1822,1063,998,959,628,791,628,1020,1020,596,981,1076,866,1076,1019,625,964,1076,470,490,931,470,1636,1076,1080,1076,1076,714,801,686,1076,925,1464,887,927,809,644,943,644,1020];
  var CAL_B = [463,667,898,1020,1038,1493,1443,478,638,638,1020,1020,528,627,547,880,1038,1038,1038,1038,1038,1038,1038,1038,1038,1038,565,565,1020,1020,1020,949,1840,1241,1148,1084,1291,999,940,1305,1292,546,678,1120,866,1790,1349,1385,1090,1405,1153,968,1014,1337,1211,1856,1128,1064,979,665,880,665,1020,1020,615,1011,1099,857,1099,1031,648,971,1099,503,523,983,503,1666,1099,1101,1099,1099,728,817,710,1099,969,1526,941,970,814,704,973,704,1020];
  var EMU_PT = 12700;
  function charEm(ch, bold) {
    var c = ch.charCodeAt(0), t = bold ? CAL_B : CAL_R;
    if (ch === '\u200B') return 0;
    if (ch === '\u00A0') ch = ' ', c = 32;
    if (c >= 32 && c <= 126) return t[c - 32] / CAL_UPM;
    if (c === 0x2013) return 1020 / CAL_UPM; if (c === 0x2014) return 1854 / CAL_UPM;
    if (c >= 0xC0 && c <= 0x24F) return 1040 / CAL_UPM;
    return c > 0x2E80 ? 1 : 1000 / CAL_UPM;
  }
  function textPt(text, sizePt, bold) { var w = 0; for (var i = 0; i < text.length; i++) w += charEm(text.charAt(i), bold); return w * sizePt; }
  /* Bungkus teks: peluang patah setelah spasi, '+', '-', '/', dan zero-width space. */
  function wrapCount(text, firstAvail, restAvail, sizePt, bold) {
    var segs = String(text).match(/[^ \t\r\n+\-\/\u200B]*(?:[ \t\r\n+\-\/\u200B]+|$)/g).filter(function (s) { return s.length; });
    if (!segs.length) return 1;
    var lines = 1, avail = firstAvail, used = 0;
    segs.forEach(function (seg) {
      var w = textPt(seg, sizePt, bold), core = textPt(seg.replace(/[ \t\r\n]+$/, ''), sizePt, bold);
      if (used > 0 && used + core > avail + 0.01) { lines++; avail = restAvail; used = 0; }
      if (used === 0 && core > avail) { /* satu segmen lebih panjang dari baris: patah per karakter */
        for (var i = 0; i < seg.length; i++) { var cw = textPt(seg.charAt(i), sizePt, bold); if (used + cw > avail && used > 0) { lines++; avail = restAvail; used = 0; } used += cw; }
        return;
      }
      used += w;
    });
    return lines;
  }
  function setRunFont(run, typeface, sz) {
    var rPr = first(run, 'rPr', NS.a); if (!rPr) { rPr = run.ownerDocument.createElementNS(NS.a, 'a:rPr'); run.insertBefore(rPr, run.firstChild); }
    if (sz) rPr.setAttribute('sz', String(sz));
    ['latin', 'ea', 'cs'].forEach(function (tag) {
      var n = null; Array.prototype.slice.call(rPr.childNodes).forEach(function (c) { if (c.nodeType === 1 && local(c) === tag) n = c; });
      if (!n) { n = rPr.ownerDocument.createElementNS(NS.a, 'a:' + tag); var after = null; Array.prototype.slice.call(rPr.childNodes).forEach(function (c) { if (c.nodeType === 1 && ['sym', 'hlinkClick', 'hlinkMouseOver', 'rtl', 'extLst'].indexOf(local(c)) >= 0 && !after) after = c; }); rPr.insertBefore(n, after); }
      n.setAttribute('typeface', typeface); n.removeAttribute('panose'); n.removeAttribute('pitchFamily'); n.removeAttribute('charset');
    });
    return rPr;
  }
  function setAllFonts(scope, typeface, sz) {
    all(scope, 'r', NS.a).forEach(function (r) { setRunFont(r, typeface, sz); });
    all(scope, 'endParaRPr', NS.a).concat(all(scope, 'br', NS.a).map(function (b) { return first(b, 'rPr', NS.a); }).filter(Boolean)).forEach(function (rp) {
      if (sz) rp.setAttribute('sz', String(sz));
      var l = null; Array.prototype.slice.call(rp.childNodes).forEach(function (c) { if (c.nodeType === 1 && local(c) === 'latin') l = c; });
      if (l) { l.setAttribute('typeface', typeface); l.removeAttribute('panose'); }
    });
  }
  function setLineSpacing(p, pct) {
    var doc = p.ownerDocument, pPr = first(p, 'pPr', NS.a);
    if (!pPr) { pPr = doc.createElementNS(NS.a, 'a:pPr'); p.insertBefore(pPr, p.firstChild); }
    ['lnSpc', 'spcBef', 'spcAft'].forEach(function (tag) { Array.prototype.slice.call(pPr.childNodes).forEach(function (c) { if (c.nodeType === 1 && local(c) === tag) pPr.removeChild(c); }); });
    var ln = doc.createElementNS(NS.a, 'a:lnSpc'), sp = doc.createElementNS(NS.a, 'a:spcPct'); sp.setAttribute('val', String(Math.round(pct * 1000))); ln.appendChild(sp);
    var bef = doc.createElementNS(NS.a, 'a:spcBef'), bp = doc.createElementNS(NS.a, 'a:spcPts'); bp.setAttribute('val', '0'); bef.appendChild(bp);
    var aft = doc.createElementNS(NS.a, 'a:spcAft'), ap = doc.createElementNS(NS.a, 'a:spcPts'); ap.setAttribute('val', '0'); aft.appendChild(ap);
    pPr.insertBefore(aft, pPr.firstChild); pPr.insertBefore(bef, aft); pPr.insertBefore(ln, bef);
  }
  function setAutofit(bodyPr, kind, scale) {
    if (!bodyPr) return;
    all(bodyPr, 'noAutofit', NS.a).concat(all(bodyPr, 'spAutoFit', NS.a), all(bodyPr, 'normAutofit', NS.a)).forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
    var n = bodyPr.ownerDocument.createElementNS(NS.a, 'a:' + kind); if (kind === 'normAutofit' && scale) n.setAttribute('fontScale', String(Math.round(scale))); bodyPr.appendChild(n);
  }
  function insets(props) {
    var g = function (k, d) { var v = attr(props, k); return v == null || v === '' ? d : Number(v); };
    return { l: g('lIns', 91440), r: g('rIns', 91440), t: g('tIns', 45720), b: g('bIns', 45720) };
  }
  /* ---- Tata letak kotak scene: Calibri 14 pt, spasi 1,0. Kotak tumbuh ke atas,
     lalu melebar ke kiri, dan hanya sebagai jalan terakhir font dikecilkan. ---- */
  var SCENE_FONT = 14, SCENE_SPACING = 1.0, SUMMARY_FONT = 16, SUMMARY_SPACING = 1.5;
  var SCENE_LABEL = 'Breakdown Duration : ';
  function breakdownText(value) { return String(value == null ? '' : value).trim().replace(/\s*\+\s*/g, '+\u200B'); }
  /* TCR IN dan TCR OUT dalam satu baris; spasi tak-putus menjaga tiap pasangan tetap utuh
     sehingga bila kotak sempit, TCR OUT pindah baris secara rapi. */
  var EMBED_TYPES = ['Signage Billboard', 'Signage Building Wrap', 'Signage Vehicle Wrap', 'Signage Store Front', 'Signage Poster', 'Signage Trailer', 'Signage Table Talker', 'Product Placement', 'Calendar Placement', 'Book Placement', 'TVC Placement', 'Screen Replacement'];
  /* KEY LOGO tetap tersedia sebagai jenis khusus (dijumlahkan ke nilai KEY LOGO di slide 2). */
  var SPECIAL_TYPES = ['KEY LOGO'];
  /* jenis lama tetap diterima agar draft versi sebelumnya bisa dibuka & diekspor */
  var LEGACY_TYPES = ['Poster Board', 'Stand Signage', 'Object Placement'];
  var NB = '\u00A0';
  function tcrLine(scene) { return 'TCR' + NB + 'IN' + NB + ':' + NB + scene.tcrIn + '   TCR' + NB + 'OUT' + NB + ':' + NB + scene.tcrOut; }
  function sceneRows(scene, index, sum) {
    return ['Scene ' + String(index + 1).padStart(2, '0'), 'Duration Of Exposure : ' + sum + ' s', SCENE_LABEL + breakdownText(scene.breakdown), 'Locale : ' + scene.locale, 'Embed Type : ' + scene.embedType, tcrLine(scene)];
  }
  function sceneLayout(scene, index, sum, box, slide) {
    box = box || { x: 8505360, y: 5153040, cx: 3526200, cy: 1383540, l: 90000, r: 90000, t: 45000, b: 45000 };
    slide = slide || { w: 12192000, h: 6858000 };
    var rows = sceneRows(scene, index, sum), right = box.x + box.cx, bottom = box.y + box.cy;
    var labelPt = textPt(SCENE_LABEL, SCENE_FONT, false);
    var lineH = SCENE_FONT * CAL_LINE * SCENE_SPACING;
    function measure(cx, scale) {
      var size = SCENE_FONT * (scale || 1), avail = (cx - box.l - box.r) / EMU_PT - 0.5, hang = Math.min(labelPt * (scale || 1), avail * 0.55), lines = 0;
      rows.forEach(function (row, i) { lines += i === 2 ? wrapCount(row, avail, avail - hang, size, false) : wrapCount(row, avail, avail, size, false); });
      return { lines: lines, cy: Math.ceil((lines * lineH * (scale || 1) + 2) * EMU_PT) + box.t + box.b, hang: hang };
    }
    var maxCx = Math.round(slide.w * 0.6), maxCyA = Math.round(slide.h * 0.42), topLimit = Math.round(slide.h * 0.047), maxCyB = bottom - topLimit;
    var cx = box.cx, m = measure(cx, 1);
    while (m.cy > maxCyA && cx < maxCx) { cx = Math.min(maxCx, cx + Math.round(slide.w * 0.04)); m = measure(cx, 1); }
    var scale = 1;
    if (m.cy > maxCyB) { while (scale > 0.4) { scale -= 0.02; m = measure(cx, scale); if (m.cy <= maxCyB) break; } }
    var cy = Math.max(m.cy, Math.min(box.cy, m.cy));
    return { x: right - cx, y: bottom - cy, cx: cx, cy: cy, lines: m.lines, fontScale: scale, hangPt: m.hang, grew: cx > box.cx || cy > box.cy };
  }
  function relAttr(node) {
    if (!node) return null;
    var value = node.getAttributeNS && node.getAttributeNS(NS.r, 'id');
    if (value) return value;
    value = node.getAttribute('r:id');
    if (value) return value;
    var attrs = node.attributes || [];
    for (var i = 0; i < attrs.length; i++) if (attrs[i].name === 'r:id' || (attrs[i].localName === 'id' && attrs[i].namespaceURI === NS.r)) return attrs[i].value;
    return null;
  }
  function setRelAttr(node, value) { node.setAttributeNS(NS.r, 'r:id', value); }
  function embedAttr(node) {
    if (!node) return null;
    var value = node.getAttributeNS && node.getAttributeNS(NS.r, 'embed');
    if (value) return value;
    value = node.getAttribute('r:embed');
    if (value) return value;
    var attrs = node.attributes || [];
    for (var i = 0; i < attrs.length; i++) if (attrs[i].name === 'r:embed' || (attrs[i].localName === 'embed' && attrs[i].namespaceURI === NS.r)) return attrs[i].value;
    return null;
  }
  function textOf(node) {
    if (!node) return '';
    if (node.nodeType === 9 && node.documentElement) return node.documentElement.textContent || '';
    return node.textContent || '';
  }
  function packagePath(path) { return String(path).replace(/^\/+/, ''); }
  function safeZipPath(path) {
    path = String(path || '').replace(/\\/g, '/');
    if (!path || path.charAt(0) === '/' || path.indexOf('\0') >= 0) return false;
    var parts = path.split('/');
    return parts.every(function (p) { return p && p !== '.' && p !== '..'; });
  }
  function dirname(path) { var i = path.lastIndexOf('/'); return i < 0 ? '' : path.slice(0, i); }
  function resolvePath(base, target) {
    target = String(target || '').replace(/\\/g, '/');
    if (/^[a-z]+:/i.test(target) || target.charAt(0) === '/') return null;
    var parts = (dirname(base) + '/' + target).split('/');
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      if (!parts[i] || parts[i] === '.') continue;
      if (parts[i] === '..') { if (!out.length) return null; out.pop(); }
      else out.push(parts[i]);
    }
    var result = out.join('/');
    return safeZipPath(result) ? result : null;
  }
  function zipNames(zip) {
    var names = [];
    zip.forEach(function (name, file) { if (!file.dir) names.push(packagePath(name)); });
    return names;
  }
  function getZipFile(zip, path) { return zip.file(packagePath(path)); }
  function bytesToDataUrl(bytes, ext) {
    var b64;
    if (typeof Buffer !== 'undefined') b64 = Buffer.from(bytes).toString('base64');
    else { var s = ''; for (var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); b64 = btoa(s); }
    var mime = ext.toLowerCase() === 'png' ? 'image/png' : (ext.toLowerCase() === 'jpg' || ext.toLowerCase() === 'jpeg' ? 'image/jpeg' : 'application/octet-stream');
    return 'data:' + mime + ';base64,' + b64;
  }
  function dataUrlBytes(url) {
    if (typeof url !== 'string') error('Gambar harus berupa data URL.');
    var m = /^data:image\/(png|jpeg|jpg);base64,([A-Za-z0-9+/=\s]+)$/i.exec(url.trim());
    if (!m) error('Format gambar harus PNG atau JPEG data URL (WebP dikonversi sebelum ekspor).');
    var raw;
    try {
      if (typeof Buffer !== 'undefined') raw = new Uint8Array(Buffer.from(m[2].replace(/\s/g, ''), 'base64'));
      else { var s = atob(m[2].replace(/\s/g, '')); raw = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) raw[i] = s.charCodeAt(i); }
    } catch (e) { error('Data gambar tidak dapat dibaca.'); }
    if (m[1].toLowerCase() === 'png') {
      if (raw.length < 24 || raw[0] !== 137 || raw[1] !== 80 || raw[2] !== 78 || raw[3] !== 71) error('PNG gambar tidak valid.');
    } else if (raw.length < 3 || raw[0] !== 255 || raw[1] !== 216 || raw[2] !== 255) error('JPEG gambar tidak valid.');
    return { bytes: raw, ext: m[1].toLowerCase() === 'jpg' ? 'jpeg' : m[1].toLowerCase(), mime: 'image/' + (m[1].toLowerCase() === 'jpg' ? 'jpeg' : m[1].toLowerCase()) };
  }
  function imageSize(bytes, ext) {
    if (ext === 'png' && bytes.length >= 24) return { w: (bytes[16] << 24 | bytes[17] << 16 | bytes[18] << 8 | bytes[19]) >>> 0, h: (bytes[20] << 24 | bytes[21] << 16 | bytes[22] << 8 | bytes[23]) >>> 0 };
    if (ext === 'jpeg') {
      var i = 2;
      while (i + 9 < bytes.length) { if (bytes[i] !== 255) { i++; continue; } var marker = bytes[i + 1]; var len = (bytes[i + 2] << 8) | bytes[i + 3]; if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) return { w: (bytes[i + 7] << 8) | bytes[i + 8], h: (bytes[i + 5] << 8) | bytes[i + 6] }; if (!len) break; i += 2 + len; }
    }
    return null;
  }
  function parseBreakdown(value) {
    var result = { valid: false, total: 0, parts: [], error: '' };
    if (typeof value !== 'string' || !value.trim()) { result.error = 'Breakdown wajib diisi.'; return result; }
    var s = value.trim();
    var tokens = s.split('+');
    if (!tokens.length || tokens.some(function (x) { return !/^\s*(?:\d+(?:[.,]\d+)?|[.,]\d+)\s*$/.test(x); })) { result.error = 'Breakdown hanya boleh berisi angka nonnegatif yang dipisahkan tanda +.'; return result; }
    var total = 0;
    for (var i = 0; i < tokens.length; i++) {
      var n = Number(tokens[i].trim().replace(',', '.'));
      if (!Number.isFinite(n) || n < 0 || n > Number.MAX_SAFE_INTEGER || total > Number.MAX_SAFE_INTEGER - n) { result.error = 'Total breakdown terlalu besar atau tidak aman.'; return result; }
      result.parts.push(n); total += n;
    }
    result.valid = Number.isFinite(total) && total <= Number.MAX_SAFE_INTEGER;
    result.total = total;
    return result;
  }
  function summarize(scenes) {
    var result = { sceneCount: Array.isArray(scenes) ? scenes.length : 0, outdoor: 0, indoor: 0, total: 0, keyLogo: 0, keyLogoCount: 0, valid: Array.isArray(scenes) };
    if (!Array.isArray(scenes)) return result;
    scenes.forEach(function (scene) {
      var b = parseBreakdown(scene && scene.breakdown);
      if (!b.valid) { result.valid = false; return; }
      if (scene.locale === 'Outdoor') result.outdoor += b.total;
      else if (scene.locale === 'Indoor') result.indoor += b.total;
      else result.valid = false;
      if (scene.embedType === 'KEY LOGO') { result.keyLogo += b.total; result.keyLogoCount++; }
    });
    result.total = result.outdoor + result.indoor;
    if (!Number.isFinite(result.total) || result.total > Number.MAX_SAFE_INTEGER) result.valid = false;
    return result;
  }
  function validateTimecode(value, fps) {
    fps = fps === undefined ? 25 : fps;
    if (!Number.isInteger(fps) || fps < 1 || fps > 100 || typeof value !== 'string' || !/^\d{2}:\d{2}:\d{2}:\d{2}$/.test(value)) return false;
    var p = value.split(':').map(Number);
    return p[0] >= 0 && p[0] <= 99 && p[1] < 60 && p[2] < 60 && p[3] < fps;
  }
  function safeFilename(subtitle) {
    var s = String(subtitle == null ? '' : subtitle).replace(/\.pptx$/i, '').trim();
    s = s.replace(/[\u2012-\u2015\u2212]/g, '-');  /* em/en dash → '-' agar nama file aman di semua sistem */
    s = s.replace(/[<>:"/\\|?*\x00-\x1F\x7F]/g, '_').replace(/[.\s]+$/g, '').trim();
    if (!s) s = 'scenedeck';
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(s)) s = '_' + s;
    if (Array.from(s).length > 120) s = Array.from(s).slice(0, 120).join('').replace(/[.\s]+$/g, '') || 'scenedeck';
    return s + '.pptx';
  }
  function setText(node, value) { while (node.firstChild) node.removeChild(node.firstChild); node.appendChild(node.ownerDocument.createTextNode(String(value))); }
  function replaceExactText(doc, marker, value) {
    var changed = false;
    all(doc, 't', NS.a).forEach(function (t) { if (textOf(t) === marker) { setText(t, value); changed = true; } });
    return changed;
  }
  function setNormAutofit(bodyPr, scale) {
    if (!bodyPr) return;
    all(bodyPr, 'noAutofit', NS.a).concat(all(bodyPr, 'spAutoFit', NS.a), all(bodyPr, 'normAutofit', NS.a)).forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
    var n = bodyPr.ownerDocument.createElementNS(NS.a, 'a:normAutofit'); n.setAttribute('fontScale', String(scale || 85000)); n.setAttribute('lnSpcReduction', '10000'); bodyPr.appendChild(n);
  }
  function fitTextShape(shape) {
    var body = first(shape, 'txBody', NS.p), props = body && first(body, 'bodyPr', NS.a), xfrm = first(shape, 'xfrm', NS.a), ext = xfrm && first(xfrm, 'ext', NS.a);
    if (!body || !props || !ext) return;
    var ins = insets(props), width = (Number(attr(ext, 'cx')) - ins.l - ins.r) / EMU_PT, height = (Number(attr(ext, 'cy')) - ins.t - ins.b) / EMU_PT;
    var paras = all(body, 'p', NS.a).map(function (p) {
      var pPr = first(p, 'pPr', NS.a), runs = all(p, 'r', NS.a), rp = runs.length && first(runs[0], 'rPr', NS.a);
      var size = rp && Number(attr(rp, 'sz')) ? Number(attr(rp, 'sz')) / 100 : 18, bold = rp && attr(rp, 'b') === '1';
      var marL = pPr && Number(attr(pPr, 'marL')) ? Number(attr(pPr, 'marL')) / EMU_PT : 0;
      var ln = pPr && first(pPr, 'spcPct', NS.a), pct = ln ? Number(attr(ln, 'val')) / 100000 : 1;
      var bef = pPr && first(pPr, 'spcPts', NS.a), befPt = bef ? Number(attr(bef, 'val')) / 100 : 0;
      return { text: runs.map(function (r) { return textOf(first(r, 't', NS.a)); }).join(''), size: size, bold: bold, avail: Math.max(10, width - marL), pct: pct, bef: befPt };
    });
    function need(scale) { return paras.reduce(function (h, p, i) { var lines = wrapCount(p.text, p.avail, p.avail, p.size * scale, p.bold); return h + lines * p.size * scale * CAL_LINE * p.pct + (i ? p.bef : 0); }, 0); }
    if (need(1) <= height) return; /* muat: ukuran font template dipertahankan */
    var scale = 1; while (scale > 0.3 && need(scale) > height) scale -= 0.02;
    setAutofit(props, 'normAutofit', Math.max(25000, Math.round(scale * 100000)));
  }
  function relationshipMap(relDoc) {
    var out = {}; all(relDoc, 'Relationship').forEach(function (r) { out[attr(r, 'Id')] = r; }); return out;
  }
  function pictureInfo(slideDoc, relDoc) {
    var pics = all(slideDoc, 'pic', NS.p), rels = relationshipMap(relDoc);
    var imageRels = Object.keys(rels).map(function (key) { return rels[key]; }).filter(function (r) { return attr(r, 'Type') === imageType; });
    for (var i = 0; i < pics.length; i++) {
      var blip = first(pics[i], 'blip', NS.a), rid = embedAttr(blip), relation = rid && rels[rid];
      /* Some lightweight DOM parsers omit r:embed during XML parsing. The
         picture and image relationship order is still stable in Office XML. */
      if (!relation) relation = imageRels[i] || imageRels[0];
      if (blip && relation) return { pic: pics[i], blip: blip, rel: relation };
    }
    return null;
  }
  function relationshipOwner(relPath) {
    relPath = packagePath(relPath);
    if (relPath === '_rels/.rels') return '';
    var marker = '/_rels/';
    var at = relPath.indexOf(marker);
    if (at < 0 || !/\.rels$/i.test(relPath)) return null;
    return relPath.slice(0, at) + '/' + relPath.slice(at + marker.length).replace(/\.rels$/i, '');
  }
  function validateRelationships(zip, names, path) {
    var relPath = dirname(path) + '/_rels/' + path.slice(path.lastIndexOf('/') + 1) + '.rels';
    var f = getZipFile(zip, relPath); if (!f) return Promise.resolve();
    return f.async('string').then(function (s) { var d = parseXml(s, relPath); all(d, 'Relationship').forEach(function (r) { if (attr(r, 'TargetMode') === 'External') return; var target = resolvePath(path, attr(r, 'Target')); if (!target || names.indexOf(target) < 0) error('relationship ' + path + ' menunjuk file yang hilang.'); }); });
  }
  async function loadTemplate(arrayBuffer) {
    if (typeof JSZip === 'undefined') error('JSZip belum tersedia.');
    if (!arrayBuffer || (arrayBuffer.byteLength !== undefined && arrayBuffer.byteLength > 30 * 1024 * 1024)) error('Ukuran template maksimal 30 MB.');
    var bytes = arrayBuffer instanceof Uint8Array ? new Uint8Array(arrayBuffer) : new Uint8Array(arrayBuffer);
    var zip; try { zip = await JSZip.loadAsync(bytes); } catch (e) { error('file PPTX tidak dapat dibuka.'); }
    var names = zipNames(zip); if (names.length > 2000) error('template memiliki terlalu banyak file.');
    var total = 0; for (var ni = 0; ni < names.length; ni++) { var zf = getZipFile(zip, names[ni]); if (!safeZipPath(names[ni])) error('path paket tidak aman.'); if (zf._data) { if (zf._data.uncompressedSize > 25 * 1024 * 1024) error('ada bagian template yang terlalu besar.'); total += zf._data.uncompressedSize || 0; } if (total > 160 * 1024 * 1024) error('Paket template setelah dekompresi terlalu besar.'); }
    var presPath = 'ppt/presentation.xml', relPath = 'ppt/_rels/presentation.xml.rels';
    if (names.indexOf(presPath) < 0 || names.indexOf(relPath) < 0) error('presentation.xml atau relationship presentasi tidak ditemukan.');
    var presXml = await getZipFile(zip, presPath).async('string');
    var pres = parseXml(presXml, presPath);
    var presRels = parseXml(await getZipFile(zip, relPath).async('string'), relPath), rm = relationshipMap(presRels);
    var sldLst = first(pres, 'sldIdLst', NS.p); if (!sldLst) error('daftar slide tidak ditemukan.');
    var ids = all(sldLst, 'sldId', NS.p), seenIds = {}, slidePaths = [], rawRelIds = [], rawRelMatch, rawRelRe = /<p:sldId\b[^>]*\br:id\s*=\s*["']([^"']+)["']/g;
    while ((rawRelMatch = rawRelRe.exec(presXml))) rawRelIds.push(rawRelMatch[1]);
    ids.forEach(function (id, index) { var sid = attr(id, 'id'); if (seenIds[sid]) error('ID slide duplikat.'); seenIds[sid] = true; var rid = relAttr(id) || rawRelIds[index]; var r = rm[rid]; if (!r || attr(r, 'Type') !== slideType) error('relationship slide tidak valid.'); var p = resolvePath(presPath, attr(r, 'Target')); if (!p || names.indexOf(p) < 0) error('slide target tidak ditemukan.'); slidePaths.push(p); });
    if (slidePaths.length !== 4) error('template harus memiliki tepat 4 slide.');
    for (var ri = 0; ri < names.length; ri++) if (/\.rels$/i.test(names[ri])) { var owner = relationshipOwner(names[ri]); if (owner !== null) await validateRelationships(zip, names, owner); }
    var slides = [], slideRels = [];
    for (var si = 0; si < slidePaths.length; si++) { var sp = slidePaths[si], sd = parseXml(await getZipFile(zip, sp).async('string'), sp), rp = dirname(sp) + '/_rels/' + sp.slice(sp.lastIndexOf('/') + 1) + '.rels', rd = parseXml(await getZipFile(zip, rp).async('string'), rp); slides.push(sd); slideRels.push(rd); }
    var coverText = textOf(slides[0]), summaryText = textOf(slides[1]), sceneText = textOf(slides[2]);
    var coverMarkers = all(slides[0], 't', NS.a).map(textOf);
    if (coverMarkers.indexOf('TITLE') < 0 || coverMarkers.indexOf('SUBTITLE') < 0) error('slide cover harus memiliki placeholder TITLE dan SUBTITLE utuh.');
    if (summaryText.indexOf('SUBNAME') < 0 || summaryText.indexOf('SHOW DURATION') < 0 || summaryText.indexOf('NUMBER OF AVAILABLE SCENE') < 0) error('slide ringkasan tidak memiliki marker yang diperlukan.');
    if (sceneText.indexOf('Scene') < 0 || sceneText.indexOf('Breakdown Duration') < 0 || !pictureInfo(slides[0], slideRels[0]) || !pictureInfo(slides[1], slideRels[1]) || !pictureInfo(slides[2], slideRels[2])) error('slide cover, ringkasan, dan scene harus memiliki marker serta gambar editable.');
    var previews = {}, previewNames = ['cover', 'summary', 'scene', 'ending', 'logo'];
    for (var pi = 0; pi < 4; pi++) { var info = pictureInfo(slides[pi], slideRels[pi]); if (info) { var target = resolvePath(slidePaths[pi], attr(info.rel, 'Target')), ext = target.split('.').pop().toLowerCase(); previews[previewNames[pi]] = bytesToDataUrl(await getZipFile(zip, target).async('uint8array'), ext); } }
    var coverPics = all(slides[0], 'pic', NS.p); if (coverPics.length > 1) { var logoBlip = first(coverPics[1], 'blip', NS.a), logoRels = relationshipMap(slideRels[0]), lr = logoRels[embedAttr(logoBlip)]; if (!lr) { var logoCandidates = Object.keys(logoRels).map(function (key) { return logoRels[key]; }).filter(function (r) { return attr(r, 'Type') === imageType; }); lr = logoCandidates[logoCandidates.length - 1]; } if (lr) { var lp = resolvePath(slidePaths[0], attr(lr, 'Target')); if (lp && getZipFile(zip, lp)) previews.logo = bytesToDataUrl(await getZipFile(zip, lp).async('uint8array'), lp.split('.').pop()); } }
    if (!previews.logo) previews.logo = previews.cover || null;
    /* logo besar pada slide penutup (gambar kedua slide 4) untuk pratinjau */
    var endPics = all(slides[3], 'pic', NS.p);
    if (endPics.length > 1) { try { var eRels = relationshipMap(slideRels[3]), eb = first(endPics[1], 'blip', NS.a), er = eRels[embedAttr(eb)]; if (!er) { var ec = Object.keys(eRels).map(function (k) { return eRels[k]; }).filter(function (r) { return attr(r, 'Type') === imageType; }); er = ec[1] || null; } if (er) { var ep = resolvePath(slidePaths[3], attr(er, 'Target')); if (ep && getZipFile(zip, ep)) previews.endingLogo = bytesToDataUrl(await getZipFile(zip, ep).async('uint8array'), ep.split('.').pop()); } } catch (e) { /* opsional */ } }
    var size = first(pres, 'sldSz', NS.p), sceneBox = null;
    all(slides[2], 'sp', NS.p).some(function (sp) { var tx = first(sp, 'txBody', NS.p); if (!tx || textOf(tx).indexOf('Breakdown Duration') < 0) return false; var x = first(sp, 'xfrm', NS.a), o = x && first(x, 'off', NS.a), e = x && first(x, 'ext', NS.a), bp = first(tx, 'bodyPr', NS.a), ins = insets(bp); if (o && e) sceneBox = { x: Number(attr(o, 'x')), y: Number(attr(o, 'y')), cx: Number(attr(e, 'cx')), cy: Number(attr(e, 'cy')), l: ins.l, r: ins.r, t: ins.t, b: ins.b }; return true; });
    return { sceneBox: sceneBox, originalBytes: new Uint8Array(bytes), zip: zip, slidePaths: slidePaths, width: Number(attr(size, 'cx')) || 12192000, height: Number(attr(size, 'cy')) || 6858000, previewImages: previews, _presentation: presPath, _presentationRels: relPath, _slides: slides, _slideRels: slideRels, _slideRelIds: rawRelIds };
  }
  function ensurePictureContain(pic, image) {
    var xfrm = first(pic, 'xfrm', NS.a), off = xfrm && first(xfrm, 'off', NS.a), ext = xfrm && first(xfrm, 'ext', NS.a); if (xfrm && off && ext && image) { var w = Number(attr(ext, 'cx')), h = Number(attr(ext, 'cy')), ratio = image.w / image.h, frame = w / h, nw = w, nh = h; if (ratio > frame) nh = Math.round(w / ratio); else nw = Math.round(h * ratio); off.setAttribute('x', String(Number(attr(off, 'x')) + Math.round((w - nw) / 2))); off.setAttribute('y', String(Number(attr(off, 'y')) + Math.round((h - nh) / 2))); ext.setAttribute('cx', String(nw)); ext.setAttribute('cy', String(nh)); }
    var fill = first(pic, 'blipFill', NS.p); if (fill) { var src = first(fill, 'srcRect', NS.a); if (src) Array.prototype.slice.call(src.attributes || []).forEach(function (a) { src.removeAttribute(a.name); }); var stretch = first(fill, 'stretch', NS.a); if (!stretch) { stretch = pic.ownerDocument.createElementNS(NS.a, 'a:stretch'); fill.appendChild(stretch); } if (!first(stretch, 'fillRect', NS.a)) stretch.appendChild(pic.ownerDocument.createElementNS(NS.a, 'a:fillRect')); }
  }
  function setImage(slideDoc, relDoc, slidePath, dataUrl, zip, stem) {
    if (!dataUrl) return Promise.resolve();
    var image = dataUrlBytes(dataUrl), info = pictureInfo(slideDoc, relDoc); if (!info) error('picture editable tidak ditemukan pada ' + slidePath + '.');
    var target = 'ppt/media/' + stem + '.' + image.ext, relTarget = '../media/' + stem + '.' + image.ext;
    zip.file(target, image.bytes);
    info.rel.setAttribute('Target', relTarget); info.rel.setAttribute('Type', imageType); ensurePictureContain(info.pic, imageSize(image.bytes, image.ext));
    info.blip.setAttributeNS(NS.r, 'r:embed', attr(info.rel, 'Id'));
    return Promise.resolve();
  }
  function cloneRun(doc, sourceRun, value) { var r = sourceRun ? sourceRun.cloneNode(true) : doc.createElementNS(NS.a, 'a:r'); var t = first(r, 't', NS.a); if (!t) { t = doc.createElementNS(NS.a, 'a:t'); r.appendChild(t); } setText(t, value); return r; }
  function makeParagraph(doc, styleRun, value, tabValue) {
    var p = doc.createElementNS(NS.a, 'a:p'), pp = doc.createElementNS(NS.a, 'a:pPr'); pp.setAttribute('defTabSz', '914400'); var tabs = doc.createElementNS(NS.a, 'a:tabLst'), tab = doc.createElementNS(NS.a, 'a:tab'); tab.setAttribute('pos', '4389120'); tab.setAttribute('algn', 'l'); tabs.appendChild(tab); pp.appendChild(tabs); p.appendChild(pp); p.appendChild(cloneRun(doc, styleRun, tabValue === undefined ? value : value + '\t' + tabValue)); return p;
  }
  /* Nilai ringkasan slide 2: durasi + " MINS", detik + " S", nilai nol ditampilkan "-". */
  function secondsLabel(v) { var n = Number(v); return !Number.isFinite(n) || n === 0 ? '-' : String(Math.round(n * 1e6) / 1e6) + ' S'; }
  function summaryPairs(data, sums) {
    return [
      [['SHOW DURATION', data.showDuration + ' MINS'], ['NUMBER OF AVAILABLE SCENE', data.scenes.length ? String(data.scenes.length) : '-']],
      [['EPISODE NUMBER', String(data.episodeNumber)], ['TOTAL SECONDS OF EXPOSURE', secondsLabel(sums.total)]],
      [['Outdoor', secondsLabel(sums.outdoor)], ['Indoor', secondsLabel(sums.indoor)]],
      [['KEY LOGO', secondsLabel(sums.keyLogo)], ['TX Date', data.txDate || '']]
    ];
  }
  function updateSummary(doc, data, sums, slideH) {
    if (!replaceExactText(doc, 'SUBNAME', data.subtitle)) error('marker SUBNAME tidak ditemukan.');
    var shapes = all(doc, 'sp', NS.p), shape = null;
    shapes.some(function (sp) { var tx = first(sp, 'txBody', NS.p); if (tx && textOf(tx).indexOf('SHOW DURATION') >= 0) { shape = sp; return true; } return false; });
    if (!shape) error('kotak ringkasan tidak ditemukan.');
    var body = first(shape, 'txBody', NS.p), oldPs = all(body, 'p', NS.a), styleRun = oldPs.length && first(oldPs[0], 'r', NS.a); if (!styleRun) error('gaya teks ringkasan tidak ditemukan.');
    var vals = summaryPairs(data, sums).map(function (row) { return row.map(function (c) { return c[0] + ' : ' + c[1]; }); });
    oldPs.forEach(function (p) { body.removeChild(p); });
    vals.forEach(function (v) { var p = makeParagraph(doc, styleRun, v[0], v[1]); setLineSpacing(p, SUMMARY_SPACING * 100); body.appendChild(p); });
    /* Slide 2: seluruh teks Calibri; kolom ringkasan 16 pt dengan spasi baris 1,5. */
    all(doc, 'sp', NS.p).forEach(function (sp) { var tx = first(sp, 'txBody', NS.p); if (tx) setAllFonts(tx, 'Calibri', sp === shape ? SUMMARY_FONT * 100 : 0); });
    var props = first(body, 'bodyPr', NS.a), xfrm = first(shape, 'xfrm', NS.a), off = xfrm && first(xfrm, 'off', NS.a), ext = xfrm && first(xfrm, 'ext', NS.a);
    setAutofit(props, 'spAutoFit');
    if (off && ext) {
      var ins = insets(props), avail = (Number(attr(ext, 'cx')) - ins.l - ins.r) / EMU_PT, tab = 4389120 / EMU_PT, lines = 0;
      vals.forEach(function (v) { var left = textPt(v[0], SUMMARY_FONT, true), start = left < tab - 2 ? tab : Math.ceil((left + 1) / 72) * 72, right = textPt(v[1], SUMMARY_FONT, true); lines += start + right <= avail ? 1 : 1 + wrapCount(v[1], avail, avail, SUMMARY_FONT, true); });
      var cy = Math.ceil((lines * SUMMARY_FONT * CAL_LINE * SUMMARY_SPACING + 2) * EMU_PT) + ins.t + ins.b, y = Number(attr(off, 'y')), limit = (slideH || 6858000) - 228600;
      if (y + cy > limit) y = Math.max(0, limit - cy);
      off.setAttribute('y', String(y)); ext.setAttribute('cy', String(cy));
    }
  }
  function updateScene(doc, scene, index, sum, slideSize) {
    var shapes = all(doc, 'sp', NS.p), shape = null; shapes.some(function (sp) { var tx = first(sp, 'txBody', NS.p); if (tx && textOf(tx).indexOf('Breakdown Duration') >= 0) { shape = sp; return true; } return false; }); if (!shape) error('kotak scene tidak ditemukan.');
    var body = first(shape, 'txBody', NS.p), oldPs = all(body, 'p', NS.a), styleRun = oldPs.length && first(oldPs[0], 'r', NS.a); if (!styleRun) error('gaya teks scene tidak ditemukan.');
    var props = first(body, 'bodyPr', NS.a), xfrm = first(shape, 'xfrm', NS.a), off = xfrm && first(xfrm, 'off', NS.a), ext = xfrm && first(xfrm, 'ext', NS.a), ins = insets(props);
    var box = { x: Number(attr(off, 'x')), y: Number(attr(off, 'y')), cx: Number(attr(ext, 'cx')), cy: Number(attr(ext, 'cy')), l: ins.l, r: ins.r, t: ins.t, b: ins.b };
    var lay = sceneLayout(scene, index, sum, box, slideSize);
    var rows = sceneRows(scene, index, sum); oldPs.forEach(function (p) { body.removeChild(p); });
    rows.forEach(function (row, i) {
      var p = makeParagraph(doc, styleRun, row); setLineSpacing(p, SCENE_SPACING * 100);
      var pPr = first(p, 'pPr', NS.a); pPr.setAttribute('algn', 'l');
      if (i === 2) { var hang = Math.round(lay.hangPt * EMU_PT); pPr.setAttribute('marL', String(hang)); pPr.setAttribute('indent', String(-hang)); }
      body.appendChild(p);
    });
    setAllFonts(body, 'Calibri', SCENE_FONT * 100);
    props.setAttribute('wrap', 'square'); props.setAttribute('anchor', 'b');
    if (lay.fontScale < 1) setAutofit(props, 'normAutofit', Math.round(lay.fontScale * 100000)); else setAutofit(props, 'spAutoFit');
    off.setAttribute('x', String(lay.x)); off.setAttribute('y', String(lay.y)); ext.setAttribute('cx', String(lay.cx)); ext.setAttribute('cy', String(lay.cy));
  }
  function updateAppMetadata(app, data) {
    var count = data.scenes.length + 3, slideCount = first(app, 'Slides', NS.ep);
    if (slideCount) setText(slideCount, count);
    var heading = first(app, 'HeadingPairs', NS.ep), variants = heading ? all(heading, 'variant', NS.vt) : [];
    var beforeTitles = 0;
    for (var i = 0; i + 1 < variants.length; i += 2) {
      var name = first(variants[i], 'lpstr', NS.vt), value = first(variants[i + 1], 'i4', NS.vt);
      if (textOf(name) === 'Slide Titles') { if (value) setText(value, count); break; }
      beforeTitles += Number(textOf(value)) || 0;
    }
    var titles = first(app, 'TitlesOfParts', NS.ep), vector = titles && first(titles, 'vector', NS.vt);
    if (vector) {
      var existing = all(vector, 'lpstr', NS.vt);
      existing.slice(beforeTitles).forEach(function (node) { vector.removeChild(node); });
      var names = [data.title, data.subtitle].concat(data.scenes.map(function (_, index) { return 'Scene ' + String(index + 1).padStart(2, '0'); }), ['THANK YOU']);
      names.forEach(function (name) { var node = app.createElementNS(NS.vt, 'vt:lpstr'); setText(node, name); vector.appendChild(node); });
      vector.setAttribute('size', String(all(vector, 'lpstr', NS.vt).length));
    }
  }
  function validateData(data) {
    if (!data || typeof data !== 'object') error('data ekspor tidak ditemukan.');
    if (typeof data.title !== 'string' || !data.title.trim() || typeof data.subtitle !== 'string' || !data.subtitle.trim()) error('TITLE dan SUBTITLE wajib diisi.');
    if (!validateTimecode(data.showDuration, data.fps === undefined ? 25 : data.fps)) error('SHOW DURATION atau FPS tidak valid.');
    if (data.episodeNumber === '' || data.episodeNumber == null || !Number.isInteger(Number(data.episodeNumber)) || Number(data.episodeNumber) < 0 || Number(data.episodeNumber) > 99) error('EPISODE NUMBER harus bilangan bulat 0–99.');
    if (!Array.isArray(data.scenes) || !data.scenes.length || data.scenes.length > 500) error('Jumlah scene harus 1–500.');
    var sums = summarize(data.scenes); if (!sums.valid) error('Locale atau breakdown scene tidak valid.');
    var types = EMBED_TYPES.concat(SPECIAL_TYPES, LEGACY_TYPES);
    data.scenes.forEach(function (s, i) { if (!s || !validateTimecode(s.tcrIn, data.fps) || !validateTimecode(s.tcrOut, data.fps)) error('TCR IN/OUT scene ' + (i + 1) + ' tidak valid.'); if (types.indexOf(s.embedType) < 0) error('Embed Type scene ' + (i + 1) + ' tidak valid.'); if (s.image != null) dataUrlBytes(s.image); });
    if (data.coverImage != null) dataUrlBytes(data.coverImage); if (data.summaryImage != null) dataUrlBytes(data.summaryImage); return sums;
  }
  async function exportPptx(template, data, onProgress) {
    if (!template || !template.originalBytes) error('template belum dimuat.');
    var sums = validateData(data), progress = function (n) { if (typeof onProgress === 'function') onProgress(n); }; progress(0);
    var zip = await JSZip.loadAsync(template.originalBytes), presPath = 'ppt/presentation.xml', relPath = 'ppt/_rels/presentation.xml.rels';
    var pres = parseXml(await zip.file(presPath).async('string'), presPath), relDoc = parseXml(await zip.file(relPath).async('string'), relPath), pRels = relationshipMap(relDoc), original = template.slidePaths;
    var docs = [], rdocs = []; for (var i = 0; i < original.length; i++) { docs.push(parseXml(await zip.file(original[i]).async('string'), original[i])); var rp = dirname(original[i]) + '/_rels/' + original[i].slice(original[i].lastIndexOf('/') + 1) + '.rels'; rdocs.push(parseXml(await zip.file(rp).async('string'), rp)); }
    replaceExactText(docs[0], 'TITLE', data.title); replaceExactText(docs[0], 'SUBTITLE', data.subtitle);
    /* Slide 1: font Calibri dengan ukuran template tetap (hanya diskalakan bila teks tidak muat). */
    all(docs[0], 'sp', NS.p).forEach(function (shape) { var tx = first(shape, 'txBody', NS.p); if (tx) setAllFonts(tx, 'Calibri', 0); fitTextShape(shape); });
    var slideSize = { w: template.width || 12192000, h: template.height || 6858000 };
    updateSummary(docs[1], data, sums, slideSize.h);
    var counter = 0, token = Date.now().toString(36), addImage = function (doc, rd, path, value, stem) { return setImage(doc, rd, path, value, zip, stem + '-' + token + '-' + (++counter)); };
    await addImage(docs[0], rdocs[0], original[0], data.coverImage, 'cover'); await addImage(docs[1], rdocs[1], original[1], data.summaryImage, 'summary');
    zip.file(original[0], new XMLSerializer().serializeToString(docs[0])); zip.file(original[1], new XMLSerializer().serializeToString(docs[1]));
    for (var cr = 0; cr < 2; cr++) zip.file(dirname(original[cr]) + '/_rels/' + original[cr].slice(original[cr].lastIndexOf('/') + 1) + '.rels', new XMLSerializer().serializeToString(rdocs[cr]));
    var scenePath = original[2], sceneRelPath = dirname(scenePath) + '/_rels/' + scenePath.slice(scenePath.lastIndexOf('/') + 1) + '.rels';
    var sceneIds = all(first(pres, 'sldIdLst', NS.p), 'sldId', NS.p), maxId = 0; sceneIds.forEach(function (n) { maxId = Math.max(maxId, Number(attr(n, 'id')) || 0); });
    var nextSlide = 1; Object.keys(pRels).forEach(function (k) { var m = /rId(\d+)/.exec(k); if (m) nextSlide = Math.max(nextSlide, Number(m[1]) + 1); });
    var nextPart = 1; zipNames(zip).forEach(function (path) { var m = /^ppt\/slides\/slide(\d+)\.xml$/.exec(path); if (m) nextPart = Math.max(nextPart, Number(m[1]) + 1); });
    var allScenePaths = [scenePath], sceneRelDocs = [rdocs[2]], sceneDocs = [docs[2]];
    for (var si = 1; si < data.scenes.length; si++) { var part = nextPart++, np = 'ppt/slides/slide' + part + '.xml', nr = 'ppt/slides/_rels/slide' + part + '.xml.rels'; var nd = docs[2].cloneNode(true), nrd = rdocs[2].cloneNode(true); allScenePaths.push(np); sceneDocs.push(nd); sceneRelDocs.push(nrd); zip.file(np, new XMLSerializer().serializeToString(nd)); zip.file(nr, new XMLSerializer().serializeToString(nrd)); }
    for (var sj = 0; sj < data.scenes.length; sj++) { var sd = sceneDocs[sj], rd = sceneRelDocs[sj], sp = allScenePaths[sj]; updateScene(sd, data.scenes[sj], sj, parseBreakdown(data.scenes[sj].breakdown).total, slideSize); await addImage(sd, rd, sp, data.scenes[sj].image, 'scene'); zip.file(sp, new XMLSerializer().serializeToString(sd)); zip.file(dirname(sp) + '/_rels/' + sp.slice(sp.lastIndexOf('/') + 1) + '.rels', new XMLSerializer().serializeToString(rd)); }
    var list = first(pres, 'sldIdLst', NS.p), oldNodes = all(list, 'sldId', NS.p).map(function (n) { return n.cloneNode(true); }); while (list.firstChild) list.removeChild(list.firstChild);
    function nodeFor(relId, id) { var n = pres.createElementNS(NS.p, 'p:sldId'); n.setAttribute('id', String(id)); n.setAttributeNS(NS.r, 'r:id', relId); return n; }
    var originalRelIds = template._slideRelIds || [];
    var coverRel = (oldNodes[0] && relAttr(oldNodes[0])) || originalRelIds[0], summaryRel = (oldNodes[1] && relAttr(oldNodes[1])) || originalRelIds[1], sceneRel = (oldNodes[2] && relAttr(oldNodes[2])) || originalRelIds[2], endingRel = (oldNodes[3] && relAttr(oldNodes[3])) || originalRelIds[3];
    list.appendChild(nodeFor(coverRel, Number(attr(oldNodes[0], 'id')) || 256)); list.appendChild(nodeFor(summaryRel, Number(attr(oldNodes[1], 'id')) || 257)); list.appendChild(nodeFor(sceneRel, Number(attr(oldNodes[2], 'id')) || 258));
    for (var si2 = 1; si2 < data.scenes.length; si2++) { var rid = 'rId' + nextSlide++; var rr = relDoc.createElementNS(NS.pr, 'Relationship'); rr.setAttribute('Id', rid); rr.setAttribute('Type', slideType); rr.setAttribute('Target', allScenePaths[si2].replace(/^ppt\//, '')); relDoc.documentElement.appendChild(rr); list.appendChild(nodeFor(rid, ++maxId)); }
    list.appendChild(nodeFor(endingRel, Number(attr(oldNodes[3], 'id')) || 262));
    var ctPath = '[Content_Types].xml', ct = parseXml(await zip.file(ctPath).async('string'), ctPath); for (var ci = 1; ci < data.scenes.length; ci++) { var ov2 = ct.createElementNS(NS.ct, 'Override'); ov2.setAttribute('PartName', '/' + allScenePaths[ci]); ov2.setAttribute('ContentType', 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml'); ct.documentElement.appendChild(ov2); }
    var appPath = 'docProps/app.xml'; if (zip.file(appPath)) { var app = parseXml(await zip.file(appPath).async('string'), appPath); updateAppMetadata(app, data); zip.file(appPath, new XMLSerializer().serializeToString(app)); }
    zip.file(presPath, new XMLSerializer().serializeToString(pres)); zip.file(relPath, new XMLSerializer().serializeToString(relDoc)); zip.file(ctPath, new XMLSerializer().serializeToString(ct)); progress(0.8);
    var out = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }, function (meta) { progress(0.8 + (meta.percent || 0) / 500); }); progress(1);
    return new Blob([out], { type: MIME });
  }
  var api = { EMBED_TYPES: EMBED_TYPES, SPECIAL_TYPES: SPECIAL_TYPES, LEGACY_TYPES: LEGACY_TYPES, tcrLine: tcrLine, summaryPairs: summaryPairs, secondsLabel: secondsLabel, sceneLayout: sceneLayout, breakdownText: breakdownText, textPt: textPt, parseBreakdown: parseBreakdown, summarize: summarize, validateTimecode: validateTimecode, safeFilename: safeFilename, loadTemplate: loadTemplate, exportPptx: exportPptx };
  root.SceneEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
