/* standalone-shell.js — pengendali ringkas untuk file HTML standalone per menu.
   Tema, jam, iframe halaman (srcdoc), toast, screensaver beranimasi, pesan halaman ↔ shell.
   Tanpa login & tanpa konfigurasi Admin; strip berita, cuaca, dan Live Shift tetap aktif. */
(function(root){
  'use strict';
  var $=function(id){return document.getElementById(id)};
  var M=root.CA_STANDALONE,rootEl=document.documentElement,frame=null,loaded=false;
  var IDLE_MS=45000;
  rootEl.style.setProperty('--route',M.color);

  /* ---------- tema ---------- */
  function theme(){return rootEl.dataset.theme==='light'?'light':'dark'}
  function send(msg){if(frame&&frame.contentWindow)try{frame.contentWindow.postMessage(msg,'*')}catch(_){}}
  function setTheme(t){
    t=t==='light'?'light':'dark';rootEl.dataset.theme=t;
    try{localStorage.setItem('sa-theme',t)}catch(_){}
    var meta=document.querySelector('meta[name=theme-color]');if(meta)meta.content=t==='dark'?'#11141A':'#FFFDF3';
    $('themeToggle').setAttribute('aria-label',t==='dark'?'Aktifkan tema terang':'Aktifkan tema gelap');
    send({type:'ca:theme',theme:t});
  }
  $('themeToggle').addEventListener('click',function(){setTheme(theme()==='dark'?'light':'dark')});
  setTheme(theme());

  /* ---------- halaman menu ---------- */
  frame=document.createElement('iframe');
  frame.className='view';frame.title=M.title;
  frame.setAttribute('allow','clipboard-read; clipboard-write; autoplay; fullscreen; encrypted-media; picture-in-picture; geolocation');
  frame.setAttribute('allowfullscreen','');
  frame.addEventListener('load',function(){loaded=true;$('stage').classList.remove('is-loading');send({type:'ca:theme',theme:theme()});flushDept()});
  $('stage').classList.add('is-loading');
  $('stage').appendChild(frame);
  frame.srcdoc=root.CA_STANDALONE_PAGE;
  document.title=M.title+' · Content Analyst';

  var pendingDept=null;
  function flushDept(){if(pendingDept&&loaded){send({type:'ca:dept',dept:pendingDept});pendingDept=null}}
  function navigate(to,extra){
    if(to===M.id){if(extra&&extra.dept){pendingDept=extra.dept;flushDept()}return}
    var files={shift:'shift-live.html',timecode:'timecode.html',hotspot:'hotspot.html',csv:'csv-maker.html',scene:'scene-deck.html'};
    toast('Menu terpisah',files[to]?'Buka file '+files[to]+' untuk menu tersebut.':'Menu ini tidak tersedia di versi standalone.');
  }

  /* ---------- toast ---------- */
  function toast(title,text,err){
    var el=document.createElement('div');el.className='toast';
    var i=document.createElement('i');i.textContent=err?'!':'✓';if(err)i.style.background='var(--red)';
    var box=document.createElement('div'),b=document.createElement('b');b.textContent=title;box.append(b);
    if(text){var s=document.createElement('span');s.textContent=text;box.append(s)}
    el.append(i,box);$('toasts').appendChild(el);setTimeout(function(){el.remove()},4800);
  }

  /* ---------- screensaver beranimasi ---------- */
  var saver=$('saver'),idleTimer=null,showing=false;
  function waveTitle(){
    var n=0;['saverT1','saverT2'].forEach(function(id){
      var el=$(id);if(!el||el.dataset.wave)return;var t=el.textContent;el.replaceChildren();
      Array.from(t).forEach(function(ch){var sp=document.createElement('span');sp.className='sv-ch';sp.style.setProperty('--i',String(n++));sp.textContent=ch===' '?' ':ch;el.appendChild(sp)});
      el.dataset.wave='1';
    });
  }
  function tickSaver(){
    var now=new Date();
    var hm=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(now).split(':');
    if($('saverHH')){$('saverHH').textContent=hm[0];$('saverMM').textContent=hm[1];$('saverSS').textContent=hm[2]}
    $('saverClock').textContent=new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',weekday:'long',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now)+' WIB';
  }
  function showSaver(){
    showing=true;saver.dataset.mode='idle';saver.dataset.state='user';saver.dataset.anim='full';
    $('saverMsg').textContent='Gerakkan kursor atau tekan tombol apa saja untuk kembali';
    $('saverMode').textContent=M.label.toUpperCase()+' · IDLE';
    if($('saverBounceIco')){$('saverBounceIco').textContent=M.icon;$('saverBounceText').textContent=M.label.toUpperCase()}
    if($('saverTimer'))$('saverTimer').hidden=true;
    if($('saverActions')){$('saverActions').hidden=false}
    waveTitle();tickSaver();
    saver.classList.add('show');saver.setAttribute('aria-hidden','false');
  }
  function hideSaver(){showing=false;saver.classList.remove('show');saver.setAttribute('aria-hidden','true')}
  function arm(){clearTimeout(idleTimer);idleTimer=setTimeout(function(){if(document.hidden)return arm();showSaver()},IDLE_MS)}
  function activity(){if(showing)hideSaver();arm()}
  ['pointermove','pointerdown','keydown','wheel','touchstart'].forEach(function(ev){window.addEventListener(ev,activity,{passive:true,capture:true})});
  document.addEventListener('visibilitychange',function(){if(!document.hidden)activity()});
  if($('saverResume'))$('saverResume').addEventListener('click',function(){hideSaver();arm()});

  /* ---------- keyboard ---------- */
  function handleKey(code){
    if(code==='KeyT')setTheme(theme()==='dark'?'light':'dark');
    if(code==='KeyL'){clearTimeout(idleTimer);showSaver()}
  }
  window.addEventListener('keydown',function(e){if(e.altKey&&!e.ctrlKey&&!e.metaKey&&(e.code==='KeyT'||e.code==='KeyL')){e.preventDefault();handleKey(e.code)}});

  /* ---------- pesan dari halaman ---------- */
  window.addEventListener('message',function(e){
    if(!frame||e.source!==frame.contentWindow)return;
    var d=e.data;if(!d||typeof d.type!=='string'||d.type.indexOf('ca:')!==0)return;
    switch(d.type){
      case 'ca:activity':activity();break;
      case 'ca:key':handleKey(d.code);break;
      case 'ca:navigate':navigate(d.to,d.dept?{dept:d.dept}:null);break;
      case 'ca:toast':toast(d.title||'',d.text||'');break;
      case 'ca:ready':send({type:'ca:theme',theme:theme()});flushDept();break;
    }
  });

  /* ---------- jam ---------- */
  var fmtTime=new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  var fmtDate=new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',weekday:'short',day:'numeric',month:'short',year:'numeric'});
  function tick(){var n=new Date();$('mhClock').textContent=fmtTime.format(n).replace(/\./g,':');$('mhDate').textContent=fmtDate.format(n)+' · WIB';if(showing)tickSaver()}
  tick();setInterval(tick,1000);
  arm();

  root.CAShell={navigate:navigate,setTheme:setTheme,toast:toast,routes:[M]};
})(window);
