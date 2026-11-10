/* ==========================================================================
   embed.js — penghubung setiap halaman (di dalam iframe) dengan shell index.html
   - Menerapkan tema lebih awal (tanpa kedip) dan menerima perubahan tema.
   - Menerapkan konfigurasi Admin: warna, CSS, skrip kustom, nama/teks elemen.
   - Mengirim sinyal aktivitas ke shell agar screensaver idle & sign-out tersinkron.
   - Meneruskan pintasan Alt+1..9 ke shell.
   - Mode "pilih elemen" untuk Konsol Admin (klik elemen → selector).
   - Jika halaman dibuka langsung (tanpa shell), dialihkan ke index.html (login).
   Bekerja juga saat dibuka via file:// karena memakai postMessage.
   Memerlukan js/core/apply.js dimuat sebelum file ini.
   ========================================================================== */
(function(){
  'use strict';
  var root=document.documentElement;
  var params=new URLSearchParams(location.search);
  var embedded=false;
  try{embedded=window.top!==window.self}catch(_){embedded=true}
  var A=window.CAApply;

  function readStoredTheme(){try{return localStorage.getItem('ca-theme')}catch(_){return null}}
  function systemTheme(){try{return matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch(_){return 'dark'}}
  var listeners={theme:[],message:{},config:[]};
  function setTheme(theme){
    theme=theme==='light'?'light':'dark';
    root.dataset.theme=theme;
    try{localStorage.setItem('ca-theme',theme)}catch(_){}
    listeners.theme.forEach(function(fn){try{fn(theme)}catch(e){console.error(e)}});
  }
  setTheme(params.get('theme')||readStoredTheme()||systemTheme());

  /* Halaman dibuka sendiri → arahkan ke shell (login) agar header, menu & hak akses tetap berlaku. */
  var route=root.dataset.route||'';
  if(!embedded&&route&&params.get('standalone')!=='1'){
    var noop=function(){};
    window.CA={embedded:false,route:route,theme:function(){return root.dataset.theme},onTheme:noop,on:noop,navigate:noop,toast:noop,keepAwake:noop,post:noop,config:function(){return null},onConfig:noop};
    location.replace('../index.html#'+route);
    return;
  }
  root.classList.toggle('is-embedded',embedded);

  function post(type,payload){
    if(!embedded)return;
    try{window.parent.postMessage(Object.assign({type:type,route:route},payload||{}),'*')}catch(_){}
  }

  /* ---------- konfigurasi Admin ---------- */
  var cfg=null,domReady=false,scriptsRan=false,texts=null;
  /* preview Admin (?preview=1) menunggu draft dari konsol, bukan konfigurasi tersimpan */
  if(params.get('preview')!=='1'){try{cfg=JSON.parse(localStorage.getItem('ca-config-cache'))}catch(_){cfg=null}}
  function applyConfig(){
    if(!cfg||!A)return;
    A.setStyle(document,'ca-config-style',A.pageCss(cfg,route));
    if(domReady){
      if(!texts)texts=new A.TextOverrides(document,route);
      texts.set(cfg.texts||[]);
      runScripts();
    }
  }
  function runScripts(){
    if(scriptsRan||!domReady||!cfg||!cfg.js||params.get('noscript')==='1')return;
    scriptsRan=true;
    var ctx={CA:window.CA,config:cfg};
    var report=function(label){return function(e){post('ca:script-error',{label:label,message:String(e&&e.message||e)})}};
    A.runScript(cfg.js.all,'semua-halaman',ctx,report('Semua halaman'));
    if(cfg.js.pages&&cfg.js.pages[route])A.runScript(cfg.js.pages[route],route,ctx,report('Halaman '+route));
  }
  if(cfg&&A)A.setStyle(document,'ca-config-style',A.pageCss(cfg,route));

  window.addEventListener('message',function(e){
    if(e.source!==window.parent)return;
    var d=e.data;if(!d||typeof d.type!=='string'||d.type.indexOf('ca:')!==0)return;
    if(d.type==='ca:theme')setTheme(d.theme);
    if(d.type==='ca:config'&&d.config){
      cfg=d.config;applyConfig();
      listeners.config.forEach(function(fn){try{fn(cfg)}catch(err){console.error(err)}});
    }
    if(d.type==='ca:pick')picker(!!d.on);
    var hs=listeners.message[d.type];if(hs)hs.forEach(function(fn){try{fn(d)}catch(err){console.error(err)}});
  });

  /* aktivitas → shell (dibatasi 1x per 800 ms) */
  var last=0;
  function activity(){var now=Date.now();if(now-last<800)return;last=now;post('ca:activity')}
  ['pointermove','pointerdown','keydown','wheel','touchstart','input','scroll'].forEach(function(ev){window.addEventListener(ev,activity,{passive:true,capture:true})});

  /* pintasan Alt+angka, Alt+T (tema), Alt+L (kunci/screensaver) diteruskan ke shell */
  window.addEventListener('keydown',function(e){
    if(!e.altKey||e.ctrlKey||e.metaKey)return;
    if(/^Digit[1-9]$/.test(e.code)||e.code==='KeyT'||e.code==='KeyL'){e.preventDefault();post('ca:key',{code:e.code})}
  });

  /* keep-awake: mencegah screensaver saat proses panjang (OCR, ekspor PPTX) */
  var awakeTimer=null;
  function keepAwake(on){
    clearInterval(awakeTimer);awakeTimer=null;
    if(on){post('ca:activity');awakeTimer=setInterval(function(){post('ca:activity')},4000)}
  }

  /* ---------- mode pilih elemen (Konsol Admin) ---------- */
  var pick={on:false,box:null,tip:null,cur:null};
  function cssPath(el){
    var esc=window.CSS&&CSS.escape?CSS.escape:function(s){return String(s).replace(/[^a-zA-Z0-9_-]/g,'\\$&')};
    function unique(sel){try{return document.querySelectorAll(sel).length===1}catch(_){return false}}
    if(el.id&&unique('#'+esc(el.id)))return '#'+esc(el.id);
    var parts=[],node=el;
    while(node&&node.nodeType===1&&node!==document.body&&node!==root){
      var sel=node.tagName.toLowerCase();
      if(node.id&&unique('#'+esc(node.id))){parts.unshift('#'+esc(node.id));break}
      var cls=Array.prototype.filter.call(node.classList,function(c){return !/^(is-|show$|active$|on$|hidden$|bad$|ok$|err$)/.test(c)}).slice(0,2);
      if(cls.length)sel+='.'+cls.map(esc).join('.');
      var p=node.parentElement;
      if(p){var sib=Array.prototype.filter.call(p.children,function(c){return c.tagName===node.tagName});if(sib.length>1)sel+=':nth-of-type('+(sib.indexOf(node)+1)+')'}
      parts.unshift(sel);
      var s=parts.join(' > ');if(unique(s)&&parts.length>1)return s;
      node=p;
    }
    var out=parts.join(' > ');
    if(!/^#/.test(out))out='body > '+out;
    return out;
  }
  function pickMove(e){
    var el=e.target;if(!el||el===pick.box||el===pick.tip)return;
    pick.cur=el;var r=el.getBoundingClientRect();
    Object.assign(pick.box.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});
    pick.tip.textContent=el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+' · klik untuk memilih · Esc batal';
    pick.tip.style.left=Math.max(4,r.left)+'px';pick.tip.style.top=(r.top>26?r.top-24:r.bottom+4)+'px';
  }
  function pickClick(e){
    e.preventDefault();e.stopPropagation();
    var el=pick.cur||e.target;
    post('ca:picked',{selector:cssPath(el),tag:el.tagName.toLowerCase(),text:(el.textContent||'').trim().slice(0,300),placeholder:el.getAttribute('placeholder')||'',title:el.getAttribute('title')||'',hasChildren:el.children.length>0});
    picker(false);
  }
  function pickKey(e){if(e.key==='Escape'){e.preventDefault();post('ca:picked',{cancel:true});picker(false)}}
  function picker(on){
    if(on===pick.on)return;pick.on=on;
    if(on){
      pick.box=document.createElement('div');pick.tip=document.createElement('div');
      pick.box.style.cssText='position:fixed;z-index:2147483646;pointer-events:none;border:3px solid #FF6B57;background:rgba(255,107,87,.12);border-radius:4px;box-shadow:0 0 0 2px #11141A;transition:all .06s';
      pick.tip.style.cssText='position:fixed;z-index:2147483647;pointer-events:none;padding:2px 8px;border-radius:4px;background:#11141A;color:#C6F21B;font:700 12px/1.6 monospace;white-space:nowrap';
      document.body.append(pick.box,pick.tip);
      document.addEventListener('mousemove',pickMove,true);document.addEventListener('click',pickClick,true);document.addEventListener('keydown',pickKey,true);
      root.style.cursor='crosshair';
    }else{
      document.removeEventListener('mousemove',pickMove,true);document.removeEventListener('click',pickClick,true);document.removeEventListener('keydown',pickKey,true);
      if(pick.box)pick.box.remove();if(pick.tip)pick.tip.remove();pick.box=pick.tip=pick.cur=null;root.style.cursor='';
    }
  }

  window.CA={
    embedded:embedded,
    route:route,
    theme:function(){return root.dataset.theme},
    onTheme:function(fn){listeners.theme.push(fn)},
    on:function(type,fn){(listeners.message[type]=listeners.message[type]||[]).push(fn)},
    navigate:function(to,extra){if(embedded)post('ca:navigate',Object.assign({to:to},extra||{}));else location.href=to+'.html'},
    toast:function(title,text){post('ca:toast',{title:title,text:text||''})},
    keepAwake:keepAwake,
    post:post,
    config:function(){return cfg},
    onConfig:function(fn){listeners.config.push(fn)}
  };
  document.addEventListener('DOMContentLoaded',function(){domReady=true;applyConfig();post('ca:ready')});
})();
