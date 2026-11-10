/* shell.js — pengendali workspace: menu tab (dari konfigurasi Admin), iframe halaman,
   tema, jam, screensaver idle + kunci sesi + sign out otomatis, pintasan keyboard,
   pesan antarhalaman, dan jembatan Konsol Admin ↔ penyimpanan konfigurasi.
   Workspace baru dimulai setelah login (lihat gate.js → CAShell.start). */
(function(root){
  'use strict';
  var $=function(id){return document.getElementById(id)};
  var C=root.CAConfig,AUTH=root.CAAuth,AP=root.CAApply;
  var ADMIN_ROUTE={id:'admin',label:'Admin',icon:'⚙',file:'pages/admin.html',color:'#FF6B57',title:'Konsol Admin',visible:true};
  var cfg=C.get();
  var session=null,ROUTES=[],byId={};
  var frames={},current=null,pendingExtra={},shellScriptRan=false,shellTexts=null;
  var rootEl=document.documentElement;
  var body=document.body;

  /* ---------- tema ---------- */
  function theme(){return rootEl.dataset.theme==='light'?'light':'dark'}
  function setTheme(t){
    t=t==='light'?'light':'dark';rootEl.dataset.theme=t;
    try{localStorage.setItem('ca-theme',t)}catch(_){}
    document.querySelector('meta[name=theme-color]').content=t==='dark'?'#11141A':'#FFFDF3';
    $('themeToggle').setAttribute('aria-label',t==='dark'?'Aktifkan tema terang':'Aktifkan tema gelap');
    Object.keys(frames).forEach(function(id){send(id,{type:'ca:theme',theme:t})});
  }
  $('themeToggle').addEventListener('click',function(){setTheme(theme()==='dark'?'light':'dark')});
  setTheme(theme());

  /* ---------- terapkan konfigurasi ke shell ---------- */
  function txt(id,v){var el=$(id);if(el&&v!=null&&el.textContent!==String(v))el.textContent=String(v)}
  function safeUrl(u,fallback){u=String(u||'');return /^(https?:|mailto:|tel:)/i.test(u)?u:fallback}
  function applyShellConfig(){
    var b=cfg.brand,s=cfg.saver,l=cfg.links,lg=cfg.login;
    txt('mhKicker',b.kicker);txt('mhName',b.name);txt('mhLogo',b.logo);
    txt('gateKicker',b.kicker);txt('gateName',b.name);txt('gateLogo',b.logo);
    txt('saverKicker',s.kicker);txt('saverT1',s.t1);txt('saverT2',s.t2);txt('saverBadge',s.badge);
    $('saverBadge').hidden=!s.badge;
    txt('gateTitle',lg.title);txt('gateSub',lg.subtitle);txt('userLabel',lg.userLabel);txt('userHint',lg.userHint);
    txt('adminLabel',lg.adminLabel);txt('adminHint',lg.adminHint);txt('gateFoot',lg.footer);
    $('lnkCreator').hidden=!l.showCreator;$('lnkDonate').hidden=!l.showDonate;
    $('lnkCreator').style.display=l.showCreator?'':'none';$('lnkDonate').style.display=l.showDonate?'':'none';
    $('lnkCreator').href=safeUrl(l.creatorUrl,'#');$('lnkDonate').href=safeUrl(l.donateUrl,'#');
    txt('lnkCreatorLabel',l.creatorLabel);txt('lnkDonateLabel',l.donateLabel);
    var mh=$('masterHeader');
    mh.classList.toggle('is-hidden-news',!cfg.strips.news);
    mh.classList.toggle('is-hidden-live',!cfg.strips.live);
    mh.classList.toggle('is-hidden-weather',!cfg.strips.weather);
    applyAnnouncement();
    AP.setStyle(document,'ca-config-style',[AP.tokenCss(cfg),cfg.css.shell||''].filter(Boolean).join('\n'));
    if(!shellTexts)shellTexts=new AP.TextOverrides(document,'shell');
    shellTexts.set(cfg.texts||[]);
    if(current&&byId[current])document.title=byId[current].title+' · '+b.docTitle;else document.title=b.docTitle;
  }
  var announceClosed='';
  function applyAnnouncement(){
    var a=cfg.announcement,el=$('announce');
    var show=!!(a.enabled&&a.text&&session&&announceClosed!==a.text);
    el.hidden=!show;if(!show)return;
    el.dataset.tone=a.tone||'info';
    txt('announceTag',{info:'INFO',warn:'PERHATIAN',danger:'PENTING',ok:'KABAR BAIK'}[a.tone]||'INFO');
    txt('announceText',a.text);
  }
  $('announceClose').addEventListener('click',function(){announceClosed=cfg.announcement.text;applyAnnouncement()});

  /* ---------- rute & tab ---------- */
  var tabs=$('mhTabs');
  function buildRoutes(){
    var list=cfg.routes.filter(function(r){return session&&session.role==='admin'?true:r.visible!==false});
    if(session&&session.role==='admin')list=[ADMIN_ROUTE].concat(list);
    ROUTES=list;byId={};ROUTES.forEach(function(r){byId[r.id]=r});
    tabs.replaceChildren();
    ROUTES.forEach(function(r,i){
      var b=document.createElement('button');b.type='button';b.className='mh-tab';b.setAttribute('role','tab');b.dataset.go=r.id;b.style.setProperty('--tc',r.color);
      b.setAttribute('aria-selected',String(r.id===current));b.title=r.title+(i<9?' (Alt+'+(i+1)+')':'')+(r.visible===false?' · disembunyikan dari User':'');
      if(r.visible===false)b.classList.add('is-hidden-route');
      var ti=document.createElement('span');ti.className='ti';ti.setAttribute('aria-hidden','true');ti.textContent=r.icon;
      var lb=document.createElement('span');lb.textContent=r.label;
      var kb=document.createElement('kbd');kb.textContent=i<9?'Alt '+(i+1):'';
      b.append(ti,lb);if(i<9)b.append(kb);
      tabs.appendChild(b);
    });
    tabs.style.setProperty('--tabs',String(Math.max(1,ROUTES.length)));
    /* bingkai rute yang tidak lagi diizinkan dihapus */
    Object.keys(frames).forEach(function(id){if(!byId[id]){frames[id].remove();delete frames[id]}});
    if(current&&!byId[current])current=null;
  }
  document.addEventListener('click',function(e){var a=e.target.closest('[data-go]');if(!a||!session)return;e.preventDefault();navigate(a.dataset.go)});

  /* ---------- iframe ---------- */
  function send(id,msg){var f=frames[id];if(f&&f.contentWindow)try{f.contentWindow.postMessage(msg,'*')}catch(_){}}
  function sendConfig(id){send(id,{type:'ca:config',config:C.publicView()})}
  function ensureFrame(id){
    if(frames[id])return frames[id];
    var r=byId[id],f=document.createElement('iframe');
    f.className='view';f.title=r.title;f.hidden=true;f.dataset.route=id;
    f.setAttribute('allow','clipboard-read; clipboard-write; autoplay; fullscreen; encrypted-media; picture-in-picture; geolocation');f.setAttribute('allowfullscreen','');
    f.src=r.file+'?embed=1&theme='+theme();
    f.addEventListener('load',function(){f.dataset.loaded='1';if(current===id)$('stage').classList.remove('is-loading');send(id,{type:'ca:theme',theme:theme()});sendConfig(id);flushExtra(id);if(id==='home')pushLive()});
    $('stage').appendChild(f);frames[id]=f;return f;
  }
  function flushExtra(id){var x=pendingExtra[id];if(!x||!frames[id]||!frames[id].dataset.loaded)return;delete pendingExtra[id];if(x.dept)send(id,{type:'ca:dept',dept:x.dept})}
  function destroyFrames(){Object.keys(frames).forEach(function(k){frames[k].remove()});frames={};current=null}

  /* ---------- statistik penggunaan menu (untuk rekomendasi adaptif di Konsol Admin) ---------- */
  var USAGE_KEY='ca-usage',usageCur=null,usageAt=0;
  function usageRead(){var u;try{u=JSON.parse(localStorage.getItem(USAGE_KEY))}catch(_){u=null}u=u||{};u.routes=u.routes||{};u.days=u.days||{};u.events=u.events||{};u.roles=u.roles||{};u.since=u.since||Date.now();return u}
  function usageWrite(u){var keys=Object.keys(u.days).sort();while(keys.length>45)delete u.days[keys.shift()];try{localStorage.setItem(USAGE_KEY,JSON.stringify(u))}catch(_){}}
  function usageFlush(){
    if(!usageCur||!usageAt)return;var now=Date.now(),u=usageRead(),r=u.routes[usageCur]=u.routes[usageCur]||{opens:0,ms:0,last:0};
    r.ms+=Math.min(now-usageAt,4*3600e3);usageAt=now;usageWrite(u);
  }
  function usageOpen(id){
    usageFlush();usageCur=id;usageAt=Date.now();
    var u=usageRead(),r=u.routes[id]=u.routes[id]||{opens:0,ms:0,last:0},day=AUTH.dayKey();
    r.opens++;r.last=Date.now();u.days[day]=u.days[day]||{};u.days[day][id]=(u.days[day][id]||0)+1;
    if(session){u.roles[session.role]=u.roles[session.role]||{};u.roles[session.role][id]=(u.roles[session.role][id]||0)+1}
    usageWrite(u);
  }
  function usageEvent(ev){var u=usageRead(),day=AUTH.dayKey();u.events[ev]=(u.events[ev]||0)+1;u.days[day]=u.days[day]||{};u.days[day]['ev:'+ev]=(u.days[day]['ev:'+ev]||0)+1;usageWrite(u)}
  function usagePause(){usageFlush();usageAt=0}
  function usageResume(){if(session&&usageCur)usageAt=Date.now()}
  function usageStop(){usageFlush();usageCur=null;usageAt=0}
  document.addEventListener('visibilitychange',function(){if(document.hidden)usagePause();else if(saverMode==='none')usageResume()});
  window.addEventListener('pagehide',usageFlush);

  /* ---------- navigasi ---------- */
  function firstRoute(){var d=cfg.defaultRoute;if(byId[d])return d;return ROUTES[0]?ROUTES[0].id:null}
  function navigate(id,extra){
    if(!session)return;
    if(!byId[id])id=firstRoute();
    if(!id)return;
    if(extra)pendingExtra[id]=extra;
    var r=byId[id];
    if(current===id){flushExtra(id);return}
    var f=ensureFrame(id);
    current=id;
    try{history.replaceState(null,'','#'+id)}catch(_){location.hash=id}
    try{localStorage.setItem('ca-last-route-'+session.role,id)}catch(_){}
    rootEl.style.setProperty('--route',r.color);
    document.title=r.title+' · '+cfg.brand.docTitle;
    Array.prototype.forEach.call(tabs.children,function(b){var on=b.dataset.go===id;b.setAttribute('aria-selected',String(on));if(on)try{b.scrollIntoView({block:'nearest',inline:'center'})}catch(_){}});
    Object.keys(frames).forEach(function(k){frames[k].hidden=k!==id});
    $('stage').classList.toggle('is-loading',f.dataset.loaded!=='1');
    flushExtra(id);activity();usageOpen(id);
    try{if(f.dataset.loaded==='1')f.contentWindow.focus()}catch(_){}
  }
  window.addEventListener('hashchange',function(){var id=location.hash.slice(1);if(session&&byId[id]&&id!==current)navigate(id)});

  /* ---------- screensaver, kunci sesi & sign out otomatis ---------- */
  var saver=$('saver'),idleTimer=null,saverMode='none',lastAct=Date.now();
  function idleMs(){return cfg.session.idleSec*1000}
  function signoutMs(){if(!session)return 0;var m=session.role==='admin'?cfg.session.adminSignoutMin:cfg.session.userSignoutMin;return (Number(m)||0)*60000}
  function needsLock(){return !!session&&(session.role==='admin'?cfg.session.adminLockOnSaver:cfg.session.userLockOnSaver)}
  function showSaver(mode,msg){
    saverMode=mode;saver.dataset.mode=mode==='locked'?'idle':mode;
    $('saverMsg').textContent=msg||'';
    $('saverMode').textContent=mode==='locked'?'SESI TERKUNCI':mode==='gate'?'LOGIN · IDLE':(session?session.role.toUpperCase()+' · IDLE':'IDLE MODE');
    $('saverActions').hidden=!session;
    $('saverResume').hidden=mode==='locked';
    var lockForm=$('saverUnlock');lockForm.hidden=mode!=='locked';
    if(mode==='locked'){
      $('unlockLabel').textContent=session.role==='admin'?'Sesi Admin terkunci — masukkan private key':'Sesi terkunci — ketik tanggal hari ini';
      var k=$('unlockKey');k.type=session.role==='admin'?'password':'text';k.placeholder=session.role==='admin'?'Private key':'DD-MM-YYYY';k.value='';
      $('unlockWarn').hidden=true;setTimeout(function(){try{k.focus()}catch(_){}},350);
    }
    var state=mode==='locked'?'locked':mode==='gate'||!session?'gate':session.role;
    saver.dataset.state=state;saver.dataset.anim=(cfg.saver&&cfg.saver.anim)||'full';
    $('saverBounceIco').textContent={gate:'◷',user:'☺',admin:'⚙',locked:'🔒'}[state];
    $('saverBounceText').textContent={gate:'LOGIN',user:'USER · IDLE',admin:'ADMIN · IDLE',locked:'TERKUNCI'}[state];
    waveTitle();
    usagePause();
    saver.classList.add('show');saver.setAttribute('aria-hidden','false');tickSaver();
  }
  /* pecah judul menjadi huruf agar bisa bergelombang */
  function waveTitle(){
    var n=0;['saverT1','saverT2'].forEach(function(id){
      var el=$(id),t=el.textContent;if(el.dataset.wave===t)return;
      el.replaceChildren();Array.from(t).forEach(function(ch){var sp=document.createElement('span');sp.className='sv-ch';sp.style.setProperty('--i',String(n++));sp.textContent=ch===' '?'\u00A0':ch;el.appendChild(sp)});
      el.dataset.wave=t;
    });
  }
  function hideSaver(){var was=saverMode!=='none';saver.classList.remove('show');saver.setAttribute('aria-hidden','true');saverMode='none';$('saverTimer').hidden=true;if(was)usageResume()}
  function onIdle(){
    if(!session){if(document.hidden||!$('gate')||$('gate').hidden)return arm();showSaver('gate','Gerakkan kursor atau tekan tombol apa saja untuk kembali ke halaman login');return}
    if(needsLock())showSaver('locked',cfg.saver.msg);
    else showSaver('idle',cfg.saver.msg);
  }
  function arm(){clearTimeout(idleTimer);idleTimer=setTimeout(onIdle,idleMs())}
  function activity(){
    if(saverMode==='locked')return;               /* terkunci: hanya bisa dibuka dengan kunci */
    if(saverMode==='idle'||saverMode==='gate')hideSaver();
    lastAct=Date.now();arm();
  }
  function lockNow(){if(!session)return;clearTimeout(idleTimer);showSaver(needsLock()?'locked':'idle',cfg.saver.msg)}
  ['pointermove','pointerdown','keydown','wheel','touchstart'].forEach(function(ev){window.addEventListener(ev,function(e){
    /* klik/ketik pada tombol & form screensaver tidak dianggap "aktivitas" agar tombolnya bisa dipakai */
    if(saverMode!=='none'&&e.target&&e.target.closest&&e.target.closest('#saverUnlock,#saverActions'))return;
    activity();
  },{passive:true,capture:true})});
  document.addEventListener('visibilitychange',function(){if(!document.hidden)activity()});
  function fmtLeft(ms){var s=Math.max(0,Math.ceil(ms/1000));return Math.floor(s/60)+':'+('0'+s%60).slice(-2)}
  function tickSaver(){
    $('saverClock').textContent=new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',weekday:'long',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date())+' WIB';
    var now=new Date(),hm=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(now).split(':');
    $('saverHH').textContent=hm[0];$('saverMM').textContent=hm[1];$('saverSS').textContent=hm[2];
    var so=signoutMs(),tm=$('saverTimer');
    if(session&&so&&saverMode!=='none'){
      var left=lastAct+so-Date.now();tm.hidden=false;$('saverCount').textContent='Sign out otomatis dalam '+fmtLeft(left);
      $('saverRing').style.strokeDashoffset=String(119.4*(1-Math.max(0,Math.min(1,left/so))));
    }else tm.hidden=true;
  }
  function checkAutoSignout(){
    if(!session)return;
    var so=signoutMs();
    if(so&&Date.now()-lastAct>=so){signOut('idle');return}
    /* sesi User berakhir saat tanggal berganti */
    if(!AUTH.getSession()){signOut('expired')}
  }
  $('saverResume').addEventListener('click',function(){if(saverMode==='idle'){hideSaver();lastAct=Date.now();arm()}});
  $('saverSignOut').addEventListener('click',function(){signOut('manual')});
  $('saverUnlock').addEventListener('submit',function(e){
    e.preventDefault();if(!session)return;
    var role=session.role,warn=$('unlockWarn'),inp=$('unlockKey'),max=cfg.security.maxAttempts;
    var wait=AUTH.lockedFor(role);
    if(wait){warn.hidden=false;warn.textContent='Terlalu banyak percobaan. Tunggu '+wait+' detik.';return}
    var ok=role==='admin'?AUTH.verifyAdmin(inp.value,fullCfg().security.adminKey):AUTH.verifyUser(inp.value).ok;
    if(ok){AUTH.resetGuard(role);AUTH.log('unlock',role,'Sesi dibuka kembali');hideSaver();lastAct=Date.now();arm();return}
    var g=AUTH.recordFail(role,max,cfg.security.lockSec);
    AUTH.log('unlock-fail',role,'Kunci salah saat membuka screensaver');
    inp.value='';inp.focus();
    if(g.lockUntil>Date.now()){AUTH.log('lockout',role,'Sign out paksa setelah '+max+' kali salah');signOut('unlock-fail');return}
    warn.hidden=false;warn.textContent='⚠ '+(role==='admin'?'Private key':'Tanggal')+' salah. Sisa '+(max-g.fails)+' percobaan sebelum sign out paksa.';
  });

  /* ---------- keyboard ---------- */
  function handleKey(code){
    if(!session)return;
    var m=/^Digit([1-9])$/.exec(code);
    if(m){var r=ROUTES[Number(m[1])-1];if(r)navigate(r.id);return}
    if(code==='KeyT')setTheme(theme()==='dark'?'light':'dark');
    if(code==='KeyL')lockNow();
  }
  window.addEventListener('keydown',function(e){if(e.altKey&&!e.ctrlKey&&!e.metaKey&&(/^Digit[1-9]$/.test(e.code)||e.code==='KeyT'||e.code==='KeyL')){e.preventDefault();handleKey(e.code)}});

  /* ---------- pesan dari halaman ---------- */
  function fullCfg(){return C.get()}
  function routeOfSource(src){var id=null;Object.keys(frames).some(function(k){if(frames[k].contentWindow===src){id=k;return true}return false});return id}
  function isAdmin(from){return from==='admin'&&session&&session.role==='admin'}
  function guardInfo(){return {user:AUTH.guard('user'),admin:AUTH.guard('admin')}}
  window.addEventListener('message',function(e){
    var d=e.data;if(!d||typeof d.type!=='string'||d.type.indexOf('ca:')!==0)return;
    var from=routeOfSource(e.source);if(!from)return;
    switch(d.type){
      case 'ca:activity':activity();break;
      case 'ca:key':handleKey(d.code);break;
      case 'ca:navigate':navigate(d.to,d.dept?{dept:d.dept}:null);break;
      case 'ca:toast':toast(d.title||'',d.text||'');usageEvent('act-'+from);break;
      case 'ca:ready':send(from,{type:'ca:theme',theme:theme()});sendConfig(from);if(from==='home')pushLive();break;
      case 'ca:live-request':pushLive();break;
      case 'ca:usage-event':if(typeof d.ev==='string'&&/^[a-z0-9-]{1,30}$/.test(d.ev))usageEvent(d.ev);break;
      case 'ca:script-error':if(session&&session.role==='admin')toast('Skrip kustom error · '+(d.label||''),d.message||'',true);break;
    }
    if(!isAdmin(from))return;
    /* ---- jembatan Konsol Admin ---- */
    var reply=function(type,payload){send('admin',Object.assign({type:type,reqId:d.reqId},payload||{}))};
    switch(d.type){
      case 'ca:admin-hello':
        usageFlush();
        reply('ca:admin-data',{usage:usageRead(),config:C.publicView(),defaults:C.DEFAULTS,hasCustomKey:!!(fullCfg().security.adminKey),logs:AUTH.logs(),guard:guardInfo(),history:C.history().map(function(h){return {t:h.t,by:h.by}}),session:{role:session.role,at:session.at},routes:cfg.routes});
        break;
      case 'ca:config-set':
        var next=C.merge(C.DEFAULTS,d.config||{});next.security.adminKey=fullCfg().security.adminKey;
        C.save(next,'admin');AUTH.log('config-save','admin',d.note||'Konfigurasi disimpan');
        reply('ca:config-saved',{config:C.publicView(),history:C.history().map(function(h){return {t:h.t,by:h.by}})});
        break;
      case 'ca:config-reset':
        var keep=fullCfg().security.adminKey;C.reset('reset');var c2=fullCfg();c2.security.adminKey=keep;C.save(c2,'reset');
        AUTH.log('config-reset','admin','Konfigurasi dikembalikan ke bawaan');
        reply('ca:config-saved',{config:C.publicView(),history:C.history().map(function(h){return {t:h.t,by:h.by}})});
        break;
      case 'ca:history-restore':
        var h=C.history()[d.index];if(!h){reply('ca:error',{message:'Versi tidak ditemukan.'});break}
        var rc=C.merge(C.DEFAULTS,h.config);rc.security.adminKey=fullCfg().security.adminKey;C.save(rc,'restore');
        AUTH.log('config-restore','admin','Memulihkan versi '+new Date(h.t).toLocaleString('id-ID'));
        reply('ca:config-saved',{config:C.publicView(),history:C.history().map(function(x){return {t:x.t,by:x.by}})});
        break;
      case 'ca:admin-key':
        var cur=fullCfg();
        if(!AUTH.verifyAdmin(d.current,cur.security.adminKey)){AUTH.log('key-change-fail','admin','Kunci lama salah');reply('ca:admin-key-result',{ok:false,message:'Private key saat ini salah.'});break}
        if(d.reset){cur.security.adminKey=null}
        else{
          if(String(d.next||'').length<8){reply('ca:admin-key-result',{ok:false,message:'Kunci baru minimal 8 karakter.'});break}
          cur.security.adminKey=AUTH.makeKeyRecord(d.next);
        }
        C.save(cur,'key');AUTH.log('key-change','admin',d.reset?'Kunci dikembalikan ke bawaan':'Private key diganti');
        reply('ca:admin-key-result',{ok:true,message:d.reset?'Private key kembali ke kunci bawaan.':'Private key baru aktif. Simpan baik-baik.',hasCustomKey:!!cur.security.adminKey});
        break;
      case 'ca:logs-get':reply('ca:logs',{logs:AUTH.logs(),guard:guardInfo()});break;
      case 'ca:logs-clear':AUTH.clearLogs();AUTH.log('log-clear','admin','Log dibersihkan');reply('ca:logs',{logs:AUTH.logs(),guard:guardInfo()});break;
      case 'ca:guard-reset':AUTH.resetGuard('user');AUTH.resetGuard('admin');reply('ca:logs',{logs:AUTH.logs(),guard:guardInfo()});break;
      case 'ca:site-file':reply('ca:site-file',{text:C.exportSiteFile(fullCfg())});break;
      case 'ca:reload-pages':Object.keys(frames).forEach(function(k){if(k!=='admin'){frames[k].dataset.loaded='';frames[k].src=byId[k].file+'?embed=1&theme='+theme()}});break;
      case 'ca:lock':lockNow();break;
      case 'ca:saver-demo':clearTimeout(idleTimer);showSaver('idle','Pratinjau screensaver · gerakkan kursor untuk kembali');if(/^(full|soft|off)$/.test(d.anim||''))saver.dataset.anim=d.anim;break;
      case 'ca:usage-get':usageFlush();reply('ca:usage',{usage:usageRead()});break;
      case 'ca:usage-reset':try{localStorage.removeItem(USAGE_KEY)}catch(_){}usageAt=usageCur?Date.now():0;reply('ca:usage',{usage:usageRead()});break;
    }
  });

  /* perubahan konfigurasi → terapkan ke shell dan semua halaman */
  C.onChange(function(next,prev){
    cfg=next;
    var keep=current;
    applyShellConfig();
    if(session){
      buildRoutes();
      if(keep&&byId[keep]){current=null;navigate(keep)}else{current=null;navigate(firstRoute())}
    }
    Object.keys(frames).forEach(function(id){sendConfig(id)});
    if(JSON.stringify(prev.js.all)+JSON.stringify(prev.js.pages)!==JSON.stringify(next.js.all)+JSON.stringify(next.js.pages)){
      Object.keys(frames).forEach(function(k){if(k!=='admin'){frames[k].dataset.loaded='';frames[k].src=byId[k].file+'?embed=1&theme='+theme()}});
      toast('Skrip kustom diperbarui','Halaman dimuat ulang agar skrip baru berjalan.');
    }
    arm();
  });

  /* ---------- data live untuk Beranda ---------- */
  function pushLive(){
    if(!root.CALive||!frames.home)return;
    var s=root.CALive.summary(),u=root.CALive.updatedAt();
    send('home',{type:'ca:live',summary:s,updatedAt:u?u.getTime():null});
  }
  if(root.CALive)root.CALive.onUpdate(pushLive);

  /* ---------- toast ---------- */
  function toast(title,text,err){
    var el=document.createElement('div');el.className='toast'+(err?' err':'');
    var i=document.createElement('i');i.textContent=err?'!':'✓';if(err)i.style.background='var(--red)';
    var box=document.createElement('div');var b=document.createElement('b');b.textContent=title;var s=document.createElement('span');s.textContent=text;
    box.append(b);if(text)box.append(s);el.append(i,box);$('toasts').appendChild(el);setTimeout(function(){el.remove()},4800);
  }

  /* ---------- jam ---------- */
  var fmtTime=new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  var fmtDate=new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',weekday:'short',day:'numeric',month:'short',year:'numeric'});
  function tick(){
    var n=new Date(),t=fmtTime.format(n).replace(/\./g,':'),d=fmtDate.format(n)+' · WIB';
    $('mhClock').textContent=t;$('mhDate').textContent=d;
    var gc=$('gateClock');if(gc){gc.textContent=t;$('gateDate').textContent=d}
    if(saverMode!=='none')tickSaver();
    checkAutoSignout();
    if(n.getSeconds()%30===0)usageFlush();
  }

  /* ---------- sesi: mulai & sign out ---------- */
  function start(sess){
    session=sess;cfg=C.get();
    body.classList.remove('is-locked');
    $('gate').hidden=true;hideSaver();
    var role=$('mhRole');role.dataset.role=sess.role;$('mhRoleText').textContent=sess.role==='admin'?'ADMIN':'USER';
    applyShellConfig();buildRoutes();
    var startId=location.hash.slice(1);
    if(!byId[startId]){try{startId=localStorage.getItem('ca-last-route-'+sess.role)}catch(_){startId=null}}
    if(!byId[startId])startId=sess.role==='admin'?'admin':firstRoute();
    current=null;navigate(startId);
    lastAct=Date.now();arm();
    if(!shellScriptRan){shellScriptRan=true;AP.runScript(cfg.js.shell,'shell',{CA:root.CAShell,config:C.publicView()},function(e){if(sess.role==='admin')toast('Skrip shell error',String(e.message||e),true)})}
  }
  function signOut(reason){
    if(!session)return;
    var role=session.role;
    AUTH.log('signout',role,{manual:'Sign out manual',idle:'Sign out otomatis (tidak ada aktivitas)',expired:'Sesi kedaluwarsa (tanggal berganti)','unlock-fail':'Sign out paksa (kunci salah berulang)'}[reason]||reason);
    usageStop();AUTH.clearSession();session=null;
    destroyFrames();hideSaver();
    tabs.replaceChildren();$('announce').hidden=true;
    body.classList.add('is-locked');
    try{history.replaceState(null,'',location.pathname+location.search)}catch(_){}
    document.title=cfg.brand.docTitle;
    if(root.CAGate)root.CAGate.show(reason,role);
    lastAct=Date.now();arm();
  }
  $('signOutBtn').addEventListener('click',function(){signOut('manual')});

  applyShellConfig();
  tick();setInterval(tick,1000);
  arm();

  root.CAShell={navigate:navigate,setTheme:setTheme,toast:toast,start:start,signOut:signOut,lock:lockNow,routes:function(){return ROUTES.slice()},session:function(){return session?{role:session.role,at:session.at}:null},config:function(){return C.publicView()}};
})(window);
