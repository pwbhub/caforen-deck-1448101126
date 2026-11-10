/* ticker.js — utilitas ticker berjalan dengan kecepatan konstan (px/detik). */
(function(root){
  'use strict';
  function tune(track){
    var count=Number(track.dataset.count||0),speed=Number(track.dataset.speed||24);
    if(!count||track.children.length<=count){track.style.animation='none';return}
    var distance=track.children[count].offsetLeft-track.children[0].offsetLeft;
    if(distance<=0)return;
    track.style.animation='';
    track.style.setProperty('--dist',distance+'px');
    track.style.setProperty('--dur',Math.max(18,distance/speed).toFixed(2)+'s');
  }
  /* html: string satu putaran, count: jumlah elemen anak satu putaran */
  /* Isi baru hanya dipasang bila berbeda; animasi tetap berjalan (tidak dihentikan) dan
     kecepatannya dihitung ulang sesuai panjang konten baru. */
  function set(track,html,count,speed){
    var same=track.dataset.html===html;
    track.dataset.count=String(count);track.dataset.speed=String(speed||24);
    if(same){tune(track);return}
    track.dataset.html=html;
    var running=track.getAnimations?track.getAnimations()[0]:null,progress=0;
    if(running&&running.effect&&running.effect.getComputedTiming)progress=running.effect.getComputedTiming().progress||0;
    track.innerHTML=html+html;
    track.style.animation='none';void track.offsetWidth;track.style.animation='';
    tune(track);
    /* lanjutkan dari posisi relatif yang sama agar tidak meloncat ke awal */
    var a=track.getAnimations?track.getAnimations()[0]:null;
    if(a&&progress&&a.effect&&a.effect.getComputedTiming){var d=a.effect.getComputedTiming().duration;if(isFinite(d))a.currentTime=progress*d}
  }
  function tuneAll(){document.querySelectorAll('.track[data-count]').forEach(tune)}
  var t;window.addEventListener('resize',function(){clearTimeout(t);t=setTimeout(tuneAll,150)});
  /* setelah tab kembali aktif / koneksi pulih, pastikan ticker berjalan */
  document.addEventListener('visibilitychange',function(){if(!document.hidden)tuneAll()});window.addEventListener('online',tuneAll);
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(tuneAll);
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  root.CATicker={set:set,tune:tune,tuneAll:tuneAll,esc:esc};
})(window);
