/* ==========================================================================
   CSV Maker — Whisper Media Clip Insertion (versi CSVUPDATE).
   Mode 01 Original · 02 Advance · 03 Legacy. 43 kolom, CRLF, UTF-8 tanpa BOM.
   Versi W dan versi R (Source J / Output R), preview CSV, gambar PNG, dan
   preview sheet siap salin. Tambahan: pengaturan dari Konsol Admin
   (awalan, mode aktif, mode bawaan, jumlah klip awal) dan draft otomatis.
   ========================================================================== */
const $=id=>document.getElementById(id);
const MAX=10;
let DEFAULT_TC='00:00:00:00@25';
const CAX=window.CA||{config:()=>null,onConfig:()=>{},onTheme:()=>{},theme:()=>document.documentElement.dataset.theme,embedded:false,post:()=>{}};
const HEADERS=['Number of Clips to Insert','Source File UID','Output File UID'];
for(let n=1;n<=MAX;n++)HEADERS.push(`File Name Clip ${n}`,`Description Clip ${n}`,`SOM Clip ${n}`,`EOM Clip ${n}`);
const count=$('count'),src=$('source'),prefixSel=$('outputPrefix'),prefixManual=$('prefixManual'),outW=$('output'),srcJ=$('sourceJ'),outR=$('outputR'),statusEl=$('status');

const MODES={
 original:{num:'01',label:'Original',note:'Sistem asli. Source File UID 8 karakter, awalan 01/02/03 dipilih manual. Output W = awalan + 7 karakter pertama + W. Source J dibentuk bila karakter terakhir 1, J, atau j. Output R = awalan + 7 karakter pertama (kapital) + R.'},
 advance:{num:'02',label:'Advance',note:'Awalan dikenali otomatis dari angka terakhir Source File UID: berakhiran 1 → 01, 2 → 02, 3 → 03. Angka terakhir itu diganti W untuk Output W, J untuk Source J, dan R untuk Output R.'},
 legacy:{num:'03',label:'Legacy',note:'Input mandiri. Source File UID, Awalan UID Output, Output W, Source J, dan Output R diisi manual tanpa pembentukan otomatis. Gunakan tombol bantu bila ingin mengisi awal dari Source UID.'}
};
let mode='original';
try{const m=localStorage.getItem('whisper-clip-mode');if(MODES[m])mode=m}catch(_){}
/* --- pengaturan dari Konsol Admin --- */
let CSVCFG={defaultMode:'original',modes:{original:true,advance:true,legacy:true},prefixes:['01','02','03'],defaultCount:1,defaultTc:'00:00:00:00@25'};
function readCsvCfg(c){if(c&&c.csv)CSVCFG=Object.assign({},CSVCFG,c.csv,{modes:Object.assign({},CSVCFG.modes,c.csv.modes||{})})}
readCsvCfg(CAX.config());
function enabledModes(){return Object.keys(MODES).filter(k=>CSVCFG.modes[k]!==false)}
function prefixList(){return (CSVCFG.prefixes||[]).map(p=>String(p).trim()).filter(p=>/^[A-Za-z0-9]{1,4}$/.test(p))}
function prefixText(){const p=prefixList();return p.length>1?p.slice(0,-1).join(', ')+', atau '+p[p.length-1]:(p[0]||'')}

/* tema */
/* tema mengikuti shell (Alt+T); tombol di hero meneruskan ke shell */
function themeLabel(t){$('themeToggle').textContent=t==='light'?'◐ Tema gelap':'◐ Tema terang'}
themeLabel(CAX.theme());CAX.onTheme(themeLabel);
$('themeToggle').addEventListener('click',()=>{if(CAX.embedded)CAX.post('ca:key',{code:'KeyT'});else{const t=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=t;themeLabel(t)}});

/* jumlah klip: default 1 */
for(let i=1;i<=MAX;i++)count.add(new Option(String(i),String(i)));count.value=String(CSVCFG.defaultCount||1);DEFAULT_TC=CSVCFG.defaultTc||DEFAULT_TC;
function activeCount(){const n=Number(count.value);return Number.isInteger(n)&&n>=1&&n<=MAX?n:1}

/* baris klip */
function cellInput(td,key,label,placeholder,hint){const box=document.createElement('div');box.className='field';box.innerHTML=`<label class="sr" for="${key}">${label}</label><input id="${key}" class="clip-input" autocomplete="off" spellcheck="false" placeholder="${placeholder}">${hint?`<span class="hint">${hint}</span>`:''}<span class="warn-text">Hapus spasi di awal/akhir input.</span>`;td.append(box)}
for(let n=1;n<=MAX;n++){const tr=document.createElement('tr');tr.id='clip'+n;tr.innerHTML=`<th class="row-head" scope="row"><span>${n}</span></th><td></td><td></td><td></td><td></td>`;const td=tr.querySelectorAll('td');cellInput(td[0],'name'+n,`File Name Clip ${n}`,'mis. 0125AN47AW_HOMECOMING_02_0053_es02_…');cellInput(td[1],'desc'+n,`Description Clip ${n}`,'mis. OKFURNITURE');cellInput(td[2],'som'+n,`SOM Clip ${n}`,'hh:mm:ss:ff@25','Timecode 25 fps');cellInput(td[3],'eom'+n,`EOM Clip ${n}`,'hh:mm:ss:ff@25','Timecode 25 fps');tr.querySelector('#som'+n).value=DEFAULT_TC;tr.querySelector('#eom'+n).value=DEFAULT_TC;$('clips').append(tr)}
function visibility(){const n=activeCount();for(let i=1;i<=MAX;i++)$('clip'+i).hidden=i>n}

/* pembentukan UID */
let PREFIXES=prefixList();
function buildPrefixOptions(){const keep=prefixSel.value;PREFIXES=prefixList();while(prefixSel.options.length>1)prefixSel.remove(1);PREFIXES.forEach(p=>prefixSel.add(new Option(p,p)));prefixSel.value=PREFIXES.includes(keep)?keep:''}
buildPrefixOptions();
function deriveOutputUid(uid,prefix,suffix){if(!/^[A-Za-z0-9]{8}$/.test(uid)||!PREFIXES.includes(prefix))return '';const base=uid.slice(0,7);return prefix+(suffix==='R'?base.toUpperCase():base)+suffix}
function deriveSourceJ(uid){return /^[A-Za-z0-9]{7}[1Jj]$/.test(uid)?uid.slice(0,-1).toUpperCase()+'J':''}
function detectPrefix(uid){const m=/^[A-Za-z0-9]{7}([0-9])$/.exec(uid);if(!m)return '';return PREFIXES.find(p=>p.slice(-1)===m[1])||''}
function deriveSourceJAdvance(uid){return detectPrefix(uid)?uid.slice(0,7).toUpperCase()+'J':''}
function derive(){
 if(mode==='legacy')return;
 const uid=src.value;let prefix;
 if(mode==='advance'){prefix=detectPrefix(uid);prefixSel.value=prefix;srcJ.value=deriveSourceJAdvance(uid);
   $('hintPrefix').textContent=prefix?`Terdeteksi ${prefix} dari angka akhir ${uid.slice(-1)}.`:`Menunggu UID 8 karakter berakhiran ${PREFIXES.map(p=>p.slice(-1)).join('/')}.`}
 else{prefix=prefixSel.value;srcJ.value=deriveSourceJ(uid)}
 outW.value=deriveOutputUid(uid,prefix,'W');outR.value=deriveOutputUid(uid,prefix,'R');
}

/* mode */
const HINTS0={
 original:{src:'Otomatis mengubah angka 1 terakhir menjadi huruf W.',prefix:'Pilih 01, 02, atau 03 untuk membuat UID Output.',w:'Dibentuk saat UID dan awalan dipilih.',j:'Karakter akhir 1, J, atau j menjadi J kapital.',r:'Awalan mengikuti pilihan; akhir R menggantikan W.'},
 advance:{src:'UID 8 karakter, berakhiran 1, 2, atau 3.',prefix:'',w:'Awalan terdeteksi + 7 karakter pertama + W.',j:'Angka akhir 1/2/3 menjadi J kapital.',r:'Awalan terdeteksi + 7 karakter kapital + R.'},
 legacy:{src:'Bebas, tanpa batas 8 karakter. Dipakai di CSV versi W.',prefix:'Isi manual. Hanya dipakai tombol bantu, tidak ditulis ke CSV.',w:'Isi manual. Menjadi Output UID CSV W dan nama file.',j:'Isi manual. Menjadi Source UID CSV R.',r:'Isi manual. Menjadi Output UID CSV R dan nama file.'}
};
function hintsFor(m){const h=Object.assign({},HINTS0[m]);if(m==='original')h.prefix=`Pilih ${prefixText()} untuk membuat UID Output.`;if(m==='advance')h.src=`UID 8 karakter, berakhiran ${PREFIXES.map(p=>p.slice(-1)).join(', ')}.`;return h}
function setTag(id,text,auto){const t=$(id);t.textContent=text;t.classList.toggle('auto',!!auto)}
function applyMode(){
 const legacy=mode==='legacy',adv=mode==='advance',info=MODES[mode];
 [outW,srcJ,outR].forEach(el=>el.readOnly=!legacy);
 [outW,srcJ,outR].forEach(el=>el.placeholder=legacy?'Isi manual':'Dibuat otomatis');
 src.maxLength=legacy?40:8;outW.maxLength=legacy?40:10;srcJ.maxLength=legacy?40:8;outR.maxLength=legacy?40:10;
 prefixSel.hidden=legacy;$('prefixManualWrap').hidden=!legacy;prefixSel.disabled=adv;
 prefixSel.options[0].textContent=adv?'Otomatis dari UID':'Pilih awalan';
 $('legacyTools').hidden=!legacy;
 setTag('tagSrc','INPUT');setTag('tagPrefix',legacy?'MANUAL':adv?'OTOMATIS':'PILIH',adv);
 ['tagW','tagJ','tagR'].forEach(id=>setTag(id,legacy?'MANUAL':'OTOMATIS',!legacy));
 const h=hintsFor(mode);$('hintSrc').textContent=h.src;$('hintPrefix').textContent=h.prefix;$('hintW').textContent=h.w;$('hintJ').textContent=h.j;$('hintR').textContent=h.r;
 $('heroMode').textContent=`Mode ${info.num} · ${info.label}`;$('modeNoteTag').textContent='MODE '+info.num;$('modeNoteText').textContent=info.note.replace('01/02/03',PREFIXES.join('/'));
 document.querySelectorAll('#modeTabs button').forEach(b=>{b.setAttribute('aria-selected',String(b.dataset.mode===mode));b.hidden=CSVCFG.modes[b.dataset.mode]===false});
 document.title=`Clip Insertion · ${info.label}`;
}
function setMode(m,silent){if(!MODES[m]||m===mode||CSVCFG.modes[m]===false)return;const prev=mode;
 if(m==='legacy'){prefixManual.value=prefixSel.value||prefixManual.value}
 if(prev==='legacy'&&m==='original'&&PREFIXES.includes(prefixManual.value))prefixSel.value=prefixManual.value;
 if(prev==='advance'&&m==='original')prefixSel.value=prefixSel.value||'';
 mode=m;try{localStorage.setItem('whisper-clip-mode',m)}catch(_){}
 clearBad();applyMode();refreshAll();statusEl.className='status';statusEl.textContent='';
 if(!silent)toast(`Mode ${MODES[m].num} · ${MODES[m].label}`,m==='legacy'?'Kolom UID sekarang bisa diisi manual.':m==='advance'?'Awalan mengikuti angka akhir Source UID.':'Kembali ke alur asli.')}
document.querySelectorAll('#modeTabs button').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));

$('legacyFill').addEventListener('click',()=>{const uid=src.value.trim(),p=prefixManual.value.trim();
 if(!/^[A-Za-z0-9]{8}$/.test(uid)){toast('Belum bisa dibentuk','Source File UID harus 8 karakter alfanumerik.',true);src.focus();return}
 const prefix=PREFIXES.includes(p)?p:detectPrefix(uid);
 if(!prefix){toast('Belum bisa dibentuk',`Isi awalan ${prefixText()}, atau akhiri UID dengan angka ${PREFIXES.map(p=>p.slice(-1)).join('/')}.`,true);prefixManual.focus();return}
 prefixManual.value=prefix;outW.value=deriveOutputUid(uid,prefix,'W');outR.value=deriveOutputUid(uid,prefix,'R');srcJ.value=(detectPrefix(uid)||/^[A-Za-z0-9]{7}[Jj]$/.test(uid))?uid.slice(0,7).toUpperCase()+'J':'';
 refreshAll();toast('UID terbentuk','W, J, dan R terisi. Silakan ubah bila perlu.')});

/* timecode */
function tcValid(s){return /^\d{2}:\d{2}:\d{2}:\d{2}@25$/.test(s)&&+s.slice(0,2)<4&&+s.slice(3,5)<60&&+s.slice(6,8)<60&&+s.slice(9,11)<25}
function tcFrames(s){return ((+s.slice(0,2)*60+ +s.slice(3,5))*60+ +s.slice(6,8))*25+ +s.slice(9,11)}
function tcShort(v){return String(v??'').trim().replace(/@\d+$/,'')}

/* nama klip versi R */
function rVariantClipName(name){if(!name)return name;const w=outW.value,r=outR.value;if(!w||!r)return name;const split=name.indexOf('_');const first=split<0?name:name.slice(0,split);if(first.toUpperCase()!==w.toUpperCase())return name;return r+(split<0?'':name.slice(split))}

/* validasi & baris CSV */
function editableInputs(){return [...document.querySelectorAll('.uid-input,.clip-input')].filter(i=>!i.readOnly&&!i.disabled&&!i.closest('[hidden]'))}
function validate(variant){
 const fail=(msg,el)=>({ok:false,msg,el});
 const spaced=editableInputs().find(i=>i.value!==i.value.trim());
 if(spaced)return fail('Hapus spasi di awal/akhir pada kolom yang ditandai.',spaced);
 derive();
 const raw=src.value,isR=variant==='R';
 if(mode==='legacy'){
  for(const [el,label] of [[src,'Source File UID'],[srcJ,'Source File UID (J)'],[outW,'Output File UID (W)'],[outR,'Output File UID (R)']])
   if(!/^[A-Za-z0-9_-]*$/.test(el.value))return fail(`${label} hanya boleh berisi huruf, angka, _ atau -.`,el);
  if(!/^[A-Za-z0-9]*$/.test(prefixManual.value))return fail('Awalan UID Output hanya boleh berisi huruf atau angka.',prefixManual);
  if(isR&&raw&&!srcJ.value)return fail('Isi Source File UID (J) untuk CSV versi R.',srcJ);
  if(isR&&outW.value&&!outR.value)return fail('Isi Output File UID (R) untuk CSV versi R.',outR);
 }else{
  if(raw&&!/^[A-Za-z0-9]{8}$/.test(raw))return fail('Source File UID harus tepat 8 karakter alfanumerik.',src);
  if(mode==='advance'){if(raw&&!detectPrefix(raw))return fail(`Mode Advance: Source File UID harus berakhiran angka ${PREFIXES.map(p=>p.slice(-1)).join(', ')} agar awalan terdeteksi.`,src)}
  else{
   if(isR&&raw&&!srcJ.value)return fail('Untuk CSV versi R, Source File UID harus berakhiran 1, J, atau j agar menjadi Source File UID J.',src);
   if(raw&&!prefixSel.value)return fail(`Pilih awalan UID Output (${prefixText()}).`,prefixSel);
  }
 }
 const n=activeCount();
 const row=[String(n),isR?srcJ.value:raw,isR?outR.value:outW.value];
 for(let i=1;i<=MAX;i++){
  if(i>n){row.push('','',DEFAULT_TC,DEFAULT_TC);continue}
  let [name,desc,som,eom]=['name','desc','som','eom'].map(k=>$(k+i).value);
  if(som&&!tcValid(som))return fail(`SOM Clip ${i} tidak valid. Gunakan hh:mm:ss:ff@25.`,$('som'+i));
  if(eom&&!tcValid(eom))return fail(`EOM Clip ${i} tidak valid. Gunakan hh:mm:ss:ff@25.`,$('eom'+i));
  if(som&&eom&&tcFrames(eom)<tcFrames(som))return fail(`EOM Clip ${i} lebih awal dari SOM. Periksa urutan In/Out.`,$('eom'+i));
  if(isR)name=rVariantClipName(name);
  row.push(name,desc,som,eom);
 }
 if(row.length!==HEADERS.length)return fail('Struktur CSV tidak sesuai 43 kolom.');
 return {ok:true,row};
}
function csvCell(v){const s=String(v??'');return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}
function buildCsv(row){return HEADERS.map(csvCell).join(',')+'\r\n'+row.map(csvCell).join(',')+'\r\n'}
function clearBad(){document.querySelectorAll('.field.bad').forEach(f=>f.classList.remove('bad'))}
function exportCsv(variant){
 clearBad();const r=validate(variant);
 if(!r.ok){statusEl.className='status err';statusEl.textContent=r.msg;if(r.el){r.el.closest('.field')?.classList.add('bad');r.el.focus()}return}
 const csv=buildCsv(r.row);const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
 const filename=(r.row[2]||`CSV_TEMPLATE_${variant}`).replace(/[^A-Za-z0-9_-]/g,'_')+'.csv';
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
 statusEl.className='status ok';statusEl.textContent=`CSV versi ${variant} dibuat: ${filename} (43 kolom, tanpa BOM).`;toast(`CSV versi ${variant} tersimpan`,filename);CAX.post('ca:usage-event',{ev:'csv-'+variant.toLowerCase()})}
$('exportW').addEventListener('click',()=>exportCsv('W'));$('exportR').addEventListener('click',()=>exportCsv('R'));

/* preview CSV (label/nilai) */
function displaySpaces(v){const s=String(v??'');return s.replace(/^ +/,m=>'␣'.repeat(m.length)).replace(/ +$/,m=>'␣'.repeat(m.length))||' '}
function previewData(variant){const isR=variant==='R',n=activeCount();const rows=[['Number of Clips to Insert',String(n)],['Source File UID',isR?srcJ.value:src.value],['Output File UID',isR?outR.value:outW.value]];
 for(let i=1;i<=n;i++){const name=$('name'+i).value;rows.push([`File Name Clip ${i}`,isR?rVariantClipName(name):name],[`Description Clip ${i}`,$('desc'+i).value],[`SOM Clip ${i}`,$('som'+i).value],[`EOM Clip ${i}`,$('eom'+i).value])}return rows}
function renderKV(id,variant){const body=$(id);body.replaceChildren();for(const [label,value] of previewData(variant)){const tr=document.createElement('tr');if(String(value)!==String(value).trim())tr.className='warn';const a=document.createElement('td'),b=document.createElement('td');a.textContent=label;b.textContent=displaySpaces(value);tr.append(a,b);body.append(tr)}}

/* preview sheet baru */
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function programmeOf(name){const parts=String(name??'').trim().split('_');return parts.length>1?parts[1].trim().toUpperCase():''}
function sheetRows(variant){const n=activeCount(),rows=[];for(let i=1;i<=n;i++){let name=$('name'+i).value.trim();if(variant==='R')name=rVariantClipName(name);rows.push([programmeOf(name),`${i} of ${n}`,name,$('desc'+i).value.trim(),tcShort($('som'+i).value),tcShort($('eom'+i).value)])}return rows}
const FONT="font-family:Arial,Helvetica,sans-serif;font-size:11pt;";
const TH=FONT+"background:#000000;color:#FFFFFF;font-weight:bold;text-align:center;padding:2px 10px;border:1px solid #000000;white-space:nowrap;";
const TD=FONT+"background:#FFFFFF;color:#000000;text-align:center;vertical-align:middle;padding:2px 10px;border:1px solid #000000;white-space:nowrap;";
function sheetHTML(variant){
 const head=`<tr><th rowspan="2" style="${TH}vertical-align:bottom;min-width:150px">Programme</th><th rowspan="2" style="${TH}vertical-align:bottom;min-width:110px">Clip Number</th><th rowspan="2" style="${TH}vertical-align:bottom;min-width:360px">Clip Title</th><th rowspan="2" style="${TH}vertical-align:bottom;min-width:150px">Brand</th><th colspan="2" style="${TH}vertical-align:bottom">Time Codes</th></tr><tr><th style="${TH}min-width:95px">IN</th><th style="${TH}min-width:95px">OUT</th></tr>`;
 const body=sheetRows(variant).map(r=>`<tr>${r.map((v,j)=>`<td style="${TD}${j<4?'font-weight:bold;':''}">${esc(v)||'&nbsp;'}</td>`).join('')}</tr>`).join('');
 return `<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;${FONT}"><thead>${head}</thead><tbody>${body}</tbody></table>`}
function sheetTSV(variant){const clean=v=>String(v).replace(/[\t\r\n]+/g,' ');return ['\t\t\t\tTime Codes\t','Programme\tClip Number\tClip Title\tBrand\tIN\tOUT',...sheetRows(variant).map(r=>r.map(clean).join('\t'))].join('\r\n')}
function renderSheets(){$('sheetW').innerHTML=sheetHTML('W');$('sheetR').innerHTML=sheetHTML('R')}

async function copyRich(html,text){
 const doc=`<html><head><meta charset="utf-8"></head><body>${html}</body></html>`;
 try{if(navigator.clipboard&&window.ClipboardItem){await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([doc],{type:'text/html'}),'text/plain':new Blob([text],{type:'text/plain'})})]);return true}}catch(_){}
 let ok=false;const h=e=>{e.clipboardData.setData('text/html',doc);e.clipboardData.setData('text/plain',text);e.preventDefault();ok=true};
 document.addEventListener('copy',h);try{document.execCommand('copy')}catch(_){}document.removeEventListener('copy',h);if(ok)return true;
 const box=document.createElement('div');box.contentEditable='true';box.style.cssText='position:fixed;left:-9999px;top:0';box.innerHTML=html;document.body.append(box);const range=document.createRange();range.selectNodeContents(box);const sel=getSelection();sel.removeAllRanges();sel.addRange(range);try{ok=document.execCommand('copy')}catch(_){}sel.removeAllRanges();box.remove();return ok}
async function copySheets(variants){
 const label=v=>`<p style="${FONT}font-weight:bold;margin:8px 0 4px">VERSI ${v}</p>`;
 const html=variants.length>1?variants.map(v=>label(v)+sheetHTML(v)).join('<br>'):sheetHTML(variants[0]);
 const text=variants.length>1?variants.map(v=>`VERSI ${v}\r\n`+sheetTSV(v)).join('\r\n\r\n'):sheetTSV(variants[0]);
 const ok=await copyRich(html,text);if(ok)CAX.post('ca:usage-event',{ev:'csv-copy'});
 toast(ok?'Tabel tersalin':'Gagal menyalin',ok?`Versi ${variants.join(' + ')} · ${activeCount()} klip, siap ditempel.`:'Browser menolak akses clipboard. Blok tabel lalu tekan Ctrl+C.',!ok)}
$('copyW').addEventListener('click',()=>copySheets(['W']));$('copyR').addEventListener('click',()=>copySheets(['R']));$('copyBoth').addEventListener('click',()=>copySheets(['W','R']));

/* gambar PNG preview CSV */
function makePreviewPng(variant){const rows=previewData(variant),w=720,pad=22,titleH=48,rowH=34,h=pad+titleH+rows.length*rowH+pad,scale=2;const canvas=document.createElement('canvas');canvas.width=w*scale;canvas.height=h*scale;const ctx=canvas.getContext('2d');ctx.scale(scale,scale);ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.fillStyle='#111827';ctx.font='bold 25px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(`Whisper Media - Clip Insertion (${variant})`,w/2,pad+titleH/2);const x=pad,y=pad+titleH,tableW=w-pad*2,labelW=Math.round(tableW*.54);ctx.font='15px Arial';rows.forEach(([label,value],i)=>{const yy=y+i*rowH;ctx.fillStyle='#fff';ctx.fillRect(x,yy,tableW,rowH);ctx.strokeStyle='#222';ctx.lineWidth=1;ctx.strokeRect(x,yy,tableW,rowH);ctx.beginPath();ctx.moveTo(x+labelW,yy);ctx.lineTo(x+labelW,yy+rowH);ctx.stroke();ctx.fillStyle='#111';ctx.textAlign='left';ctx.save();ctx.beginPath();ctx.rect(x+5,yy+1,labelW-10,rowH-2);ctx.clip();ctx.fillText(label,x+6,yy+rowH/2);ctx.restore();ctx.textAlign='right';ctx.save();ctx.beginPath();ctx.rect(x+labelW+4,yy+1,tableW-labelW-9,rowH-2);ctx.clip();ctx.fillText(displaySpaces(value),x+tableW-6,yy+rowH/2);ctx.restore()});return new Promise((res,rej)=>canvas.toBlob(b=>b?res(b):rej(new Error('Browser gagal membuat PNG.')),'image/png'))}
async function savePreviewPng(variant){const msg=$(variant==='R'?'previewStatusJR':'previewStatus');const uid=variant==='R'?outR.value:outW.value;const base=(uid||`CSV_TEMPLATE_${variant}`).replace(/[^A-Za-z0-9_-]/g,'_')+`_preview_${variant}.png`;msg.textContent='Menyiapkan gambar…';
 try{const blob=await makePreviewPng(variant);
  if(window.showDirectoryPicker){try{const dir=await window.showDirectoryPicker({id:`csv-preview-${variant}`,mode:'readwrite'});const fh=await dir.getFileHandle(base,{create:true});const wr=await fh.createWritable();await wr.write(blob);await wr.close();msg.textContent=`PNG tersimpan: ${base}`;return}catch(e){if(e.name==='AbortError'){msg.textContent='Penyimpanan dibatalkan.';return}}}
  if(window.showSaveFilePicker){try{const fh=await window.showSaveFilePicker({suggestedName:base,types:[{description:'PNG image',accept:{'image/png':['.png']}}]});const wr=await fh.createWritable();await wr.write(blob);await wr.close();msg.textContent=`PNG tersimpan: ${fh.name}`;return}catch(e){if(e.name==='AbortError'){msg.textContent='Penyimpanan dibatalkan.';return}}}
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=base;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500);msg.textContent='Unduhan PNG dimulai.'}catch(e){msg.textContent=e.message||'PNG gagal disimpan.'}}
$('savePreviewImage').addEventListener('click',()=>savePreviewPng('W'));$('savePreviewImageJR').addEventListener('click',()=>savePreviewPng('R'));

/* status live & toast */
function updateReady(){const ok={};for(const v of ['W','R']){const r=validate(v),row=$('ready'+v);ok[v]=r.ok;row.dataset.ok=String(r.ok);row.title=r.ok?'':r.msg;row.querySelector('span').textContent=r.ok?`Siap · ${r.row[2]?r.row[2]+'.csv':'CSV_TEMPLATE_'+v+'.csv'} · ${activeCount()} klip`:r.msg}dockSync(ok)}
function markSpaces(){document.querySelectorAll('.uid-input,.clip-input').forEach(i=>i.closest('.field')?.classList.toggle('space-warn',!i.readOnly&&i.value!==i.value.trim()))}
var refreshAll;refreshAll=function(){derive();visibility();markSpaces();renderKV('previewRows','W');renderKV('previewRowsJR','R');renderSheets();updateReady()}
function toast(t,s,err){const e=document.createElement('div');e.className='toast'+(err?' err':'');e.innerHTML=`<i>${err?'!':'✓'}</i><div><b>${esc(t)}</b><span>${esc(s)}</span></div>`;$('toasts').append(e);setTimeout(()=>e.remove(),4200)}

document.querySelectorAll('.uid-input,.clip-input').forEach(i=>{i.addEventListener('input',()=>{i.closest('.field')?.classList.remove('bad');refreshAll()})});
prefixSel.addEventListener('change',()=>{prefixSel.closest('.field').classList.remove('bad');refreshAll()});
count.addEventListener('change',()=>refreshAll());
/* --- draft otomatis: isi form tidak hilang saat pindah menu / muat ulang --- */
const DRAFT_KEY='whisper-clip-draft';
function saveDraft(){try{const d={count:count.value,prefix:prefixSel.value,prefixManual:prefixManual.value,src:src.value,w:outW.value,j:srcJ.value,r:outR.value,clips:[]};for(let i=1;i<=MAX;i++)d.clips.push(['name','desc','som','eom'].map(k=>$(k+i).value));localStorage.setItem(DRAFT_KEY,JSON.stringify(d));$('draftStatus').textContent='Draft tersimpan otomatis · '+new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}catch(_){}}
function loadDraft(){try{const d=JSON.parse(localStorage.getItem(DRAFT_KEY));if(!d)return false;count.value=d.count||count.value;src.value=d.src||'';prefixManual.value=d.prefixManual||'';if(PREFIXES.includes(d.prefix))prefixSel.value=d.prefix;if(mode==='legacy'){outW.value=d.w||'';srcJ.value=d.j||'';outR.value=d.r||''}(d.clips||[]).forEach((c,i)=>{if(i<MAX)['name','desc','som','eom'].forEach((k,j)=>{if(c[j]!=null)$(k+(i+1)).value=c[j]})});$('draftStatus').textContent='Draft sebelumnya dipulihkan.';return true}catch(_){return false}}
$('draftClear').addEventListener('click',()=>{try{localStorage.removeItem(DRAFT_KEY)}catch(_){}src.value='';prefixManual.value='';prefixSel.value='';outW.value='';srcJ.value='';outR.value='';count.value=String(CSVCFG.defaultCount||1);for(let i=1;i<=MAX;i++){$('name'+i).value='';$('desc'+i).value='';$('som'+i).value=DEFAULT_TC;$('eom'+i).value=DEFAULT_TC}clearBad();refreshAll();$('draftStatus').textContent='Form dikosongkan.';toast('Form dikosongkan','Semua kolom kembali ke nilai awal.')});
const _refresh=refreshAll;refreshAll=function(){_refresh();saveDraft()};
/* --- konfigurasi Admin diterapkan langsung --- */
function ensureModeAllowed(){const en=enabledModes();if(!en.includes(mode)){mode=en.includes(CSVCFG.defaultMode)?CSVCFG.defaultMode:en[0]}}
function applyCsvConfig(c){readCsvCfg(c);DEFAULT_TC=CSVCFG.defaultTc||'00:00:00:00@25';buildPrefixOptions();ensureModeAllowed();applyMode();_refresh()}
let hadMode=false;try{hadMode=!!localStorage.getItem('whisper-clip-mode')}catch(_){}
if(!hadMode&&MODES[CSVCFG.defaultMode]&&CSVCFG.modes[CSVCFG.defaultMode]!==false)mode=CSVCFG.defaultMode;
ensureModeAllowed();
loadDraft();
CAX.onConfig(applyCsvConfig);
applyMode();_refresh();

/* ==========================================================================
   Panel cepat (dock kanan): status ekspor W/R, status ekspor terakhir,
   draft, tombol Kosongkan form, dan tombol gulir atas/bawah.
   Panel menempel (sticky) saat halaman digulir; di layar sempit pindah ke atas.
   ========================================================================== */
function dockSync(ok){
 const dock=$('csvDock');if(!dock)return;
 ok=ok||{W:$('readyW').dataset.ok==='true',R:$('readyR').dataset.ok==='true'};
 const n=(ok.W?1:0)+(ok.R?1:0),state=n===2?'ok':n===1?'part':'bad';
 dock.dataset.state=state;
 $('dockBadge').textContent=state==='ok'?'✓ SIAP':state==='part'?'1 / 2 SIAP':'! PERIKSA';
 const info=MODES[mode]||MODES.original;
 $('dockModeNum').textContent=info.num;$('dockModeLabel').textContent=info.label;
 $('dockClips').textContent=activeCount()+' klip aktif';
}
(function dockScroll(){
 const up=$('scrollTopBtn'),down=$('scrollBottomBtn'),bar=$('scrollProgress');if(!up||!down)return;
 const se=()=>document.scrollingElement||document.documentElement;
 const reduce=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch(_){return false}};
 function sync(){const el=se(),max=Math.max(0,el.scrollHeight-innerHeight),y=el.scrollTop,p=max?Math.min(1,y/max):0;
  bar.style.transform=`scaleY(${p.toFixed(3)})`;up.disabled=y<=4;down.disabled=max-y<=4}
 up.addEventListener('click',()=>scrollTo({top:0,behavior:reduce()?'auto':'smooth'}));
 down.addEventListener('click',()=>scrollTo({top:se().scrollHeight,behavior:reduce()?'auto':'smooth'}));
 let raf=0;const on=()=>{if(!raf)raf=requestAnimationFrame(()=>{raf=0;sync()})};
 addEventListener('scroll',on,{passive:true});addEventListener('resize',on);
 if(window.ResizeObserver)new ResizeObserver(on).observe(document.body);
 sync();
})();
/* Kosongkan form juga menghapus pesan ekspor terakhir di panel */
$('draftClear').addEventListener('click',()=>{statusEl.className='status';statusEl.textContent='';dockSync()});
dockSync();
