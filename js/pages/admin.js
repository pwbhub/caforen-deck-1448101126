/* ==========================================================================
   Konsol Admin — mengedit konfigurasi tampilan sebagai DRAFT, menampilkan
   preview langsung, lalu menyimpan lewat shell (index.html) yang memvalidasi
   sesi Admin dan menyebarkan perubahan ke semua halaman User.
   Protokol (via postMessage ke shell):
     ca:admin-hello → ca:admin-data       ca:config-set → ca:config-saved
     ca:admin-key   → ca:admin-key-result ca:logs-get / ca:logs-clear → ca:logs
     ca:history-restore / ca:config-reset → ca:config-saved
     ca:site-file   → ca:site-file
   ========================================================================== */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const CA=window.CA;
  let saved=null,draft=null,meta={hasCustomKey:false,logs:[],guard:{},history:[]};
  const clone=o=>JSON.parse(JSON.stringify(o));
  const getPath=(o,p)=>p.split('.').reduce((a,k)=>a==null?a:a[k],o);
  function setPath(o,p,v){const ks=p.split('.');let a=o;ks.slice(0,-1).forEach(k=>{if(a[k]==null||typeof a[k]!=='object')a[k]={};a=a[k]});a[ks[ks.length-1]]=v}
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let usage=null;
  const isDirty=()=>saved&&JSON.stringify(draft)!==JSON.stringify(saved);

  /* ---------- toast & konfirmasi dua klik ---------- */
  function toast(t,s,err){const e=document.createElement('div');e.className='adm-toast'+(err?' err':'');e.innerHTML=`<i>${err?'!':'✓'}</i><div><b>${esc(t)}</b>${s?`<span>${esc(s)}</span>`:''}</div>`;$('admToasts').append(e);setTimeout(()=>e.remove(),4200)}
  function confirmClick(btn,fn){
    if(btn.dataset.armed==='1'){btn.dataset.armed='';btn.textContent=btn.dataset.label;clearTimeout(btn._t);fn();return}
    btn.dataset.label=btn.dataset.label||btn.textContent;btn.dataset.armed='1';btn.textContent='Klik lagi untuk konfirmasi';
    btn._t=setTimeout(()=>{btn.dataset.armed='';btn.textContent=btn.dataset.label},3500);
  }

  /* ---------- komunikasi dengan shell ---------- */
  const post=(type,payload)=>CA.post(type,payload||{});
  CA.on('ca:admin-data',d=>{
    saved=clone(d.config);draft=clone(d.config);
    usage=d.usage||null;
    meta={hasCustomKey:d.hasCustomKey,logs:d.logs||[],guard:d.guard||{},history:d.history||[],session:d.session};
    renderAll();loadPreview();
  });
  CA.on('ca:config-saved',d=>{saved=clone(d.config);draft=clone(d.config);meta.history=d.history||meta.history;renderAll();schedulePreview();toast('Tersimpan & diterapkan','Tampilan User sudah memakai perubahan ini.');post('ca:logs-get')});
  CA.on('ca:logs',d=>{meta.logs=d.logs||[];meta.guard=d.guard||{};renderLogs();renderStats()});
  CA.on('ca:admin-key-result',d=>{const m=$('keyMsg');m.hidden=false;m.textContent=d.message;m.className='notice span2 '+(d.ok?'ok':'err');m.style.background=d.ok?'var(--ok-bg)':'var(--danger-bg)';m.style.color=d.ok?'var(--ok)':'var(--danger)';if(d.ok){meta.hasCustomKey=!!d.hasCustomKey;$('keyForm').reset();renderKeyState();post('ca:logs-get')}toast(d.ok?'Private key':'Gagal',d.message,!d.ok)});
  CA.on('ca:site-file',d=>download('site-config.js',d.text,'text/javascript'));
  CA.on('ca:error',d=>toast('Gagal',d.message,true));
  post('ca:admin-hello');

  /* ---------- navigasi bagian ---------- */
  let section='overview';
  try{section=localStorage.getItem('ca-admin-sec')||'overview'}catch(_){}
  function showSection(s){
    if(!document.querySelector(`.adm-sec[data-sec="${s}"]`))s='overview';
    section=s;try{localStorage.setItem('ca-admin-sec',s)}catch(_){}
    document.querySelectorAll('.adm-sec').forEach(el=>el.hidden=el.dataset.sec!==s);
    document.querySelectorAll('#admNav button').forEach(b=>b.setAttribute('aria-current',String(b.dataset.sec===s)));
    if(s==='logs')post('ca:logs-get');
    if(s==='insights')post('ca:usage-get');
  }
  $('admNav').addEventListener('click',e=>{const b=e.target.closest('button[data-sec]');if(b)showSection(b.dataset.sec)});
  document.addEventListener('click',e=>{const j=e.target.closest('[data-jump]');if(j)showSection(j.dataset.jump);const p=e.target.closest('[data-preview]');if(p){$('pvRoute').value=p.dataset.preview;loadPreview()}});
  showSection(section);

  /* ---------- perubahan draft ---------- */
  function changed(){updateSaveBar();renderStats();schedulePreview()}
  function updateSaveBar(){
    const d=isDirty();$('saveBar').dataset.dirty=String(!!d);
    $('sbText').textContent=d?'Ada perubahan belum disimpan':'Semua perubahan tersimpan';
    $('btnSave').disabled=!d;$('btnDiscard').disabled=!d;
    const t=saved&&saved.meta&&saved.meta.updatedAt;
    $('sbMeta').textContent=t?'Terakhir disimpan '+new Date(t).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'}):'Masih memakai tampilan bawaan';
  }
  $('btnSave').addEventListener('click',()=>{
    const tc=draft.csv.defaultTc;if(tc&&!/^\d{2}:\d{2}:\d{2}:\d{2}@25$/.test(tc)){toast('Periksa CSV Maker','Timecode awal harus hh:mm:ss:ff@25.',true);showSection('csv');return}
    post('ca:config-set',{config:draft});
  });
  $('btnDiscard').addEventListener('click',()=>{draft=clone(saved);renderAll();schedulePreview();toast('Perubahan dibatalkan','Draft kembali ke versi tersimpan.')});
  window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();if(isDirty())$('btnSave').click()}});

  /* ---------- field terikat data-path ---------- */
  function fillBound(){
    document.querySelectorAll('[data-path]').forEach(el=>{
      const v=getPath(draft,el.dataset.path);
      if(el.type==='checkbox')el.checked=!!v;else el.value=v==null?'':String(v);
    });
  }
  document.addEventListener('input',onBound);document.addEventListener('change',onBound);
  function onBound(e){
    const el=e.target;if(!el.dataset||!el.dataset.path||!draft)return;
    let v=el.type==='checkbox'?el.checked:el.value;
    if(el.dataset.type==='int')v=parseInt(v,10)||0;
    setPath(draft,el.dataset.path,v);
    if(el.dataset.path==='csv.defaultTc'){const ok=!v||/^\d{2}:\d{2}:\d{2}:\d{2}@25$/.test(v);$('tcHint').textContent=ok?'Format hh:mm:ss:ff@25.':'⚠ Format salah — gunakan hh:mm:ss:ff@25.';$('tcHint').style.color=ok?'':'var(--danger)'}
    if(el.dataset.path==='defaultRoute'||el.dataset.path.indexOf('csv.modes')===0){if(!Object.values(draft.csv.modes).some(Boolean)){draft.csv.modes.original=true;fillBound();toast('Minimal satu mode','Mode Original diaktifkan kembali.',true)}}
    changed();
  }

  /* ---------- menu (rute) ---------- */
  function routeOptions(withShell,withAll){
    const o=[];if(withShell)o.push(['shell','Shell · header, login, screensaver']);if(withAll)o.push(['*','Semua halaman']);
    (draft?draft.routes:[]).forEach(r=>o.push([r.id,r.label+' ('+r.id+')']));
    return o;
  }
  function renderRoutes(){
    const tb=$('routesTbl').tBodies[0];tb.replaceChildren();
    draft.routes.forEach((r,i)=>{
      const tr=document.createElement('tr');if(r.visible===false)tr.className='off';
      tr.innerHTML=`<td><span class="ord"><button type="button" data-mv="-1" aria-label="Naik">▲</button><button type="button" data-mv="1" aria-label="Turun">▼</button></span></td>
      <td><label class="switch"><input type="checkbox" data-k="visible" ${r.visible!==false?'checked':''}><span></span></label></td>
      <td class="w-ico"><input data-k="icon" maxlength="3" value="${esc(r.icon)}" aria-label="Ikon"></td>
      <td><input data-k="label" maxlength="24" value="${esc(r.label)}" aria-label="Nama tab"></td>
      <td><input data-k="title" maxlength="40" value="${esc(r.title)}" aria-label="Judul halaman"></td>
      <td><input type="color" data-k="color" value="${esc(/^#[0-9a-f]{6}$/i.test(r.color)?r.color:'#C6F21B')}" aria-label="Warna"></td>`;
      tr.addEventListener('input',e=>{const k=e.target.dataset.k;if(!k)return;r[k]=k==='visible'?e.target.checked:e.target.value;if(k==='visible'){tr.className=r.visible===false?'off':'';if(!draft.routes.some(x=>x.visible!==false)){r.visible=true;e.target.checked=true;tr.className='';toast('Minimal satu menu','User harus punya setidaknya satu menu.',true)}}if(k==='label'){renderRouteSelects()}changed()});
      tr.addEventListener('click',e=>{const b=e.target.closest('[data-mv]');if(!b)return;const j=i+Number(b.dataset.mv);if(j<0||j>=draft.routes.length)return;const a=draft.routes;[a[i],a[j]]=[a[j],a[i]];renderRoutes();changed()});
      tb.append(tr);
    });
    renderRouteSelects();
  }
  function renderRouteSelects(){
    const dr=$('f-defroute'),keep=draft.defaultRoute;
    dr.innerHTML=draft.routes.map(r=>`<option value="${esc(r.id)}">${esc(r.label)}</option>`).join('');dr.value=keep;
    const pv=$('pvRoute'),pk=pv.value||pvRouteSaved();
    pv.innerHTML=draft.routes.map(r=>`<option value="${esc(r.id)}">${esc(r.icon+' '+r.label)}</option>`).join('');
    pv.value=draft.routes.some(r=>r.id===pk)?pk:'csv';
    const ct=$('codeTarget'),ck=ct.value||'all';
    ct.innerHTML=routeOptions(true,true).map(([v,l])=>`<option value="${esc(v)}">${esc(l)}</option>`).join('');ct.value=ck;
    renderRules(true);
  }

  /* ---------- warna ---------- */
  const ACC=[['g','Lime (utama)','#C6F21B'],['yel','Kuning','#F6E000'],['red','Koral','#FF6B57'],['blu','Biru','#7CC4FF'],['pink','Merah muda','#FF9BC8'],['orange','Jingga','#FFA94D'],['mint','Mint','#5EE6B5'],['violet','Ungu','#B9A4FF']];
  const TOK=[['bg','Latar halaman'],['paper','Kartu / panel'],['fg','Teks & garis'],['mut','Teks redup'],['field','Kolom isian']];
  const TDEF={light:{bg:'#F6F3E2',paper:'#FFFDF3',fg:'#11141A',mut:'#555A66',field:'#FFFFFF'},dark:{bg:'#0D1016',paper:'#171C26',fg:'#F4F1DE',mut:'#A9B1C4',field:'#10141C'}};
  function colorBox(path,label,def){
    const v=getPath(draft,path)||'';const box=document.createElement('div');box.className='cbox'+(v?' is-set':'');
    const hex=/^#[0-9a-f]{6}$/i.test(v)?v:def;
    box.innerHTML=`<input type="color" value="${esc(hex)}" aria-label="${esc(label)}"><label>${esc(label)}<input value="${esc(v)}" placeholder="${esc(def)}" maxlength="40" spellcheck="false"></label><button type="button" title="Kembalikan bawaan" aria-label="Kembalikan bawaan">×</button>`;
    const [pick,text,clr]=[box.querySelector('input[type=color]'),box.querySelector('label input'),box.querySelector('button')];
    pick.addEventListener('input',()=>{text.value=pick.value;setPath(draft,path,pick.value);box.classList.add('is-set');changed()});
    text.addEventListener('input',()=>{const t=text.value.trim();setPath(draft,path,t);if(/^#[0-9a-f]{6}$/i.test(t))pick.value=t;box.classList.toggle('is-set',!!t);changed()});
    clr.addEventListener('click',()=>{setPath(draft,path,'');text.value='';pick.value=def;box.classList.remove('is-set');changed()});
    return box;
  }
  function renderColors(){
    $('accentGrid').replaceChildren(...ACC.map(([k,l,d])=>colorBox('colors.accents.'+k,l,d)));
    $('lightGrid').replaceChildren(...TOK.map(([k,l])=>colorBox('colors.light.'+k,l,TDEF.light[k])));
    $('darkGrid').replaceChildren(...TOK.map(([k,l])=>colorBox('colors.dark.'+k,l,TDEF.dark[k])));
  }
  const PRESETS=[
    {name:'Bawaan',c:{accents:{},light:{},dark:{}}},
    {name:'Samudra',c:{accents:{g:'#38E1D4',yel:'#FFD166',red:'#FF6B6B',blu:'#5AA9FF',mint:'#7AF0C9',violet:'#9DB4FF'},light:{bg:'#EEF6F8',paper:'#FFFFFF'},dark:{bg:'#07121D',paper:'#0F2133',field:'#0B1A28'}}},
    {name:'Senja',c:{accents:{g:'#FF9F43',yel:'#FFE066',red:'#FF5E78',pink:'#FF8FB1',violet:'#C792EA',orange:'#FFB86B'},light:{bg:'#FFF4E8',paper:'#FFFBF5'},dark:{bg:'#170D12',paper:'#28161E',field:'#1E1117'}}},
    {name:'Hutan',c:{accents:{g:'#7BD389',yel:'#E9F27B',mint:'#6EE7B7',blu:'#8EC5FC'},light:{bg:'#EEF5EA',paper:'#FBFFF8'},dark:{bg:'#0B140E',paper:'#14231A',field:'#0F1B13'}}},
    {name:'Monokrom',c:{accents:{g:'#E6E6E6',yel:'#F2F2F2',red:'#C9C9C9',blu:'#D6D6D6',pink:'#DEDEDE',orange:'#CFCFCF',mint:'#E0E0E0',violet:'#D2D2D2'},light:{bg:'#F4F4F4',paper:'#FFFFFF'},dark:{bg:'#0E0E0E',paper:'#1A1A1A',field:'#121212'}}}
  ];
  function renderPresets(){
    $('presets').replaceChildren(...PRESETS.map(p=>{
      const b=document.createElement('button');b.type='button';b.className='preset';
      const sw=['g','yel','red','blu'].map(k=>(p.c.accents[k]||ACC.find(a=>a[0]===k)[2]));
      b.innerHTML=`<i>${sw.map(c=>`<b style="background:${c}"></b>`).join('')}</i>${esc(p.name)}`;
      b.addEventListener('click',()=>{
        const blank=o=>Object.fromEntries(Object.keys(o).map(k=>[k,'']));
        draft.colors.accents=Object.assign(blank(draft.colors.accents),p.c.accents);
        draft.colors.light=Object.assign(blank(draft.colors.light),p.c.light);
        draft.colors.dark=Object.assign(blank(draft.colors.dark),p.c.dark);
        renderColors();changed();toast('Preset '+p.name,'Lihat hasilnya di preview, lalu simpan.');
      });
      return b;
    }));
  }
  document.querySelectorAll('[data-clear]').forEach(b=>b.addEventListener('click',()=>{const o=getPath(draft,b.dataset.clear);Object.keys(o).forEach(k=>o[k]='');renderColors();changed()}));

  /* ---------- nama elemen ---------- */
  const PROPS=[['text','Teks'],['placeholder','Placeholder'],['title','Tooltip (title)'],['value','Nilai isian awal'],['html','HTML'],['hide','Sembunyikan'],['style','Gaya CSS inline']];
  function renderRules(keepFocus){
    if(!draft)return;
    const tb=$('rulesTbl').tBodies[0];if(keepFocus&&tb.contains(document.activeElement))return;
    tb.replaceChildren();
    const opts=routeOptions(true,true);
    draft.texts.forEach((r,i)=>{
      const tr=document.createElement('tr');if(r.on===false)tr.className='off';
      tr.innerHTML=`<td><label class="switch"><input type="checkbox" data-k="on" ${r.on!==false?'checked':''}><span></span></label></td>
      <td><select data-k="route" aria-label="Halaman">${opts.map(([v,l])=>`<option value="${esc(v)}" ${v===(r.route||'*')?'selected':''}>${esc(l)}</option>`).join('')}</select></td>
      <td class="w-sel"><input class="mono" data-k="selector" value="${esc(r.selector)}" placeholder="#id atau .kelas" aria-label="Selector" spellcheck="false"></td>
      <td><select data-k="prop" aria-label="Jenis perubahan">${PROPS.map(([v,l])=>`<option value="${v}" ${v===(r.prop||'text')?'selected':''}>${l}</option>`).join('')}</select></td>
      <td class="w-val"><input data-k="value" value="${esc(r.value)}" ${r.prop==='hide'?'disabled placeholder="(disembunyikan)"':'placeholder="Teks baru"'} aria-label="Nilai baru"></td>
      <td><button type="button" class="x" aria-label="Hapus aturan">✕</button></td>`;
      tr.addEventListener('input',e=>{const k=e.target.dataset.k;if(!k)return;r[k]=k==='on'?e.target.checked:e.target.value;if(k==='on')tr.className=r.on===false?'off':'';if(k==='prop'){const vi=tr.querySelector('[data-k=value]');vi.disabled=r.prop==='hide';vi.placeholder=r.prop==='hide'?'(disembunyikan)':'Teks baru'}if(k==='selector')validateSel(e.target);changed()});
      tr.querySelector('.x').addEventListener('click',()=>{draft.texts.splice(i,1);renderRules();changed()});
      tb.append(tr);validateSel(tr.querySelector('[data-k=selector]'));
    });
    $('rulesEmpty').hidden=draft.texts.length>0;
  }
  function validateSel(inp){let ok=true;try{document.createDocumentFragment().querySelector(inp.value||'*')}catch(_){ok=false}inp.style.borderColor=ok?'':'var(--red)';inp.title=ok?'':'Selector CSS tidak valid'}
  $('btnAddRule').addEventListener('click',()=>{draft.texts.push({on:true,route:$('pvRoute').value||'*',selector:'',prop:'text',value:''});renderRules();changed();const ins=$('rulesTbl').querySelectorAll('[data-k=selector]');ins[ins.length-1].focus()});
  $('btnPick').addEventListener('click',()=>{
    if(!pvReady){toast('Preview belum siap','Tunggu preview selesai dimuat.',true);return}
    sendPv({type:'ca:pick',on:true});$('pvPick').hidden=false;
    try{$('pvFrame').focus()}catch(_){}
  });

  /* ---------- editor kode ---------- */
  let codeType='css';
  const SNIP={
    css:[
      ['Sembunyikan strip berita (Shell)','#stripNews{display:none!important}'],
      ['Perbesar ukuran teks','body{font-size:17px}'],
      ['Tombol berbentuk kapsul','.btn,.button{border-radius:99px!important}'],
      ['Muat font Poppins','@import url("https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap");'],
      ['Garis aksen di atas halaman','body{border-top:6px solid var(--g)}']
    ],
    js:[
      ['Sapaan sesuai jam','const h=new Date().getHours();\nCA.toast(h<11?"Selamat pagi":h<15?"Selamat siang":h<18?"Selamat sore":"Selamat malam","Semoga harimu lancar!");'],
      ['Catat halaman yang dibuka','console.log("[Custom] halaman dibuka:", CA.route || "shell");'],
      ['Tambah catatan di bawah halaman','const n=document.createElement("p");\nn.textContent="Catatan Admin: periksa ulang data sebelum ekspor.";\nn.style.cssText="margin:24px auto;max-width:900px;padding:10px 14px;border:3px dashed currentColor;border-radius:8px;font-weight:700";\n(document.querySelector(".page,.shell")||document.body).append(n);'],
      ['Isi otomatis jumlah klip (CSV Maker)','const c=document.getElementById("count");\nif(c){c.value="3";c.dispatchEvent(new Event("change"));}']
    ]
  };
  function codePath(){const t=$('codeTarget').value||'all';return t==='shell'||t==='all'?`${codeType}.${t}`:`${codeType}.pages.${t}`}
  function renderCode(){
    const area=$('codeArea');area.value=getPath(draft,codePath())||'';gutter();
    document.querySelectorAll('#codeType button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===codeType)));
    const t=$('codeTarget').value;
    $('codeHelp').textContent=codeType==='css'
      ?(t==='shell'?'CSS untuk header, login, dan screensaver. Berlaku setelah disimpan.':'CSS ini ditambahkan setelah gaya bawaan. Preview langsung berubah.')
      :(t==='shell'?'JS shell berjalan sekali saat login berikutnya. Objek CA = CAShell (toast, navigate, setTheme).':'JS berjalan saat halaman dimuat. Tersedia: CA (toast, navigate, route, config), config. Klik "Jalankan di preview" untuk mencoba.');
    $('snippetSel').innerHTML='<option value="">＋ Sisipkan contoh…</option>'+SNIP[codeType].map((s,i)=>`<option value="${i}">${esc(s[0])}</option>`).join('');
    checkJs();
  }
  function gutter(){const n=Math.max(1,$('codeArea').value.split('\n').length);$('codeGutter').textContent=Array.from({length:n},(_,i)=>i+1).join('\n');$('codeGutter').scrollTop=$('codeArea').scrollTop}
  function checkJs(){
    const err=$('codeErr');
    if(codeType!=='js'){err.hidden=true;return}
    try{new Function('CA','config',$('codeArea').value);err.hidden=true}catch(e){err.hidden=false;err.textContent='Sintaks: '+e.message}
  }
  $('codeArea').addEventListener('input',()=>{setPath(draft,codePath(),$('codeArea').value);gutter();checkJs();changed()});
  $('codeArea').addEventListener('scroll',()=>{$('codeGutter').scrollTop=$('codeArea').scrollTop});
  $('codeArea').addEventListener('keydown',e=>{if(e.key==='Tab'&&!e.shiftKey){e.preventDefault();const a=e.target,s=a.selectionStart;a.setRangeText('  ',s,a.selectionEnd,'end');a.dispatchEvent(new Event('input'))}});
  $('codeTarget').addEventListener('change',()=>{renderCode();const t=$('codeTarget').value;if(t!=='shell'&&t!=='all'){$('pvRoute').value=t;loadPreview()}});
  $('codeType').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;codeType=b.dataset.v;renderCode()});
  $('snippetSel').addEventListener('change',e=>{const s=SNIP[codeType][e.target.value];if(!s)return;const a=$('codeArea');a.value=(a.value.trim()?a.value.replace(/\s*$/,'\n\n'):'')+s[1]+'\n';a.dispatchEvent(new Event('input'));e.target.value=''});
  $('btnRunPreview').addEventListener('click',()=>{if(codeType==='js'&&!$('codeErr').hidden){toast('Perbaiki sintaks dulu',$('codeErr').textContent,true);return}loadPreview();toast('Preview dimuat ulang','Skrip draft dijalankan di preview.')});

  /* ---------- CSV ---------- */
  function renderCsv(){
    $('f-csv-pref').value=(draft.csv.prefixes||[]).join(', ');
    const c=$('f-csv-count');if(!c.options.length)for(let i=1;i<=10;i++)c.add(new Option(i+' klip',String(i)));
  }
  $('f-csv-pref').addEventListener('input',e=>{
    const list=e.target.value.split(/[,;\s]+/).map(s=>s.trim()).filter(Boolean);
    const ok=list.length&&list.every(p=>/^[A-Za-z0-9]{1,4}$/.test(p));
    e.target.style.borderColor=ok?'':'var(--red)';
    if(ok){draft.csv.prefixes=[...new Set(list)];changed()}
  });

  /* ---------- keamanan ---------- */
  function renderKeyState(){const s=$('keyState');s.textContent=meta.hasCustomKey?'Kunci kustom aktif':'Kunci bawaan';s.style.background=meta.hasCustomKey?'var(--yel)':''}
  $('keyForm').addEventListener('submit',e=>{
    e.preventDefault();const cur=$('k-cur').value,n=$('k-new').value,n2=$('k-new2').value,m=$('keyMsg');
    const bad=t=>{m.hidden=false;m.textContent=t;m.style.background='var(--danger-bg)';m.style.color='var(--danger)'};
    if(!cur)return bad('Isi private key saat ini.');
    if(n.length<8)return bad('Private key baru minimal 8 karakter.');
    if(n!==n2)return bad('Ulangan private key baru tidak sama.');
    post('ca:admin-key',{current:cur,next:n});
  });
  $('btnKeyReset').addEventListener('click',function(){const cur=$('k-cur').value;if(!cur){const m=$('keyMsg');m.hidden=false;m.textContent='Isi private key saat ini untuk mengembalikan kunci bawaan.';m.style.background='var(--danger-bg)';m.style.color='var(--danger)';return}confirmClick(this,()=>post('ca:admin-key',{current:cur,reset:true}))});

  /* ---------- log ---------- */
  const EV={login:'✓ Login',signout:'⏻ Sign out','login-fail':'✕ Login gagal',lockout:'⛔ Form dikunci',unlock:'🔓 Buka kunci','unlock-fail':'✕ Buka kunci gagal','config-save':'✎ Simpan konfigurasi','config-reset':'↺ Reset konfigurasi','config-restore':'⟲ Pulihkan versi','key-change':'⚿ Ganti kunci','key-change-fail':'✕ Ganti kunci gagal','log-clear':'🧹 Log dibersihkan'};
  const BAD=['login-fail','lockout','unlock-fail','key-change-fail'];
  function filteredLogs(){
    const f=$('logFilter').value;
    return meta.logs.filter(l=>!f||(f==='fail'&&BAD.includes(l.ev))||(f==='login'&&/^(login|signout|unlock)/.test(l.ev)&&!BAD.includes(l.ev))||(f==='config'&&/^(config|key|log)/.test(l.ev)));
  }
  function renderLogs(){
    const tb=$('logTbl').tBodies[0];
    const rows=filteredLogs();
    tb.innerHTML=rows.length?rows.map(l=>`<tr class="${BAD.includes(l.ev)?'bad':l.ev==='login'?'good':''}"><td>${esc(new Date(l.t).toLocaleString('id-ID',{dateStyle:'short',timeStyle:'medium'}))}</td><td>${esc(EV[l.ev]||l.ev)}</td><td>${esc(String(l.role).toUpperCase())}</td><td>${esc(l.detail)}</td></tr>`).join(''):'<tr><td colspan="4" class="empty">Belum ada catatan.</td></tr>';
    const g=meta.guard||{},parts=[];
    ['user','admin'].forEach(r=>{const x=g[r]||{};const locked=x.lockUntil>Date.now();parts.push(`<span class="${x.fails||locked?'warn':''}">${r.toUpperCase()} · salah beruntun ${x.fails||0} · total ${x.total||0}${locked?' · DIKUNCI':''}</span>`)});
    $('guardRow').innerHTML=parts.join('');
  }
  $('logFilter').addEventListener('change',renderLogs);
  $('btnLogRefresh').addEventListener('click',()=>post('ca:logs-get'));
  $('btnLogClear').addEventListener('click',function(){confirmClick(this,()=>post('ca:logs-clear'))});
  $('btnGuardReset').addEventListener('click',()=>{post('ca:guard-reset');toast('Form dibuka','Penguncian login User & Admin direset.')});
  $('btnLogCsv').addEventListener('click',()=>{
    const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
    const csv=['Waktu,Peristiwa,Peran,Keterangan',...filteredLogs().map(l=>[new Date(l.t).toISOString(),EV[l.ev]||l.ev,l.role,l.detail].map(q).join(','))].join('\r\n');
    download('log-aktivitas-'+new Date().toISOString().slice(0,10)+'.csv',csv,'text/csv');
  });

  /* ---------- cadangan ---------- */
  function download(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:type+';charset=utf-8'}));a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500);toast('Unduhan dimulai',name)}
  $('btnSiteFile').addEventListener('click',()=>{if(isDirty())toast('Perhatian','Ada perubahan belum disimpan — file berisi versi tersimpan.',true);post('ca:site-file')});
  $('btnExportJson').addEventListener('click',()=>download('content-analyst-config-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(saved,null,2),'application/json'));
  $('importFile').addEventListener('change',async e=>{
    const f=e.target.files[0];e.target.value='';if(!f)return;
    try{
      let txt=await f.text();
      const m=/CA_SITE_CONFIG\s*=\s*([\s\S]*?);?\s*$/.exec(txt);if(m)txt=m[1];
      const obj=JSON.parse(txt);
      if(!obj||typeof obj!=='object'||!obj.routes&&!obj.brand&&!obj.colors)throw new Error('Bukan file konfigurasi Content Analyst.');
      delete obj.security?.adminKey;
      draft=deepMerge(clone(saved),obj);renderAll();changed();
      toast('Konfigurasi diimpor','Periksa preview, lalu klik Simpan & terapkan.');
    }catch(err){toast('Impor gagal',err.message,true)}
  });
  function deepMerge(a,b){Object.keys(b).forEach(k=>{if(b[k]&&typeof b[k]==='object'&&!Array.isArray(b[k])&&a[k]&&typeof a[k]==='object')deepMerge(a[k],b[k]);else a[k]=b[k]});return a}
  function renderHistory(){
    const ul=$('histList');
    ul.innerHTML=meta.history.length?'':'<li class="empty">Belum ada versi cadangan. Versi dibuat otomatis setiap kali Anda menyimpan.</li>';
    meta.history.forEach((h,i)=>{const li=document.createElement('li');li.innerHTML=`<span>${esc(new Date(h.t).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'medium'}))} · ${esc(h.by)}</span>`;const b=document.createElement('button');b.type='button';b.className='btn sm';b.textContent='⟲ Pulihkan';b.addEventListener('click',()=>confirmClick(b,()=>post('ca:history-restore',{index:i})));li.append(b);ul.append(li)});
  }
  $('btnResetAll').addEventListener('click',function(){confirmClick(this,()=>post('ca:config-reset'))});
  $('btnLockNow').addEventListener('click',()=>post('ca:lock'));
  $('btnReloadPages').addEventListener('click',()=>{post('ca:reload-pages');toast('Halaman dimuat ulang','Semua menu memuat ulang dengan konfigurasi tersimpan.')});

  /* ---------- ringkasan & statistik ---------- */
  function fails24(){const since=Date.now()-864e5;return meta.logs.filter(l=>l.t>since&&BAD.includes(l.ev)).length}
  function renderStats(){
    if(!draft)return;
    const vis=draft.routes.filter(r=>r.visible!==false).length,rules=draft.texts.filter(r=>r.on!==false).length,f=fails24();
    $('admStats').innerHTML=[[vis+'/'+draft.routes.length,'Menu tampil untuk User'],[rules,'Aturan nama elemen'],[f,'Percobaan gagal 24 jam'],[meta.history.length,'Versi cadangan']].map(([b,s])=>`<div><b>${esc(b)}</b><small>${esc(s)}</small></div>`).join('');
    const en=Object.keys(draft.csv.modes).filter(k=>draft.csv.modes[k]).length;
    $('ovGrid').innerHTML=[
      [meta.session?new Date(meta.session.at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}):'-','Login Admin sejak'],
      [meta.hasCustomKey?'Kustom':'Bawaan','Private key'],
      [draft.session.idleSec+' dtk','Screensaver idle'],
      [(draft.session.userSignoutMin||'∞')+' / '+(draft.session.adminSignoutMin||'∞')+' mnt','Sign out User / Admin'],
      [en+' mode · '+(draft.csv.prefixes||[]).join(','),'CSV Maker'],
      [draft.announcement.enabled&&draft.announcement.text?'Aktif':'Mati','Pengumuman'],
      [f,'Percobaan gagal 24 jam',f>0],
      [isDirty()?'Belum disimpan':'Tersimpan','Status draft',isDirty()]
    ].map(([b,s,w])=>`<div class="${w?'warn':''}"><b>${esc(b)}</b><small>${esc(s)}</small></div>`).join('');
    $('admSession').textContent='Sesi Admin aktif'+(meta.session?' · sejak '+new Date(meta.session.at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}):'');
  }
  const RECS=[
    [1,'Gerbang login 2 peran','User memakai tanggal hari ini; Admin memakai private key yang disimpan sebagai hash SHA-256 bergaram (4096 putaran), bukan teks.'],
    [1,'Peringatan & penguncian','Setiap salah input memberi peringatan, sisa percobaan, getar kartu; form dikunci sementara setelah batas tercapai. Peringatan muncul juga setelah login berikutnya.'],
    [1,'Screensaver + kunci sesi + sign out otomatis','Hitung mundur sign out terlihat di screensaver; sesi Admin bisa dikunci dan hanya dibuka dengan private key. Alt+L untuk kunci manual.'],
    [1,'Sesi User berakhir saat tanggal berganti','Mencegah sesi semalaman tetap terbuka dengan "tanggal kemarin".'],
    [1,'Preview draft + pemilih elemen','Ubah nama elemen cukup dengan mengklik elemen di preview; perubahan dicoba dulu sebelum diterapkan.'],
    [1,'Riwayat versi, ekspor/impor, rilis site-config.js','15 versi cadangan otomatis; konfigurasi bisa dipindah ke komputer lain.'],
    [1,'Log aktivitas + ekspor CSV','Login, gagal login, buka kunci, sign out, dan perubahan konfigurasi tercatat.'],
    [1,'CSV Maker adaptif','Awalan UID, mode aktif, mode pembuka, jumlah klip & timecode awal diatur Admin; isi form tersimpan otomatis sebagai draft.'],
    [1,'Pengumuman & menu dinamis','Pengumuman untuk semua User; menu bisa diurutkan, disembunyikan, diganti nama/ikon/warna.'],
    [0,'Sinkron konfigurasi lewat Google Sheets / Apps Script','Konfigurasi dibaca dari URL bersama agar perubahan Admin langsung sampai ke semua komputer tanpa menyalin file.'],
    [0,'Autentikasi sisi server','Bila dipublikasikan di web, tambahkan Basic Auth / SSO di web server — gerbang di file statis hanya penghalang sisi-klien.'],
    [0,'Peran tambahan (Supervisor)','Hak akses per menu, mis. Supervisor bisa mengubah pengumuman saja.'],
    [0,'Mode offline (Service Worker)','Cache halaman, font, dan template agar tetap jalan saat internet putus.']
  ];
  $('recs').innerHTML=RECS.map(([d,t,s])=>`<li class="${d?'':'todo'}"><i>${d?'✓':'•'}</i><span><b>${esc(t)}</b> — ${esc(s)}</span></li>`).join('');


  /* ---------- Scene Deck ---------- */
  const SCENE_BASE=['Signage Billboard','Signage Building Wrap','Signage Vehicle Wrap','Signage Store Front','Signage Poster','Signage Trailer','Signage Table Talker','Product Placement','Calendar Placement','Book Placement','TVC Placement','Screen Replacement'];
  function sceneCfg(){if(!draft.scene)draft.scene={extraTypes:[],hiddenTypes:[],defaultType:''};return draft.scene}
  function sceneAvailable(){const sc=sceneCfg(),hid=new Set(sc.hiddenTypes||[]);return [...new Set(SCENE_BASE.filter(t=>!hid.has(t)).concat(sc.extraTypes||[]))].concat(['KEY LOGO'])}
  function renderSceneDefault(){const sel=$('f-sc-def'),sc=sceneCfg(),av=sceneAvailable();if(sc.defaultType&&!av.includes(sc.defaultType))sc.defaultType='';sel.innerHTML='<option value="">(otomatis · jenis pertama)</option>'+av.map(t=>`<option value="${esc(t)}" ${t===sc.defaultType?'selected':''}>${esc(t)}</option>`).join('')}
  function renderScene(){
    const sc=sceneCfg(),hid=new Set(sc.hiddenTypes||[]);
    $('sceneTypes').innerHTML=SCENE_BASE.map(t=>`<label class="switch"><input type="checkbox" data-etype="${esc(t)}" ${hid.has(t)?'':'checked'}><span></span>${esc(t)}</label>`).join('')+'<label class="switch"><input type="checkbox" checked disabled><span></span>KEY LOGO (khusus)</label>';
    if(document.activeElement!==$('f-sc-extra'))$('f-sc-extra').value=(sc.extraTypes||[]).join('\n');
    renderSceneDefault();
  }
  $('sceneTypes').addEventListener('change',e=>{const t=e.target.dataset.etype;if(!t)return;const sc=sceneCfg(),hid=new Set(sc.hiddenTypes||[]);if(e.target.checked)hid.delete(t);else hid.add(t);if(hid.size>=SCENE_BASE.length&&!(sc.extraTypes||[]).length){hid.delete(t);e.target.checked=true;toast('Minimal satu jenis','Sisakan setidaknya satu Embed Type selain KEY LOGO.',true);return}sc.hiddenTypes=[...hid];renderSceneDefault();changed()});
  $('f-sc-extra').addEventListener('input',e=>{const sc=sceneCfg();sc.extraTypes=[...new Set(e.target.value.split('\n').map(x=>x.trim()).filter(x=>x&&x.length<=40&&x.toUpperCase()!=='KEY LOGO'))].slice(0,30);renderSceneDefault();changed()});
  $('f-sc-def').addEventListener('change',e=>{sceneCfg().defaultType=e.target.value;changed()});
  $('btnSaverDemo').addEventListener('click',()=>post('ca:saver-demo',{anim:draft.saver.anim}));

  /* ---------- data penggunaan & saran adaptif ---------- */
  CA.on('ca:usage',d=>{usage=d.usage;renderInsights()});
  const fmtDur=ms=>{const m=Math.round((ms||0)/60000);return m<1?'<1 mnt':m<60?m+' mnt':(m/60).toFixed(1)+' jam'};
  const EVN={'csv-w':'CSV versi W','csv-r':'CSV versi R','csv-copy':'Salin sheet CSV','pptx':'PPTX Scene Deck'};
  function evName(k){if(EVN[k])return EVN[k];const m=/^act-(.+)$/.exec(k);if(m){const r=draft.routes.find(x=>x.id===m[1]);return 'Aksi '+(r?r.label:m[1])}return k}
  function routeRows(role){
    return draft.routes.map(r=>{const g=(usage&&usage.routes[r.id])||{opens:0,ms:0,last:0};const opens=role?(((usage&&usage.roles[role])||{})[r.id]||0):g.opens;return {r,opens,ms:g.ms,last:g.last}});
  }
  function renderInsights(){
    if(!draft)return;
    const u=usage||{routes:{},days:{},events:{},roles:{}};
    const role=$('usageRole').value,rows=routeRows(role);
    const max=Math.max(1,...rows.map(x=>x.opens)),maxMs=Math.max(1,...rows.map(x=>x.ms));
    $('usageBars').innerHTML=rows.map(x=>`<div class="ubar" title="${esc(x.r.title)}${x.last?' · terakhir '+new Date(x.last).toLocaleString('id-ID'):''}"><b>${esc(x.r.icon+' '+x.r.label)}</b><span class="track2"><i style="width:${(x.opens/max*100).toFixed(1)}%;--c:${esc(x.r.color)}"></i><s style="width:${(x.ms/maxMs*100).toFixed(1)}%"></s></span><small>${x.opens}× · ${fmtDur(x.ms)}</small></div>`).join('');
    const days=[];for(let i=13;i>=0;i--){const d=new Date(Date.now()-i*864e5);const k=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');const o=u.days[k]||{};days.push([d,Object.keys(o).filter(x=>!x.startsWith('ev:')&&x!=='admin').reduce((a,x)=>a+o[x],0)])}
    const dm=Math.max(1,...days.map(x=>x[1]));
    $('usageDays').innerHTML=days.map(([d,n])=>`<div title="${d.toLocaleDateString('id-ID')} · ${n} kali menu dibuka"><i style="height:${Math.max(2,n/dm*80)}%"></i><small>${d.getDate()}</small></div>`).join('');
    const ev=Object.entries(u.events||{}).sort((a,b)=>b[1]-a[1]);
    $('usageEvents').innerHTML=ev.length?ev.map(([k,n])=>`<span>${esc(evName(k))}<b>${n}</b></span>`).join(''):'<span class="muted small">Belum ada ekspor/aksi tercatat.</span>';
    $('usageSince').textContent=u.since?'Data sejak '+new Date(u.since).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'})+' · batang tebal = jumlah dibuka, garis tipis = waktu pakai. Tersimpan hanya di browser ini.':'';
    renderAdvice(u);
  }
  function renderAdvice(u){
    const list=[],userRows=routeRows(usage&&usage.roles&&usage.roles.user?'user':'').filter(x=>x.r.id!=='admin');
    const total=userRows.reduce((a,x)=>a+x.opens,0);
    const add=(cls,icon,html,label,fn)=>list.push({cls,icon,html,label,fn});
    if(total<5)add('','i',`<b>Data masih sedikit</b> — ${total} kali menu dibuka. Saran makin akurat setelah program dipakai beberapa hari.`);
    const ranked=userRows.slice().sort((a,b)=>b.opens-a.opens);
    const top=ranked[0];
    if(top&&top.opens>=3&&top.r.visible!==false&&draft.defaultRoute!==top.r.id)add('','★',`Menu paling sering dibuka: <b>${esc(top.r.label)}</b> (${top.opens}×). Jadikan menu pembuka User agar langsung siap dipakai.`,'Jadikan menu pembuka',()=>{draft.defaultRoute=top.r.id;fillBound();renderRouteSelects()});
    const order=draft.routes.map(r=>r.id).join('|'),byUse=draft.routes.slice().sort((a,b)=>{const oa=(userRows.find(x=>x.r.id===a.id)||{}).opens||0,ob=(userRows.find(x=>x.r.id===b.id)||{}).opens||0;return ob-oa}).map(r=>r.id).join('|');
    if(total>=10&&order!==byUse)add('','⇅','Urutan tab belum mengikuti pola pemakaian. Menu yang paling sering dipakai sebaiknya di depan (Alt+1, Alt+2, …).','Urutkan sesuai pemakaian',()=>{const op=id=>((userRows.find(x=>x.r.id===id)||{}).opens||0);draft.routes.sort((a,b)=>op(b.id)-op(a.id));renderRoutes()});
    if(total>=20)userRows.filter(x=>x.opens===0&&x.r.visible!==false).forEach(x=>add('','⊘',`<b>${esc(x.r.label)}</b> belum pernah dibuka User. Sembunyikan agar menu lebih ringkas?`,'Sembunyikan',()=>{if(draft.routes.filter(r=>r.visible!==false).length<=1)return;x.r.visible=false;renderRoutes()}));
    const since=Date.now()-864e5,fails=meta.logs.filter(l=>l.t>since&&/fail|lockout/.test(l.ev)).length;
    if(fails>=3&&draft.security.lockSec<120)add('warn','!',`<b>${fails} percobaan gagal</b> dalam 24 jam. Perpanjang penguncian form menjadi 120 detik.`,'Terapkan 120 dtk',()=>{draft.security.lockSec=120;fillBound()});
    const idleOut=meta.logs.filter(l=>l.t>Date.now()-7*864e5&&l.ev==='signout'&&/tidak ada aktivitas/.test(l.detail)&&l.role==='user').length;
    if(idleOut>=3&&draft.session.userSignoutMin&&draft.session.userSignoutMin<60)add('','⏱',`User ter-sign out otomatis <b>${idleOut}×</b> dalam 7 hari. Perpanjang batas menjadi ${draft.session.userSignoutMin+15} menit?`,'Perpanjang',()=>{draft.session.userSignoutMin+=15;fillBound()});
    const ev=u.events||{},csvN=(ev['csv-w']||0)+(ev['csv-r']||0),pp=ev.pptx||0;
    if(csvN>=10)add('','▦',`CSV Maker dipakai intensif (<b>${csvN} ekspor</b>). Prioritaskan "Impor massal & ekspor batch ZIP".`,'Lihat rekomendasi',()=>{rmMenu='csv';renderRoadmap()});
    if(pp>=5)add('','▶',`<b>${pp} PPTX</b> dibuat dari Scene Deck. Prioritaskan "Impor scene dari spreadsheet" & "Validasi silang TCR".`,'Lihat rekomendasi',()=>{rmMenu='scene';renderRoadmap()});
    if((ev['csv-r']||0)>0&&!(ev['csv-w']))add('','R','Hanya CSV versi R yang diekspor. Pertimbangkan menjadikan Advance mode pembuka bila UID selalu berakhiran angka.','Ke pengaturan CSV',()=>showSection('csv'));
    if(!list.some(x=>x.fn)&&total>=5)add('ok','✓','Pengaturan sudah selaras dengan pola pemakaian saat ini.');
    const ul=$('insightList');ul.replaceChildren();
    list.forEach(x=>{const li=document.createElement('li');li.className=x.cls;li.innerHTML=`<i>${esc(x.icon)}</i><span>${x.html}</span>`;if(x.fn){const b=document.createElement('button');b.type='button';b.className='btn sm primary';b.textContent=x.label;b.addEventListener('click',()=>{x.fn();changed();renderInsights();toast('Diterapkan ke draft','Periksa preview lalu klik Simpan & terapkan.')});li.append(b)}else li.append(document.createElement('span'));ul.append(li)});
  }
  $('usageRole').addEventListener('change',renderInsights);
  $('btnUsageRefresh').addEventListener('click',()=>post('ca:usage-get'));
  $('btnUsageReset').addEventListener('click',function(){confirmClick(this,()=>post('ca:usage-reset'))});
  $('btnUsageCsv').addEventListener('click',()=>{
    const u=usage||{routes:{},days:{}},q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
    const lines=['Tanggal,Menu,Dibuka'];Object.keys(u.days).sort().forEach(d=>Object.entries(u.days[d]).forEach(([k,n])=>lines.push([d,k.startsWith('ev:')?evName(k.slice(3)):((draft.routes.find(r=>r.id===k)||{}).label||k),n].map(q).join(','))));
    lines.push('','Menu,Total dibuka,Total menit');draft.routes.forEach(r=>{const g=u.routes[r.id]||{};lines.push([r.label,g.opens||0,Math.round((g.ms||0)/60000)].map(q).join(','))});
    download('penggunaan-menu-'+new Date().toISOString().slice(0,10)+'.csv',lines.join('\r\n'),'text/csv');
  });

  /* ---------- roadmap rekomendasi per menu ---------- */
  const RM=window.CA_ROADMAP||[],RMK='ca-admin-roadmap',ST=[['idea','Usulan'],['plan','Direncanakan'],['doing','Dikerjakan'],['done','Selesai'],['skip','Tidak dipakai']];
  let rmMenu='';
  function rmState(){try{return JSON.parse(localStorage.getItem(RMK))||{}}catch(_){return {}}}
  function rmSave(o){try{localStorage.setItem(RMK,JSON.stringify(o))}catch(_){}}
  function menuName(id){if(id==='*')return 'Lintas menu';if(id==='admin')return 'Admin';const r=draft&&draft.routes.find(x=>x.id===id);return r?r.label:id}
  function menuColor(id){if(id==='*')return 'var(--violet)';if(id==='admin')return 'var(--red)';const r=draft&&draft.routes.find(x=>x.id===id);return r?r.color:'var(--paper-2)'}
  function renderRoadmap(){
    if(!draft)return;
    const st=rmState(),menus=['','*'].concat(draft.routes.map(r=>r.id).filter(id=>RM.some(x=>x.menu===id)),['admin']);
    $('rmFilter').innerHTML=menus.map(m=>`<button type="button" role="tab" data-m="${esc(m)}" aria-selected="${m===rmMenu}">${esc(m===''?'Semua':menuName(m))} · ${RM.filter(x=>!m||x.menu===m).length}</button>`).join('');
    const items=RM.filter(x=>!rmMenu||x.menu===rmMenu).slice().sort((a,b)=>({Tinggi:0,Sedang:1,Rendah:2}[a.prio]-{Tinggi:0,Sedang:1,Rendah:2}[b.prio]));
    const cnt={};RM.forEach(x=>{const s=(st[x.id]||{}).status||'idea';cnt[s]=(cnt[s]||0)+1});
    $('rmSum').innerHTML=ST.map(([k,l])=>`<span>${esc(l)}: ${cnt[k]||0}</span>`).join('');
    $('rmList').innerHTML=items.map(x=>{const s=st[x.id]||{};return `<article class="rm" data-id="${esc(x.id)}" data-status="${esc(s.status||'idea')}">
      <div class="rm-top"><h4>${esc(x.title)}</h4><span class="rm-tag" style="--tc:${esc(menuColor(x.menu))}">${esc(menuName(x.menu))}</span><span class="rm-tag p-${esc(x.prio)}">Prioritas ${esc(x.prio)}</span><span class="rm-tag">Ukuran ${esc(x.size)}</span></div>
      <p>${esc(x.desc)}</p><div class="flow2">${esc(x.flow)}</div><ul>${x.steps.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>
      <div class="rm-ctl"><select data-k="status" aria-label="Status">${ST.map(([k,l])=>`<option value="${k}" ${k===(s.status||'idea')?'selected':''}>${l}</option>`).join('')}</select><input data-k="note" value="${esc(s.note||'')}" maxlength="200" placeholder="Catatan / PIC / target tanggal"></div></article>`}).join('');
  }
  $('rmFilter').addEventListener('click',e=>{const b=e.target.closest('[data-m]');if(!b)return;rmMenu=b.dataset.m;renderRoadmap()});
  $('rmList').addEventListener('change',e=>{const card=e.target.closest('.rm'),k=e.target.dataset.k;if(!card||!k)return;const st=rmState();st[card.dataset.id]=Object.assign(st[card.dataset.id]||{},{[k]:e.target.value,t:Date.now()});rmSave(st);if(k==='status'){card.dataset.status=e.target.value;renderRoadmapSum()}});
  function renderRoadmapSum(){const st=rmState(),cnt={};RM.forEach(x=>{const s=(st[x.id]||{}).status||'idea';cnt[s]=(cnt[s]||0)+1});$('rmSum').innerHTML=ST.map(([k,l])=>`<span>${esc(l)}: ${cnt[k]||0}</span>`).join('')}
  $('btnRoadmapCsv').addEventListener('click',()=>{const st=rmState(),q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';download('roadmap-rekomendasi-'+new Date().toISOString().slice(0,10)+'.csv',['Menu,Judul,Prioritas,Ukuran,Status,Catatan,Alur data',...RM.map(x=>{const s=st[x.id]||{};return [menuName(x.menu),x.title,x.prio,x.size,(ST.find(y=>y[0]===(s.status||'idea'))||[])[1],s.note||'',x.flow].map(q).join(',')})].join('\r\n'),'text/csv')});

  function renderAll(){
    fillBound();renderRoutes();renderColors();renderScene();renderInsights();renderRoadmap();renderPresets();renderRules();renderCode();renderCsv();renderKeyState();renderLogs();renderHistory();renderStats();updateSaveBar();
  }

  /* ---------- preview ---------- */
  let pvReady=false,pvTimer=null,pvTheme=CA.theme();
  function pvRouteSaved(){try{return localStorage.getItem('ca-admin-pv')||'csv'}catch(_){return 'csv'}}
  function sendPv(msg){const w=$('pvFrame').contentWindow;if(w)try{w.postMessage(msg,'*')}catch(_){}}
  function draftForPreview(){return draft}
  function loadPreview(){
    if(!draft)return;
    const id=$('pvRoute').value||'csv',r=draft.routes.find(x=>x.id===id)||draft.routes[0];
    try{localStorage.setItem('ca-admin-pv',r.id)}catch(_){}
    pvReady=false;$('pvPick').hidden=true;
    $('pvFrame').src='../'+r.file+'?embed=1&preview=1&theme='+pvTheme+'&t='+Date.now();
  }
  function schedulePreview(){clearTimeout(pvTimer);pvTimer=setTimeout(()=>{if(pvReady)sendPv({type:'ca:config',config:draftForPreview()})},180)}
  function setPvTheme(t){pvTheme=t;document.querySelectorAll('#pvTheme button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===t)));sendPv({type:'ca:theme',theme:t})}
  $('pvTheme').addEventListener('click',e=>{const b=e.target.closest('button');if(b)setPvTheme(b.dataset.v)});
  setPvTheme(pvTheme);
  $('pvRoute').addEventListener('change',loadPreview);
  $('pvReload').addEventListener('click',loadPreview);
  $('pvToggle').addEventListener('click',()=>document.querySelector('.adm-layout').classList.toggle('pv-big'));
  $('pvFrame').addEventListener('load',()=>{pvReady=true;sendPv({type:'ca:theme',theme:pvTheme});sendPv({type:'ca:config',config:draftForPreview()})});
  window.addEventListener('message',e=>{
    if(e.source!==$('pvFrame').contentWindow)return;
    const d=e.data;if(!d||typeof d.type!=='string')return;
    switch(d.type){
      case 'ca:ready':pvReady=true;sendPv({type:'ca:theme',theme:pvTheme});sendPv({type:'ca:config',config:draftForPreview()});break;
      case 'ca:activity':post('ca:activity');break;
      case 'ca:key':if(d.code==='KeyT')setPvTheme(pvTheme==='dark'?'light':'dark');else post('ca:key',{code:d.code});break;
      case 'ca:toast':toast('Preview · '+(d.title||''),d.text||'');break;
      case 'ca:navigate':if(draft.routes.some(r=>r.id===d.to)){$('pvRoute').value=d.to;loadPreview()}break;
      case 'ca:script-error':toast('Skrip error di preview · '+(d.label||''),d.message||'',true);if(codeType==='js'){const er=$('codeErr');er.hidden=false;er.textContent='Runtime: '+d.message}break;
      case 'ca:picked':
        $('pvPick').hidden=true;
        if(d.cancel)break;
        const isField=/^(input|textarea)$/.test(d.tag);
        const rule={on:true,route:$('pvRoute').value,selector:d.selector,prop:isField?'placeholder':'text',value:isField?(d.placeholder||''):(d.text||'')};
        draft.texts.push(rule);showSection('elements');renderRules();changed();
        const ins=$('rulesTbl').querySelectorAll('[data-k=value]');const last=ins[ins.length-1];if(last){last.focus();last.select()}
        toast('Elemen dipilih',d.selector+(d.hasChildren&&!isField?' · elemen ini berisi elemen lain; mengganti teks akan menimpa isinya':''),!!(d.hasChildren&&!isField));
        break;
    }
  });
  CA.onTheme(t=>{if(!pvReady)return});
})();
