/* ==========================================================================
   auth.js — gerbang masuk User / Admin, sesi bertanda tangan, pembatas
   percobaan (lockout) dan log aktivitas.
   - User  : mengetik tanggal hari ini (tanggal, bulan, tahun).
   - Admin : private key. Kunci TIDAK disimpan sebagai teks; yang tersimpan
             hanya hasil SHA-256 bergaram yang diregangkan 4096 putaran,
             dipecah dan diacak urutannya. Kunci dicocokkan dengan menghitung
             ulang hash dari input.
   Catatan: ini gerbang sisi-klien (file statis). Untuk keamanan tingkat
   server, tempatkan aplikasi di belakang autentikasi web server.
   ========================================================================== */
(function(root){
  'use strict';
  var H=root.CASha256;
  /* --- material kunci admin bawaan (terenkripsi satu arah) --- */
  var KM={
    s:['e6d0','c4d7','8d3b','a1e9','5c7f','b2f0','19a2','4a6e'],      /* garam, diacak */
    p:['2824fe822a9a64b3','18345444159fc7c0','174a5d7d0deb2352','659f29282dd0e419'], /* hash, terbalik */
    r:4096
  };
  function builtinSalt(){var order=[1,3,5,7,2,4,6,0];return order.map(function(i){return KM.s[i]}).join('')}
  function builtinHash(){return KM.p.slice().reverse().join('')}

  var LS={get:function(k){try{return localStorage.getItem(k)}catch(_){return null}},set:function(k,v){try{localStorage.setItem(k,v)}catch(_){}},del:function(k){try{localStorage.removeItem(k)}catch(_){}}};
  var SS={get:function(k){try{return sessionStorage.getItem(k)}catch(_){return mem[k]||null}},set:function(k,v){try{sessionStorage.setItem(k,v)}catch(_){mem[k]=v}},del:function(k){try{sessionStorage.removeItem(k)}catch(_){}delete mem[k]}};
  var mem={};

  /* ---------- admin ---------- */
  function verifyAdmin(input,record){
    input=String(input==null?'':input);
    if(!input)return false;
    if(record&&record.hash&&record.salt){
      return H.stretch(input,record.salt,record.rounds||KM.r)===record.hash;
    }
    return H.stretch(input,builtinSalt(),KM.r)===builtinHash();
  }
  function makeKeyRecord(newKey){var salt=H.randomHex(16);return {salt:salt,hash:H.stretch(String(newKey),salt,KM.r),rounds:KM.r,changedAt:Date.now()}}

  /* ---------- user: tanggal hari ini ---------- */
  var MONTHS={jan:1,januari:1,january:1,feb:2,februari:2,february:2,peb:2,mar:3,maret:3,march:3,apr:4,april:4,mei:5,may:5,jun:6,juni:6,june:6,jul:7,juli:7,july:7,agu:8,agt:8,ags:8,agustus:8,aug:8,august:8,sep:9,sept:9,september:9,okt:10,oktober:10,oct:10,october:10,nov:11,nopember:11,november:11,des:12,desember:12,dec:12,december:12};
  function todayParts(tz){
    var d=new Date();
    if(!tz)return {d:d.getDate(),m:d.getMonth()+1,y:d.getFullYear()};
    try{
      var p=new Intl.DateTimeFormat('en-GB',{timeZone:tz,day:'numeric',month:'numeric',year:'numeric'}).formatToParts(d),o={};
      p.forEach(function(x){o[x.type]=Number(x.value)});return {d:o.day,m:o.month,y:o.year};
    }catch(_){return todayParts()}
  }
  function dayKey(p){p=p||todayParts();return p.y+'-'+('0'+p.m).slice(-2)+'-'+('0'+p.d).slice(-2)}
  function parseDate(input){
    var s=String(input==null?'':input).trim().toLowerCase();
    if(!s)return null;
    var tok=s.split(/[^a-z0-9]+/).filter(Boolean);
    var d,m,y;
    if(tok.length===1&&/^\d+$/.test(tok[0])){
      var t=tok[0];
      if(t.length===8){
        if(/^(19|20)\d{2}/.test(t)&&Number(t.slice(4,6))<=12&&Number(t.slice(0,2))>31){y=+t.slice(0,4);m=+t.slice(4,6);d=+t.slice(6,8)}
        else{d=+t.slice(0,2);m=+t.slice(2,4);y=+t.slice(4,8)}
      }else if(t.length===6){d=+t.slice(0,2);m=+t.slice(2,4);y=2000+(+t.slice(4,6))}
      else return null;
    }else if(tok.length===3){
      if(/^\d{4}$/.test(tok[0])){y=+tok[0];m=MONTHS[tok[1]]||+tok[1];d=+tok[2]}
      else{
        d=+tok[0];m=/^\d+$/.test(tok[1])?+tok[1]:MONTHS[tok[1]];y=+tok[2];
        if(/^\d{2}$/.test(tok[2]))y=2000+y;
      }
    }else return null;
    if(!d||!m||!y||m<1||m>12||d<1||d>31)return null;
    return {d:d,m:m,y:y};
  }
  function verifyUser(input){
    var p=parseDate(input);
    if(!p)return {ok:false,reason:'format'};
    var a=todayParts(),b=todayParts('Asia/Jakarta');
    var same=function(x){return x.d===p.d&&x.m===p.m&&x.y===p.y};
    return same(a)||same(b)?{ok:true,day:dayKey(a)}:{ok:false,reason:'date'};
  }

  /* ---------- pembatas percobaan ---------- */
  var GK='ca-auth-guard';
  function guardAll(){try{return JSON.parse(LS.get(GK))||{}}catch(_){return {}}}
  function guard(role){var g=guardAll()[role]||{};return {fails:g.fails||0,lockUntil:g.lockUntil||0,total:g.total||0,lastFail:g.lastFail||0}}
  function saveGuard(role,v){var g=guardAll();g[role]=v;LS.set(GK,JSON.stringify(g))}
  function recordFail(role,max,lockSec){
    var g=guard(role);g.fails+=1;g.total+=1;g.lastFail=Date.now();
    if(g.fails>=max){g.lockUntil=Date.now()+lockSec*1000;g.fails=0}
    saveGuard(role,g);return g;
  }
  function resetGuard(role){var g=guard(role);g.fails=0;g.lockUntil=0;saveGuard(role,g)}
  function lockedFor(role){var ms=guard(role).lockUntil-Date.now();return ms>0?Math.ceil(ms/1000):0}

  /* ---------- log aktivitas ---------- */
  var LK='ca-audit-log';
  function logs(){try{return JSON.parse(LS.get(LK))||[]}catch(_){return []}}
  function log(ev,role,detail){var a=logs();a.unshift({t:Date.now(),ev:ev,role:role||'-',detail:detail||''});LS.set(LK,JSON.stringify(a.slice(0,300)))}
  function clearLogs(){LS.del(LK)}

  /* ---------- sesi ---------- */
  var SK='ca-session',SIG='ca·sess·v1·7f3e';
  function sign(o){return H.hex([o.role,o.at,o.day,o.nonce,SIG].join('|'))}
  function createSession(role,day){
    var o={role:role,at:Date.now(),day:day||dayKey(),nonce:H.randomHex(12)};o.sig=sign(o);
    SS.set(SK,JSON.stringify(o));return o;
  }
  function getSession(){
    var o;try{o=JSON.parse(SS.get(SK))}catch(_){o=null}
    if(!o||!o.role||o.sig!==sign(o)){if(o)SS.del(SK);return null}
    if(o.role!=='admin'&&o.role!=='user')return null;
    /* sesi user berlaku untuk tanggal login saja */
    if(o.role==='user'&&o.day!==dayKey()&&o.day!==dayKey(todayParts('Asia/Jakarta'))){SS.del(SK);return null}
    return o;
  }
  function clearSession(){SS.del(SK)}

  root.CAAuth={
    verifyAdmin:verifyAdmin,makeKeyRecord:makeKeyRecord,
    verifyUser:verifyUser,parseDate:parseDate,dayKey:dayKey,
    guard:guard,recordFail:recordFail,resetGuard:resetGuard,lockedFor:lockedFor,
    log:log,logs:logs,clearLogs:clearLogs,
    createSession:createSession,getSession:getSession,clearSession:clearSession
  };
})(window);
