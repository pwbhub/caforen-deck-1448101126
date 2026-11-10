/* ==========================================================================
   Scene Deck — aplikasi penyusun laporan brand exposure (logika asli dipertahankan).
   Perubahan: nama 'Scene Deck', pratinjau scene memakai geometri kotak yang sama
   dengan hasil ekspor, tema & screensaver dikendalikan shell.
   ========================================================================== */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const engine = () => window.SceneEngine;
  const STORAGE_TEMPLATE = '../assets/PPT(NAME).pptx'; /* cadangan bila data base64 tidak tersedia */
  const icons = {
    layout: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 3v18M8 9h13"/>',
    film: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 8h4m-4 8h4M17 8h4m-4 8h4"/>',
    chart: '<path d="M4 3v18h17M9 16v-5m5 5V7m5 9V4"/>',
    layers: '<path d="m12 3 10 5-10 5L2 8l10-5Zm-9 10 9 5 9-5M3 18l9 5 9-5"/>',
    book: '<path d="M12 5v16M3 3c4 0 6 0 9 2 3-2 5-2 9-2v16c-4 0-6 0-9 2-3-2-5-2-9-2V3Z"/>',
    shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
    save: '<path d="M4 3h13l4 4v14H3V3h1ZM7 3v6h10V3M7 21v-8h10v8"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 15v6h16v-6"/>',
    upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
    key: '<circle cx="8" cy="8" r="5"/><path d="m12 12 9 9m-4-4 3-3m-6 0 3-3"/>',
    monitor: '<rect x="3" y="3" width="18" height="14" rx="2"/><path d="M12 17v4M7 21h10"/>',
    edit: '<path d="m16 3 5 5-12 12-6 1 1-6L16 3ZM13 6l5 5"/>',
    file: '<path d="M4 3h10l6 6v12H4V3ZM14 3v6h6M8 13h8m-8 4h6"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
    plus: '<path d="M12 4v16M4 12h16"/>',
    check: '<path d="m4 12 5 5L20 6"/>',
    close: '<path d="m5 5 14 14M5 19 19 5"/>',
    trash: '<path d="M3 6h18M9 3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
    copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
    up: '<path d="M12 20V4m-6 6 6-6 6 6"/>',
    down: '<path d="M12 4v16m-6-6 6 6 6-6"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    restart: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'
  };
  function icon(name) { return `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.file}</svg>`; }
  function hydrateIcons(root = document) { root.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = icon(el.dataset.icon); }); }
  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, (s) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s])); }
  function num(value) { return Number(value).toLocaleString('id-ID', {maximumFractionDigits: 6}); }
  function sceneLabel(i) { return `Scene ${String(i + 1).padStart(2, '0')}`; }
  let nextId = 1;
  function defaultData() { return {title: 'BRAND EXPOSURE REPORT', subtitle: 'Nama Program — Episode 01', showDuration: '00:24:00:00', episodeNumber: 1, txDate: '', fps: 25, coverImage: null, summaryImage: null, coverImageName: '', summaryImageName: '', scenes: [newScene()]}; }
  function sceneDefaultType() { try { if (sceneDefault) return sceneDefault; } catch (_) {} { return (window.SceneEngine && SceneEngine.EMBED_TYPES[0]) || 'Signage Billboard'; } }
  function newScene() { return {id: `scene-${nextId++}`, breakdown: '0', locale: 'Outdoor', embedType: sceneDefaultType(), tcrIn: '00:00:00:00', tcrOut: '00:00:00:00', image: null, imageName: ''}; }
  let data = {title: 'BRAND EXPOSURE REPORT', subtitle: 'Nama Program — Episode 01', showDuration: '00:24:00:00', episodeNumber: 1, txDate: '', fps: 25, coverImage: null, summaryImage: null, coverImageName: '', summaryImageName: '', scenes: [newScene()]};
  let template = null;
  let templateName = 'PPT(NAME).pptx';
  let templateBytes = null;
  let templateToken = 0;
  let exporting = false;
  let toastTimer;
  let dirty = false;
  const PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'%3E%3Crect width='16' height='9' fill='%23e9e5d2'/%3E%3C/svg%3E";
  const fallbackImages = {cover: PLACEHOLDER, summary: PLACEHOLDER, scene: PLACEHOLDER, ending: PLACEHOLDER, logo: PLACEHOLDER};
  function images() { return template?.previewImages || fallbackImages; }
  function toast(message, error = false) { $('toast').textContent = message; $('toast').className = `toast visible${error ? ' error' : ''}`; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').classList.remove('visible'); }, error ? 7500 : 4000); }
  function markDirty() { dirty = true; $('draftStatus').innerHTML = '<span></span> Perubahan belum disimpan'; }
  const SE = window.SceneEngine || {EMBED_TYPES: [], SPECIAL_TYPES: [], LEGACY_TYPES: []};
  const embedOptions = SE.EMBED_TYPES.concat(SE.SPECIAL_TYPES);
  const embedTypes = embedOptions.concat(SE.LEGACY_TYPES);
  /* ---- pengaturan Admin (Konsol Admin → Scene Deck): tambah / sembunyikan Embed Type ---- */
  const BASE_EMBED = SE.EMBED_TYPES.slice(), BASE_LEGACY = SE.LEGACY_TYPES.slice();
  function applySceneConfig(c) {
    const sc = (c && c.scene) || {};
    const clean = a => (Array.isArray(a) ? a : []).map(x => String(x).trim()).filter(Boolean);
    const hidden = new Set(clean(sc.hiddenTypes)), extra = clean(sc.extraTypes).filter(t => !SE.SPECIAL_TYPES.includes(t));
    let list = [...new Set(BASE_EMBED.filter(t => !hidden.has(t)).concat(extra))];
    if (!list.length) list = BASE_EMBED.slice();
    SE.EMBED_TYPES.splice(0, SE.EMBED_TYPES.length, ...list);
    /* jenis yang disembunyikan tetap sah untuk draft lama */
    SE.LEGACY_TYPES.splice(0, SE.LEGACY_TYPES.length, ...new Set(BASE_LEGACY.concat([...hidden].filter(t => BASE_EMBED.includes(t)))));
    embedOptions.splice(0, embedOptions.length, ...SE.EMBED_TYPES.concat(SE.SPECIAL_TYPES));
    embedTypes.splice(0, embedTypes.length, ...embedOptions.concat(SE.LEGACY_TYPES));
    sceneDefault = embedOptions.includes(sc.defaultType) ? sc.defaultType : SE.EMBED_TYPES[0];
  }
  var sceneDefault = 'Signage Billboard';
  applySceneConfig(window.CA && CA.config && CA.config());
  if (window.CA && CA.onConfig) CA.onConfig(c => { const before = embedTypes.join('|'); applySceneConfig(c); if (before !== embedTypes.join('|') && typeof renderScenes === 'function' && document.getElementById('sceneList')) { try { renderScenes(); } catch (_) {} } });
  function embedSelect(current) {
    const opt = v => `<option value="${esc(v)}" ${current === v ? 'selected' : ''}>${esc(v)}</option>`;
    const legacy = embedOptions.includes(current) ? '' : `<optgroup label="Jenis lama (draft sebelumnya)"><option value="${esc(current)}" selected>${esc(current)}</option></optgroup>`;
    return `<optgroup label="Embed type">${SE.EMBED_TYPES.map(opt).join('')}</optgroup><optgroup label="Khusus · dihitung ke KEY LOGO">${SE.SPECIAL_TYPES.map(opt).join('')}</optgroup>${legacy}`;
  }
  function formErrors() {
    const result = [];
    if (!data.title.trim()) result.push('TITLE wajib diisi.');
    if (!data.subtitle.trim()) result.push('SUBTITLE wajib diisi.');
    if (!engine().validateTimecode(data.showDuration, data.fps)) result.push(`SHOW DURATION harus hh:mm:ss:ff dengan frame di bawah ${data.fps}.`);
    if (!Number.isInteger(Number(data.episodeNumber)) || data.episodeNumber === '' || Number(data.episodeNumber) < 0 || Number(data.episodeNumber) > 99) result.push('EPISODE NUMBER harus bilangan bulat 0–99.');
    if (!data.scenes.length) result.push('Tambahkan minimal satu scene.');
    data.scenes.forEach((s, i) => {
      if (!engine().parseBreakdown(s.breakdown).valid) result.push(`${sceneLabel(i)}: breakdown harus angka nonnegatif dipisahkan +.`);
      if (!['Indoor', 'Outdoor'].includes(s.locale)) result.push(`${sceneLabel(i)}: Locale tidak valid.`);
      if (!embedTypes.includes(s.embedType)) result.push(`${sceneLabel(i)}: Embed Type tidak valid.`);
      if (!engine().validateTimecode(s.tcrIn, data.fps)) result.push(`${sceneLabel(i)}: TCR IN tidak valid untuk ${data.fps} fps.`);
      if (!engine().validateTimecode(s.tcrOut, data.fps)) result.push(`${sceneLabel(i)}: TCR OUT tidak valid untuk ${data.fps} fps.`);
    });
    return result;
  }
  function uploadBox(key, value, imageName, defaultImage) {
    return `<div class="upload-box"><img class="upload-thumbnail" src="${esc(value || defaultImage)}" alt="Gambar ${key.startsWith('scene:') ? 'scene' : key === 'cover' ? 'cover' : 'ringkasan'}"><div class="upload-copy"><strong>${esc(imageName || 'Gambar dari template asli')}</strong><p>PNG, JPG, WebP · maksimal 15 MB</p><label class="upload-action">${icon('upload')} ${value ? 'Ganti gambar' : 'Upload gambar pengganti'}<input type="file" accept="image/png,image/jpeg,image/webp" data-upload="${esc(key)}"></label></div>${value ? `<button class="remove-upload" data-remove-image="${esc(key)}" title="Kembali ke gambar template" aria-label="Kembali ke gambar template">${icon('close')}</button>` : ''}</div>`;
  }
  function renderUploads() {
    $('coverUploadMount').innerHTML = uploadBox('cover', data.coverImage, data.coverImageName, images().cover);
    $('summaryUploadMount').innerHTML = uploadBox('summary', data.summaryImage, data.summaryImageName, images().summary);
  }
  /* ---------- penampil seluruh slide (Ringkasan exposure) ---------- */
  let deckIndex = 0, summaryMarkup = '', stripSig = '';
  function coverMarkup() { return `<img class="cover-picture" src="${esc(data.coverImage || images().cover)}" alt="Preview cover"><img class="slide-logo" src="${esc(images().logo)}" alt="Logo template"><div class="cover-title">${esc(data.title || 'TITLE')}</div><div class="cover-subtitle">${esc(data.subtitle || 'SUBTITLE')}</div>`; }
  function endingMarkup() { return `<img class="ending-picture" src="${esc(images().ending)}" alt="Latar slide penutup"><img class="ending-logo" src="${esc(images().endingLogo || images().logo)}" alt="Logo template"><div class="ending-text">THANK YOU</div>`; }
  function deckSlides() { return [{type: 'cover', label: 'Cover laporan', short: 'Cover'}, {type: 'summary', label: 'Ringkasan program', short: 'Ringkasan'}].concat(data.scenes.map((s, i) => ({type: 'scene', i, label: sceneLabel(i), short: 'S' + String(i + 1).padStart(2, '0')})), [{type: 'ending', label: 'Slide penutup', short: 'Penutup'}]); }
  function renderDeck() {
    const el = $('deckSlide'); if (!el) return;
    const slides = deckSlides();
    deckIndex = Math.max(0, Math.min(slides.length - 1, deckIndex));
    const sl = slides[deckIndex];
    el.className = 'slide-preview ' + ({cover: 'cover-preview', summary: 'summary-preview', scene: 'scene-preview', ending: 'ending-preview'}[sl.type]);
    el.innerHTML = sl.type === 'cover' ? coverMarkup() : sl.type === 'summary' ? summaryMarkup : sl.type === 'ending' ? endingMarkup() : scenePreview(data.scenes[sl.i], sl.i);
    $('deckCount').textContent = `${deckIndex + 1} / ${slides.length}`;
    $('deckLabel').innerHTML = `${String(deckIndex + 1).padStart(2, '0')} <b>${esc(sl.label)}</b>`;
    $('deckPrev').disabled = deckIndex === 0; $('deckNext').disabled = deckIndex === slides.length - 1;
    const sig = slides.map(x => x.short).join('|');
    if (sig !== stripSig) { stripSig = sig; $('deckStrip').innerHTML = slides.map((x, k) => `<button type="button" role="tab" data-slide="${k}" class="deck-chip deck-${x.type}"><b>${k + 1}</b>${esc(x.short)}</button>`).join(''); }
    $('deckStrip').querySelectorAll('[data-slide]').forEach(b => { const on = Number(b.dataset.slide) === deckIndex; b.setAttribute('aria-selected', String(on)); if (on && $('section-summary').classList.contains('active')) b.scrollIntoView({block: 'nearest', inline: 'nearest'}); });
  }
  function goSlide(k) { deckIndex = k; renderDeck(); }
  function coverPreview() {
    $('coverPreview').innerHTML = `<img class="cover-picture" src="${esc(data.coverImage || images().cover)}" alt="Preview cover"><img class="slide-logo" src="${esc(images().logo)}" alt="Logo template"><div class="cover-title">${esc(data.title || 'TITLE')}</div><div class="cover-subtitle">${esc(data.subtitle || 'SUBTITLE')}</div>`;
  }
  const SLIDE_W = 12192000, SLIDE_H = 6858000;
  function pct(v, total) { return (v / total * 100).toFixed(3) + '%'; }
  function scenePreview(s, i) {
    const parsed = engine().parseBreakdown(s.breakdown);
    const sum = parsed.valid ? parsed.total : 0;
    const sw = template?.width || SLIDE_W, sh = template?.height || SLIDE_H;
    const lay = engine().sceneLayout(s, i, sum, template?.sceneBox, {w: sw, h: sh});
    const grewMore = lay.cx > (template?.sceneBox?.cx || 3526200) || lay.lines > 7;
    const box = `left:${pct(lay.x, sw)};top:${pct(lay.y, sh)};width:${pct(lay.cx, sw)};height:${pct(lay.cy, sh)};--fs:${(14 * lay.fontScale).toFixed(2)};--hang:${lay.hangPt.toFixed(2)}`;
    return `<img class="scene-image" src="${esc(s.image || images().scene)}" alt="Bukti visual ${sceneLabel(i)}"><img class="slide-logo" src="${esc(images().logo)}" alt="Logo template"><div class="scene-data${grewMore ? ' grew' : ''}" style="${box}"><div>${sceneLabel(i)}</div><div>Duration Of Exposure : ${parsed.valid ? num(parsed.total) : '—'} s</div><div class="bd-row">Breakdown Duration : ${esc(engine().breakdownText(s.breakdown))}</div><div>Locale : ${esc(s.locale)}</div><div>Embed Type : ${esc(s.embedType)}</div><div class="tcr-row"><span>TCR IN : ${esc(s.tcrIn)}</span><span>TCR OUT : ${esc(s.tcrOut)}</span></div></div>${grewMore ? '<span class="grow-badge">Kotak menyesuaikan · ' + lay.lines + ' baris</span>' : ''}`;
  }
  function renderScenes() {
    $('sceneList').innerHTML = data.scenes.map((s, i) => {
      const parsed = engine().parseBreakdown(s.breakdown);
      const field = (name, label, value) => `<div class="field"><label for="${s.id}-${name}">${label}</label><input id="${s.id}-${name}" data-scene="${esc(s.id)}" data-field="${name}" class="timecode" type="text" value="${esc(value)}" maxlength="11" placeholder="hh:mm:ss:ff"><small data-hint="${s.id}-${name}">hh:mm:ss:ff · ${data.fps} fps</small></div>`;
      return `<article class="panel scene-card" data-scene-card="${esc(s.id)}"><div class="scene-header"><div class="scene-label"><span class="scene-index">${String(i + 1).padStart(2, '0')}</span><b>${sceneLabel(i)}</b><span class="scene-duration-pill" id="duration-pill-${s.id}">${parsed.valid ? num(parsed.total) : '—'} detik</span></div><div class="scene-actions"><button class="icon-button" data-action="up" data-id="${s.id}" ${i === 0 ? 'disabled' : ''} title="Geser ke atas" aria-label="Geser ${sceneLabel(i)} ke atas">${icon('up')}</button><button class="icon-button" data-action="down" data-id="${s.id}" ${i === data.scenes.length - 1 ? 'disabled' : ''} title="Geser ke bawah" aria-label="Geser ${sceneLabel(i)} ke bawah">${icon('down')}</button><button class="icon-button" data-action="copy" data-id="${s.id}" title="Duplikat scene" aria-label="Duplikat ${sceneLabel(i)}">${icon('copy')}</button><button class="icon-button" data-action="delete" data-id="${s.id}" ${data.scenes.length === 1 ? 'disabled' : ''} title="Hapus scene" aria-label="Hapus ${sceneLabel(i)}">${icon('trash')}</button></div></div><div class="scene-body"><div class="scene-fields"><div class="field"><label for="${s.id}-breakdown">BREAKDOWN DURATION <span class="required">*</span></label><textarea id="${s.id}-breakdown" data-scene="${s.id}" data-field="breakdown" placeholder="2+4+5+1+6+8+5" rows="2">${esc(s.breakdown)}</textarea><small data-hint="${s.id}-breakdown">Angka detik dipisahkan +. Total dihitung otomatis.</small></div><div class="calculation-line"><span>DURATION OF EXPOSURE</span><strong id="duration-value-${s.id}">${parsed.valid ? num(parsed.total) : '—'} detik</strong></div><div class="field-grid"><div class="field"><label for="${s.id}-locale">LOCALE</label><select id="${s.id}-locale" data-scene="${s.id}" data-field="locale">${['Outdoor', 'Indoor'].map(v => `<option ${s.locale === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div><div class="field"><label for="${s.id}-embedType">EMBED TYPE</label><select id="${s.id}-embedType" data-scene="${s.id}" data-field="embedType">${embedSelect(s.embedType)}</select></div></div><div class="field-grid">${field('tcrIn', 'TCR IN', s.tcrIn)}${field('tcrOut', 'TCR OUT', s.tcrOut)}</div></div><div class="scene-visual"><div class="slide-preview" id="scene-preview-${s.id}">${scenePreview(s, i)}</div><div class="scene-preview-label"><span>Slide ${i + 3} · ${sceneLabel(i)}</span><span>Pratinjau skematis</span></div><div id="scene-upload-${s.id}">${uploadBox(`scene:${s.id}`, s.image, s.imageName, images().scene)}</div></div></div></article>`;
    }).join('');
    update();
  }
  function update() {
    if (!engine()) return;
    const totals = engine().summarize(data.scenes);
    const displayTotal = (value) => totals.valid ? num(value) : '—';
    $('metricScenes').textContent = String(data.scenes.length).padStart(2, '0');
    $('metricTotal').innerHTML = `${num(totals.total)}<em>detik</em>`;
    $('metricLocales').innerHTML = `${num(totals.outdoor)} <b>/</b> ${num(totals.indoor)}<em>detik</em>`;
    $('metricKey').innerHTML = `${num(totals.keyLogo)}<em>detik</em>`;
    $('metricKeyCount').textContent = `${data.scenes.filter(s => s.embedType === 'KEY LOGO').length} scene dengan key logo`;
    $('navSceneCount').textContent = data.scenes.length;
    $('sceneBadge').textContent = data.scenes.length;
    $('headingSlides').textContent = `${data.scenes.length + 3} slide dalam laporan`;
    $('filenamePreview').textContent = engine().safeFilename(data.subtitle || 'Laporan Exposure');
    $('summaryName').textContent = data.subtitle || 'SUBNAME';
    coverPreview();
    const pairs = engine().summaryPairs(data, totals);
    const sv = (v) => totals.valid ? v : '—';
    const values = [['SHOW DURATION', pairs[0][0][1]], ['NUMBER OF AVAILABLE SCENE', pairs[0][1][1]], ['EPISODE NUMBER', data.episodeNumber], ['Outdoor', sv(pairs[2][0][1])], ['Indoor', sv(pairs[2][1][1])], ['TOTAL SECONDS OF EXPOSURE', sv(pairs[1][1][1])], ['KEY LOGO', sv(pairs[3][0][1])], ['TX Date', data.txDate || '—']];
    $('summaryRows').innerHTML = values.map(([k, v]) => `<div class="summary-row${k === 'TOTAL SECONDS OF EXPOSURE' ? ' highlight' : ''}"><span>${k}</span><strong>${esc(v)}</strong></div>`).join('');
    summaryMarkup = `<img class="slide-logo" src="${esc(images().logo)}" alt="Logo template"><div class="summary-title">${esc(data.subtitle || 'SUBNAME')}</div><img class="summary-image" src="${esc(data.summaryImage || images().summary)}" alt="Gambar ringkasan"><div class="summary-data">${pairs.map(row => row.map(([k, v]) => `<span>${esc(k)} : ${esc(k === 'SHOW DURATION' || k === 'NUMBER OF AVAILABLE SCENE' || k === 'EPISODE NUMBER' || k === 'TX Date' ? v : sv(v))}</span>`).join('')).join('')}</div>`;
    const sidePrev = $('summarySidePreview'); if (sidePrev) sidePrev.innerHTML = summaryMarkup;
    renderDeck();
    const outdoorPercent = totals.valid && totals.total ? totals.outdoor / totals.total * 100 : 0;
    $('exposureSplit').innerHTML = `<h3>Distribusi exposure${totals.valid ? '' : ' · perbaiki breakdown'}</h3><div class="split-track"><div class="split-outdoor" style="width:${outdoorPercent}%"></div><div class="split-indoor" style="width:${totals.valid && totals.total ? 100 - outdoorPercent : 0}%"></div></div><div class="split-legend"><span><i></i>Outdoor ${displayTotal(totals.outdoor)} s</span><span><i></i>Indoor ${displayTotal(totals.indoor)} s</span></div>`;
    $('showDurationHint').textContent = engine().validateTimecode(data.showDuration, data.fps) ? `Format hh:mm:ss:ff · ${data.fps} fps` : `Timecode tidak valid. mm/ss < 60, ff < ${data.fps}.`;
    $('showDurationHint').classList.toggle('error', !engine().validateTimecode(data.showDuration, data.fps));
    $('showDuration').classList.toggle('invalid', !engine().validateTimecode(data.showDuration, data.fps));
    $('titleInput').classList.toggle('invalid', !data.title.trim());
    $('subtitleInput').classList.toggle('invalid', !data.subtitle.trim());
    $('episodeNumber').classList.toggle('invalid', data.episodeNumber === '' || !Number.isInteger(Number(data.episodeNumber)) || Number(data.episodeNumber) < 0 || Number(data.episodeNumber) > 99);
    data.scenes.forEach((s, i) => {
      const p = engine().parseBreakdown(s.breakdown);
      const hint = document.querySelector(`[data-hint="${s.id}-breakdown"]`);
      if (hint) { hint.textContent = p.valid ? `${p.parts.length} nilai · ${num(p.total)} detik exposure` : (p.error || 'Gunakan angka nonnegatif dipisahkan +.'); hint.classList.toggle('error', !p.valid); }
      $(`${s.id}-breakdown`)?.classList.toggle('invalid', !p.valid);
      if ($(`duration-pill-${s.id}`)) $(`duration-pill-${s.id}`).textContent = `${p.valid ? num(p.total) : '—'} detik`;
      if ($(`duration-value-${s.id}`)) $(`duration-value-${s.id}`).textContent = `${p.valid ? num(p.total) : '—'} detik`;
      if ($(`scene-preview-${s.id}`)) $(`scene-preview-${s.id}`).innerHTML = scenePreview(s, i);
      ['tcrIn', 'tcrOut'].forEach((k) => {
        const valid = engine().validateTimecode(s[k], data.fps);
        $(`${s.id}-${k}`)?.classList.toggle('invalid', !valid);
        const h = document.querySelector(`[data-hint="${s.id}-${k}"]`);
        if (h) { h.textContent = valid ? `hh:mm:ss:ff · ${data.fps} fps` : `Tidak valid · frame harus < ${data.fps}`; h.classList.toggle('error', !valid); }
      });
    });
    const invalid = formErrors();
    $('exportButton').disabled = !template || exporting || invalid.length > 0;
    $('exportButton').title = !template ? 'Muat template terlebih dahulu' : invalid[0] || 'Unduh presentasi PowerPoint';
    if (!totals.valid) { $('metricTotal').innerHTML = '—<em>perbaiki breakdown</em>'; $('metricLocales').innerHTML = '— <b>/</b> —'; $('metricKey').innerHTML = '—<em>data belum valid</em>'; }
  }
  const tabs = {overview: ['Informasi utama', 'Exposure, tersusun.', 'Dari detail setiap scene menjadi laporan yang siap dipresentasikan.'], scenes: ['Daftar scene', 'Setiap scene, tercatat.', 'Susun bukti visual dan breakdown durasi. Sisanya dihitung otomatis.'], summary: ['Ringkasan exposure', 'Angka yang bercerita.', 'Satu ringkasan terhubung langsung ke seluruh scene dalam laporan.'], template: ['Template PPTX', 'Desain Anda, tetap utuh.', 'Pakai template asli sebagai fondasi. Kami hanya mengganti data yang Anda isi.'], guide: ['Panduan penggunaan', 'Dari scene ke slide.', 'Kenali alur input, logika perhitungan, dan hasil PowerPoint Anda.']};
  function setTab(tab) {
    if (!tabs[tab]) return;
    document.querySelectorAll('.tab-section').forEach(el => el.classList.toggle('active', el.id === `section-${tab}`));
    document.querySelectorAll('.nav-item[data-tab]').forEach(el => el.classList.toggle('active', el.dataset.tab === tab));
    $('breadcrumbTitle').textContent = tabs[tab][0]; $('pageTitle').textContent = tabs[tab][1]; $('pageDescription').textContent = tabs[tab][2];
    document.querySelector('.sidebar').classList.remove('open');
    window.scrollTo({top: 0, behavior: 'smooth'});
  }
  function syncForm() {
    [['titleInput','title'],['subtitleInput','subtitle'],['showDuration','showDuration'],['episodeNumber','episodeNumber'],['txDate','txDate'],['fpsInput','fps']].forEach(([id, key]) => { $(id).value = data[key]; });
    renderUploads(); renderScenes(); update();
  }
  function bytesToBase64(bytes) { const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes); let str = ''; for (let i = 0; i < u8.length; i += 8192) str += String.fromCharCode(...u8.subarray(i, i + 8192)); return btoa(str); }
  function base64ToBytes(str) { return Uint8Array.from(atob(str), c => c.charCodeAt(0)); }
  async function applyTemplate(bytes, name, token = ++templateToken) {
    const result = await engine().loadTemplate(bytes);
    if (token !== templateToken) return;
    template = result; templateBytes = new Uint8Array(bytes); templateName = name;
    $('templateNameSide').textContent = name; $('templateNameMain').textContent = name;
    const width = result.width || 12192000, height = result.height || 6858000;
    $('templateDetails').textContent = `4 slide valid · ${(width / 914400).toFixed(2)} × ${(height / 914400).toFixed(2)} inci · ${(templateBytes.length / 1024 / 1024).toFixed(2)} MB`;
    $('loadingState').classList.add('hidden'); renderUploads(); renderScenes();
  }
  async function loadDefault() {
    const token = ++templateToken;
    $('loadingState').classList.remove('hidden');
    $('loadingState').innerHTML = '<span class="spinner"></span>Menyiapkan template PowerPoint Anda…';
    try {
      const bytes = window.DEFAULT_TEMPLATE_BASE64 ? base64ToBytes(window.DEFAULT_TEMPLATE_BASE64) : await fetch(STORAGE_TEMPLATE).then(r => { if (!r.ok) throw new Error('Template sample belum bisa diunduh.'); return r.arrayBuffer(); });
      await applyTemplate(bytes, 'PPT(NAME).pptx', token);
    } catch (err) {
      if (token !== templateToken) return;
      $('loadingState').innerHTML = `${icon('info')} ${esc(err.message)} Unggah file PPT(NAME).pptx di bagian Template.`;
      update();
    }
  }
  async function readImage(file) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Gunakan file PNG, JPG, atau WebP. SVG dan GIF tidak didukung.');
    if (file.size > 15 * 1024 * 1024) throw new Error('Ukuran gambar maksimal 15 MB.');
    const url = URL.createObjectURL(file);
    try {
      const img = new Image(); img.src = url; await img.decode();
      if (!img.width || !img.height || img.width * img.height > 40000000) throw new Error('Dimensi gambar terlalu besar (maksimal 40 megapiksel).');
      const scale = Math.min(1, 3200 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas'); canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Browser tidak mendukung pemrosesan gambar.');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const result = canvas.toDataURL('image/png');
      if (result.length >= 25 * 1024 * 1024) throw new Error('Gambar setelah konversi terlalu besar untuk draft. Pilih gambar beresolusi lebih kecil.');
      return result;
    } finally { URL.revokeObjectURL(url); }
  }
  function setImage(key, value, name = '') {
    if (key.startsWith('scene:')) { const s = data.scenes.find(s => s.id === key.slice(6)); if (!s) return; s.image = value; s.imageName = name; $(`scene-upload-${s.id}`).innerHTML = uploadBox(key, value, name, images().scene); }
    else { data[`${key}Image`] = value; data[`${key}ImageName`] = name; renderUploads(); }
    markDirty(); update();
  }
  function download(blob, filename) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
  async function saveDraft() {
    if (!templateBytes) { toast('Muat template terlebih dahulu untuk menyimpan draft lengkap.', true); return; }
    const json = {app: 'SceneDeck', version: 1, savedAt: new Date().toISOString(), templateName, templateBase64: bytesToBase64(templateBytes), data};
    const blob = new Blob([JSON.stringify(json)], {type: 'application/json'});
    if (blob.size > 100 * 1024 * 1024) { toast('Draft melebihi 100 MB. Kurangi ukuran gambar agar file bisa disimpan dan diimpor kembali.', true); return; }
    download(blob, engine().safeFilename(data.subtitle || 'Scene Deck').replace(/\.pptx$/i, '.scenedeck.json'));
    dirty = false; $('draftStatus').innerHTML = '<span></span> Draft diunduh'; toast('Draft lengkap diunduh. Simpan file JSON untuk melanjutkan nanti.');
  }
  function validateDraft(draft) {
    if (draft?.app !== 'SceneDeck' || draft.version !== 1 || typeof draft.templateBase64 !== 'string' || !draft.data || !Array.isArray(draft.data.scenes)) throw new Error('Bukan draft Scene Deck versi 1 yang valid.');
    const d = draft.data;
    for (const k of ['title', 'subtitle', 'showDuration', 'txDate']) if (typeof d[k] !== 'string') throw new Error(`Data ${k} pada draft tidak valid.`);
    if (!Number.isInteger(d.fps) || ![24,25,30,50,60].includes(d.fps)) throw new Error('Frame rate draft tidak didukung.');
    if (!d.scenes.length || d.scenes.length > 500) throw new Error('Draft harus memiliki 1–500 scene.');
    const validImage = v => v == null || typeof v === 'string' && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=\s]+$/.test(v) && v.length < 25 * 1024 * 1024;
    if (!validImage(d.coverImage) || !validImage(d.summaryImage)) throw new Error('Gambar draft tidak valid.');
    d.scenes.forEach(s => { if (typeof s.breakdown !== 'string' || !['Indoor','Outdoor'].includes(s.locale) || !embedTypes.includes(s.embedType) || typeof s.tcrIn !== 'string' || typeof s.tcrOut !== 'string' || !validImage(s.image)) throw new Error('Salah satu scene pada draft tidak valid.'); });
    return d;
  }
  async function importDraft(file) {
    if (file.size > 100 * 1024 * 1024) throw new Error('Draft maksimal 100 MB.');
    const draft = JSON.parse(await file.text()); const d = validateDraft(draft);
    const bytes = base64ToBytes(draft.templateBase64);
    const loaded = await engine().loadTemplate(bytes);
    ++templateToken;
    template = loaded; templateBytes = bytes; templateName = String(draft.templateName || 'Template.pptx');
    data = {...d, scenes: d.scenes.map(s => ({...s, id: `scene-${nextId++}`}))};
    $('templateNameSide').textContent = templateName; $('templateNameMain').textContent = templateName;
    $('templateDetails').textContent = `4 slide valid · draft dipulihkan · ${(bytes.length / 1024 / 1024).toFixed(2)} MB`;
    $('loadingState').classList.add('hidden'); dirty = false; $('draftStatus').innerHTML = '<span></span> Draft dipulihkan'; syncForm(); setTab('overview'); toast('Draft dipulihkan, termasuk template dan gambar.');
  }
  async function exportDeck() {
    const errors = formErrors(); if (errors.length) { toast(errors[0], true); return; }
    if (!template || exporting) return;
    exporting = true; update(); if (window.CA) CA.keepAwake(true);
    const snapshot = JSON.parse(JSON.stringify(data)); const source = template;
    $('exportDialog').showModal(); $('exportProgress').style.width = '0%';
    try {
      const blob = await engine().exportPptx(source, snapshot, progress => {
        const percent = typeof progress === 'number' ? progress * 100 : progress?.percent || 0;
        $('exportProgress').style.width = `${Math.max(0, Math.min(100, percent))}%`; $('exportProgressLabel').textContent = `${Math.round(percent)}% · ${snapshot.scenes.length + 3} slide`;
      });
      download(blob, engine().safeFilename(snapshot.subtitle)); toast(`PPTX diunduh: ${snapshot.scenes.length} scene, ${snapshot.scenes.length + 3} slide.`); if (window.CA) CA.post('ca:usage-event', {ev: 'pptx'}); if (window.CA) CA.toast('PPTX diunduh', engine().safeFilename(snapshot.subtitle));
    } catch (err) { toast(`Ekspor gagal: ${err.message}`, true); }
    finally { $('exportDialog').close(); exporting = false; update(); if (window.CA) CA.keepAwake(false); }
  }
  document.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-tab]'); if (tab) setTab(tab.dataset.tab);
    const gotoSlide = event.target.closest('[data-goto-slide]'); if (gotoSlide) goSlide(Number(gotoSlide.dataset.gotoSlide) || 0);
    const remove = event.target.closest('[data-remove-image]'); if (remove) setImage(remove.dataset.removeImage, null);
    const action = event.target.closest('[data-action]');
    if (action && !action.disabled) {
      const index = data.scenes.findIndex(s => s.id === action.dataset.id); if (index < 0) return;
      if (action.dataset.action === 'delete' && data.scenes.length > 1) { data.scenes.splice(index, 1); toast('Scene dihapus. Penomoran dan total diperbarui.'); }
      if (action.dataset.action === 'copy') { if (data.scenes.length >= 500) { toast('Maksimal 500 scene.', true); return; } const copy = {...data.scenes[index], id: `scene-${nextId++}`}; data.scenes.splice(index + 1, 0, copy); }
      if (action.dataset.action === 'up' && index > 0) [data.scenes[index - 1], data.scenes[index]] = [data.scenes[index], data.scenes[index - 1]];
      if (action.dataset.action === 'down' && index < data.scenes.length - 1) [data.scenes[index + 1], data.scenes[index]] = [data.scenes[index], data.scenes[index + 1]];
      markDirty(); renderScenes();
    }
  });
  const mainFields = {titleInput: 'title', subtitleInput: 'subtitle', showDuration: 'showDuration', episodeNumber: 'episodeNumber', txDate: 'txDate', fpsInput: 'fps'};
  function onInput(event) {
    const el = event.target;
    if (mainFields[el.id]) { data[mainFields[el.id]] = el.id === 'fpsInput' ? Number(el.value) : el.value; markDirty(); update(); }
    if (el.dataset.scene && el.dataset.field) { const s = data.scenes.find(s => s.id === el.dataset.scene); if (s) { s[el.dataset.field] = el.value; markDirty(); update(); } }
  }
  document.addEventListener('input', onInput);
  document.addEventListener('change', async (event) => {
    const el = event.target;
    if (el.tagName === 'SELECT') onInput(event);
    if (el.dataset.upload && el.files?.[0]) {
      const key = el.dataset.upload; const file = el.files[0];
      try { const value = await readImage(file); setImage(key, value, file.name); toast('Gambar diganti. Rasio gambar tetap dipertahankan.'); } catch (err) { toast(err.message, true); }
      el.value = '';
    }
    if (el.id === 'templateUpload' && el.files?.[0]) {
      const file = el.files[0];
      try { if (!file.name.toLowerCase().endsWith('.pptx') || file.size > 30 * 1024 * 1024) throw new Error('Gunakan file .pptx maksimal 30 MB.'); await applyTemplate(await file.arrayBuffer(), file.name); markDirty(); toast('Template berhasil divalidasi dan dimuat.'); } catch (err) { toast(err.message, true); }
      el.value = '';
    }
    if (el.id === 'draftUpload' && el.files?.[0]) { try { await importDraft(el.files[0]); } catch (err) { toast(`Impor gagal: ${err.message}`, true); } el.value = ''; }
  });
  $('addScene').addEventListener('click', () => { if (data.scenes.length >= 500) { toast('Maksimal 500 scene.', true); return; } data.scenes.push(newScene()); markDirty(); renderScenes();
    /* halaman tidak ikut bergulir: fokus tetap di tombol Tambah scene agar bisa diklik berulang */
    const btn = $('addScene'); btn.focus({preventScroll: true});
    const last = $('sceneList').lastElementChild; if (last) { last.classList.add('is-new'); setTimeout(() => last.classList.remove('is-new'), 1600); }
    btn.classList.remove('bump'); void btn.offsetWidth; btn.classList.add('bump');
    toast(`${sceneLabel(data.scenes.length - 1)} ditambahkan di akhir daftar · total ${data.scenes.length} scene.`);
  });
  $('mobileMenu').addEventListener('click', () => document.querySelector('.sidebar').classList.toggle('open'));
  $('saveDraft').addEventListener('click', saveDraft);
  $('deckPrev').addEventListener('click', () => goSlide(deckIndex - 1));
  $('deckNext').addEventListener('click', () => goSlide(deckIndex + 1));
  $('deckStrip').addEventListener('click', (e) => { const b = e.target.closest('[data-slide]'); if (b) goSlide(Number(b.dataset.slide)); });
  document.addEventListener('keydown', (e) => {
    if (!$('section-summary').classList.contains('active') || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || document.querySelector('dialog[open]')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); goSlide(deckIndex + 1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); goSlide(deckIndex - 1); } else if (e.key === 'Home') goSlide(0); else if (e.key === 'End') goSlide(1e6);
  });
  /* geser (swipe) di layar sentuh */
  (() => { let x0 = null; const st = $('deckSlide'); st.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, {passive: true}); st.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 40) goSlide(deckIndex + (dx < 0 ? 1 : -1)); }, {passive: true}); })();
  /* Mulai ulang: kosongkan seluruh isian agar bisa menyusun PPT baru (template aktif dipertahankan). */
  function restartDeck() {
    if (exporting) return;
    nextId = 1; data = defaultData(); dirty = false;
    $('draftStatus').innerHTML = '<span></span> Draft baru';
    syncForm(); setTab('overview');
    toast('Mulai ulang · data dikosongkan. Silakan susun PPT baru.');
    if (window.CA) CA.toast('Scene Deck dimulai ulang', 'Template aktif tetap dipakai');
    setTimeout(() => $('titleInput').focus(), 300);
  }
  $('restartDeck').addEventListener('click', () => { const d = $('restartDialog'); if (typeof d.showModal === 'function') d.showModal(); else if (confirm('Mulai ulang dan kosongkan semua isian?')) restartDeck(); });
  $('restartDialog').addEventListener('close', () => { const v = $('restartDialog').returnValue; $('restartDialog').returnValue = ''; if (v === 'confirm') restartDeck(); else if (v === 'draft') saveDraft(); });
  $('exportButton').addEventListener('click', exportDeck);
  $('resetTemplate').addEventListener('click', () => { loadDefault(); markDirty(); });
  $('exportDialog').addEventListener('cancel', (e) => { if (exporting) e.preventDefault(); });
  window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  hydrateIcons();
  if (!engine()) { $('loadingState').textContent = 'Mesin PPTX belum tersedia. Muat ulang aplikasi.'; $('exportButton').disabled = true; return; }
  syncForm(); loadDefault();
  window.SceneDeckApp = {getData: () => JSON.parse(JSON.stringify(data)), getTemplate: () => template, formErrors, setTab};
})();
