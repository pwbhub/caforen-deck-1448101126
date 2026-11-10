/* gate.js — antarmuka gerbang masuk.
   User  : ketik tanggal hari ini → masuk tampilan User (hasil pengaturan Admin).
   Admin : private key (diverifikasi lewat hash, lihat core/auth.js) → Konsol Admin.
   Salah input → peringatan di form, kartu bergetar, sisa percobaan, dan
   penguncian sementara setelah batas tercapai (berlaku untuk kedua peran). */
(function(root){
  'use strict';
  var $=function(id){return document.getElementById(id)};
  var AUTH=root.CAAuth,C=root.CAConfig,SH=root.CAShell;
  var gate=$('gate'),card=$('gateCard');
  var forms={user:$('formUser'),admin:$('formAdmin')},inputs={user:$('userDate'),admin:$('adminKey')},warns={user:$('userWarn'),admin:$('adminWarn')};
  var role='user',lockTimer=null;
  try{var r=localStorage.getItem('ca-gate-role');if(r==='admin'||r==='user')role=r}catch(_){}

  function cfg(){return C.get()}
  function setRole(r){
    role=r;try{localStorage.setItem('ca-gate-role',r)}catch(_){}
    ['user','admin'].forEach(function(k){
      $(k==='user'?'tabUser':'tabAdmin').setAttribute('aria-selected',String(k===r));
      forms[k].hidden=k!==r;
    });
    refreshLocks();
    setTimeout(function(){try{inputs[r].focus()}catch(_){}},30);
  }
  $('tabUser').addEventListener('click',function(){setRole('user')});
  $('tabAdmin').addEventListener('click',function(){setRole('admin')});

  function warn(r,msg){var w=warns[r];w.hidden=!msg;w.textContent=msg||'';forms[r].classList.toggle('is-bad',!!msg)}
  function shake(){card.classList.remove('shake');void card.offsetWidth;card.classList.add('shake');setTimeout(function(){card.classList.remove('shake')},600)}

  /* peringatan bersama untuk semua peran */
  function sharedAlert(){
    var u=AUTH.guard('user'),a=AUTH.guard('admin'),parts=[];
    var lu=AUTH.lockedFor('user'),la=AUTH.lockedFor('admin');
    if(u.fails)parts.push('User salah '+u.fails+'×');
    if(a.fails)parts.push('Admin salah '+a.fails+'×');
    if(lu)parts.push('form User dikunci '+lu+' dtk');
    if(la)parts.push('form Admin dikunci '+la+' dtk');
    var el=$('gateAlert');
    if(!parts.length){el.hidden=true;return}
    var last=Math.max(u.lastFail||0,a.lastFail||0);
    $('gateAlertText').textContent=parts.join(' · ')+(last?' — percobaan terakhir '+new Date(last).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}):'')+'. Semua percobaan dicatat.';
    el.hidden=false;
  }
  function refreshLocks(){
    clearInterval(lockTimer);
    var anyLocked=false;
    ['user','admin'].forEach(function(r){
      var s=AUTH.lockedFor(r),btn=forms[r].querySelector('.gate-go');
      inputs[r].disabled=!!s;btn.disabled=!!s;
      if(s){anyLocked=true;warn(r,'⛔ Terlalu banyak percobaan salah. Form '+(r==='admin'?'Admin':'User')+' dikunci '+s+' detik.')}
      else if(warns[r].textContent.indexOf('⛔')===0)warn(r,'');
    });
    sharedAlert();
    if(anyLocked)lockTimer=setInterval(refreshLocks,1000);
  }

  function failedSinceLastLogin(){
    var n=0,logs=AUTH.logs();
    for(var i=0;i<logs.length;i++){if(logs[i].ev==='login')break;if(logs[i].ev==='login-fail')n++}
    return n;
  }
  function success(r,day){
    var prevFails=failedSinceLastLogin();
    AUTH.resetGuard(r);AUTH.log('login',r,r==='admin'?'Masuk sebagai Admin':'Masuk sebagai User');
    inputs.user.value='';inputs.admin.value='';warn('user','');warn('admin','');
    var sess=AUTH.createSession(r,day);
    SH.start(sess);
    if(prevFails)setTimeout(function(){SH.toast('⚠ Peringatan keamanan',prevFails+' percobaan masuk gagal tercatat sejak login terakhir.'+(r==='admin'?' Lihat Konsol Admin → Log.':''),true)},600);
    else SH.toast(r==='admin'?'Selamat datang, Admin':'Selamat datang',r==='admin'?'Konsol Admin siap. Perubahan langsung terlihat di tampilan User.':'Selamat bekerja!');
  }
  function fail(r,msg){
    var c=cfg(),g=AUTH.recordFail(r,c.security.maxAttempts,c.security.lockSec);
    AUTH.log('login-fail',r,msg);
    shake();inputs[r].select();
    if(g.lockUntil>Date.now()){AUTH.log('lockout',r,'Form dikunci '+c.security.lockSec+' detik');refreshLocks();return}
    warn(r,'⚠ '+msg+' Sisa '+(c.security.maxAttempts-g.fails)+' percobaan sebelum form dikunci.');
    sharedAlert();
  }

  forms.user.addEventListener('submit',function(e){
    e.preventDefault();
    if(AUTH.lockedFor('user'))return refreshLocks();
    var v=inputs.user.value.trim();
    if(!v){warn('user','⚠ Tanggal belum diisi.');shake();return}
    var res=AUTH.verifyUser(v);
    if(res.ok)return success('user',res.day);
    fail('user',res.reason==='format'?'Format tanggal tidak dikenali (gunakan tanggal, bulan, tahun).':'Tanggal tidak sesuai dengan hari ini.');
  });
  forms.admin.addEventListener('submit',function(e){
    e.preventDefault();
    if(AUTH.lockedFor('admin'))return refreshLocks();
    var v=inputs.admin.value;
    if(!v){warn('admin','⚠ Private key belum diisi.');shake();return}
    if(AUTH.verifyAdmin(v,cfg().security.adminKey))return success('admin');
    fail('admin','Private key salah.');
  });
  ['user','admin'].forEach(function(r){inputs[r].addEventListener('input',function(){if(warns[r].textContent.indexOf('⛔')!==0){forms[r].classList.remove('is-bad')}})});

  $('adminEye').addEventListener('click',function(){var on=inputs.admin.type==='password';inputs.admin.type=on?'text':'password';this.setAttribute('aria-pressed',String(on));this.setAttribute('aria-label',on?'Sembunyikan kunci':'Tampilkan kunci')});
  function caps(e){if(e.getModifierState)$('adminCaps').hidden=!e.getModifierState('CapsLock')}
  inputs.admin.addEventListener('keydown',caps);inputs.admin.addEventListener('keyup',caps);

  var REASONS={manual:['Anda telah sign out','Sampai jumpa lagi.'],idle:['Sign out otomatis','Sesi berakhir karena tidak ada aktivitas.'],expired:['Sesi berakhir','Tanggal berganti — silakan masuk lagi.'],'unlock-fail':['Sign out paksa','Kunci salah berulang kali saat membuka screensaver.']};
  function show(reason,lastRole){
    gate.hidden=false;
    if(lastRole)setRole(lastRole);else setRole(role);
    refreshLocks();
    var m=REASONS[reason];if(m)SH.toast(m[0],m[1],reason==='unlock-fail');
  }

  root.CAGate={show:show};

  /* mulai: lanjutkan sesi tab ini bila masih sah */
  var sess=AUTH.getSession();
  if(sess){gate.hidden=true;SH.start(sess)}
  else show();
})(window);
