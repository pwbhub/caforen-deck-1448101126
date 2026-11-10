/* ==========================================================================
   config.js — sumber tunggal konfigurasi tampilan yang diatur Admin.
   Urutan penggabungan: DEFAULTS  ←  window.CA_SITE_CONFIG (js/data/site-config.js)
                                  ←  perubahan lokal Admin (localStorage)
   - Perubahan Admin langsung tersimpan di browser ini.
   - Agar perubahan berlaku di komputer lain, Admin mengunduh "site-config.js"
     dari konsol lalu menimpa file js/data/site-config.js.
   ========================================================================== */
(function(root){
  'use strict';
  var KEY='ca-config-v1',CACHE='ca-config-cache',HIST='ca-config-history';
  var DEFAULTS={
    version:1,
    brand:{kicker:'WORKSPACE · DRAFT',name:'CONTENT ANALYST',logo:'◷',docTitle:'Content Analyst Draft'},
    login:{
      title:'Masuk Workspace',
      subtitle:'Pilih peran Anda. User melihat tampilan yang sudah disiapkan Admin; Admin dapat mengubah tampilan, warna, nama elemen, dan skrip.',
      userLabel:'Tanggal hari ini',userHint:'Ketik tanggal, bulan, dan tahun hari ini. Contoh format: DD-MM-YYYY, DD/MM/YYYY, DDMMYYYY, atau 5 Januari 2026.',
      adminLabel:'Private key',adminHint:'Hanya untuk Admin. Huruf besar/kecil berpengaruh.',
      footer:'Content Analyst Draft · akses terbatas'
    },
    saver:{kicker:'CONTENT ANALYST · WORKSPACE',t1:'CONTENT',t2:'ANALYST',badge:'DRAFT',msg:'Gerakkan kursor atau tekan tombol apa saja untuk kembali',anim:'full'},
    announcement:{enabled:false,text:'',tone:'info'},
    links:{showCreator:true,creatorLabel:'Creator',creatorUrl:'https://wa.me/6285894925355?text=Halo%20Creator%20Content%20Analyst%20Draft%20%F0%9F%91%8B',showDonate:true,donateLabel:'Donate',donateUrl:'https://saweria.co/SAGELINE'},
    strips:{news:true,live:true,weather:true},
    routes:[
      {id:'home',     label:'Beranda',    icon:'⌂',file:'pages/home.html',      color:'#B9A4FF',title:'Beranda',         visible:true},
      {id:'shift',    label:'Shift Live', icon:'◷',file:'pages/shift-live.html',color:'#C6F21B',title:'Shift Live',      visible:true},
      {id:'timecode', label:'Timecode',   icon:'⏱',file:'pages/timecode.html',  color:'#7CC4FF',title:'Timecode Decoder',visible:true},
      {id:'hotspot',  label:'Hotspot',    icon:'✳',file:'pages/hotspot.html',   color:'#FF9BC8',title:'Hotspot Studio',  visible:true},
      {id:'csv',      label:'CSV Maker',  icon:'▦',file:'pages/csv-maker.html', color:'#5EE6B5',title:'CSV Maker',       visible:true},
      {id:'scene',    label:'Scene Deck', icon:'▶',file:'pages/scene-deck.html',color:'#FFA94D',title:'Scene Deck',      visible:true}
    ],
    defaultRoute:'home',
    colors:{
      accents:{g:'',yel:'',red:'',blu:'',pink:'',orange:'',mint:'',violet:''},
      light:{bg:'',paper:'',fg:'',mut:'',field:''},
      dark:{bg:'',paper:'',fg:'',mut:'',field:''},
      font:{body:'',display:''},
      radius:''
    },
    css:{shell:'',all:'',pages:{}},
    js:{shell:'',all:'',pages:{}},
    texts:[],          /* {route:'*'|id, selector, prop:'text'|'html'|'placeholder'|'title'|'value'|'hide'|'style', value, on:true} */
    scene:{extraTypes:[],hiddenTypes:[],defaultType:''},
    csv:{defaultMode:'original',modes:{original:true,advance:true,legacy:true},prefixes:['01','02','03'],defaultCount:1,defaultTc:'00:00:00:00@25'},
    session:{idleSec:45,userSignoutMin:30,adminSignoutMin:15,adminLockOnSaver:true,userLockOnSaver:false},
    security:{maxAttempts:5,lockSec:30,adminKey:null},
    meta:{updatedAt:0,updatedBy:''}
  };

  function isObj(v){return v&&typeof v==='object'&&!Array.isArray(v)}
  function clone(v){return JSON.parse(JSON.stringify(v))}
  function merge(base,over){
    if(!isObj(over))return clone(base);
    var out=clone(base);
    Object.keys(over).forEach(function(k){
      var v=over[k];
      if(isObj(v)&&isObj(out[k]))out[k]=merge(out[k],v);
      else if(v!==undefined)out[k]=clone(v);
    });
    return out;
  }
  /* rute: pertahankan file bawaan; rute tak dikenal diabaikan; rute baru bawaan ditambahkan */
  function normalizeRoutes(list){
    var known={};DEFAULTS.routes.forEach(function(r){known[r.id]=r});
    var out=[],seen={};
    (Array.isArray(list)?list:[]).forEach(function(r){
      if(!r||!known[r.id]||seen[r.id])return;seen[r.id]=1;
      out.push(Object.assign({},known[r.id],r,{file:known[r.id].file}));
    });
    DEFAULTS.routes.forEach(function(r){if(!seen[r.id])out.push(clone(r))});
    return out;
  }
  function normalize(c){
    c=merge(DEFAULTS,c||{});
    c.routes=normalizeRoutes(c.routes);
    if(!Array.isArray(c.texts))c.texts=[];
    if(!Array.isArray(c.csv.prefixes)||!c.csv.prefixes.length)c.csv.prefixes=clone(DEFAULTS.csv.prefixes);
    c.csv.defaultCount=Math.min(10,Math.max(1,parseInt(c.csv.defaultCount,10)||1));
    if(!Object.keys(c.csv.modes).some(function(k){return c.csv.modes[k]}))c.csv.modes.original=true;
    c.session.idleSec=Math.max(10,Number(c.session.idleSec)||45);
    c.session.userSignoutMin=Math.max(0,Number(c.session.userSignoutMin)||0);
    c.session.adminSignoutMin=Math.max(0,Number(c.session.adminSignoutMin)||0);
    c.security.maxAttempts=Math.max(1,parseInt(c.security.maxAttempts,10)||5);
    c.security.lockSec=Math.max(5,parseInt(c.security.lockSec,10)||30);
    return c;
  }
  function read(k){try{return JSON.parse(localStorage.getItem(k))}catch(_){return null}}
  function write(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(_){return false}}

  var site=root.CA_SITE_CONFIG||{};
  var current=normalize(merge(merge(DEFAULTS,site),read(KEY)||{}));
  var listeners=[];
  write(CACHE,publicView(current));

  /* versi yang aman dikirim ke halaman (tanpa material kunci) */
  function publicView(c){var p=clone(c);if(p.security)delete p.security.adminKey;return p}

  function get(){return clone(current)}
  function save(next,by){
    var prev=current;
    next=normalize(next);next.meta={updatedAt:Date.now(),updatedBy:by||'admin'};
    /* riwayat: simpan 15 versi terakhir untuk dipulihkan */
    var h=read(HIST)||[];h.unshift({t:Date.now(),by:by||'admin',config:prev});write(HIST,h.slice(0,15));
    current=next;write(KEY,current);write(CACHE,publicView(current));
    listeners.forEach(function(fn){try{fn(get(),prev)}catch(e){console.error(e)}});
    return get();
  }
  function reset(by){return save(merge(DEFAULTS,site),by||'reset')}
  function history(){return read(HIST)||[]}
  function onChange(fn){listeners.push(fn)}
  function exportSiteFile(c){
    var p=clone(c||current);
    return '/* site-config.js — konfigurasi tampilan hasil ekspor Konsol Admin.\n   Diekspor: '+new Date().toISOString()+'\n   Timpa file js/data/site-config.js dengan file ini agar semua komputer memakai tampilan yang sama. */\nwindow.CA_SITE_CONFIG='+JSON.stringify(p,null,2)+';\n';
  }

  root.CAConfig={DEFAULTS:DEFAULTS,get:get,save:save,reset:reset,history:history,onChange:onChange,normalize:normalize,merge:merge,publicView:function(){return publicView(current)},exportSiteFile:exportSiteFile};
})(window);
