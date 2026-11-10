/* Beranda — ringkasan Live Shift semua departemen (data dari header). */
(function(){
  'use strict';
  var $=function(id){return document.getElementById(id)};
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  var fmt=new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});

  function greet(){
    var h=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jakarta',hour:'2-digit',hourCycle:'h23'}).format(new Date()));
    $('greet').textContent=h<11?'Selamat pagi':h<15?'Selamat siang':h<18?'Selamat sore':'Selamat malam';
  }
  greet();setInterval(greet,60000);

  document.addEventListener('click',function(e){
    var b=e.target.closest('[data-open]');if(b&&window.CA){CA.navigate(b.dataset.open,b.dataset.dept?{dept:b.dataset.dept}:null)}
  });

  function render(summary,updatedAt){
    if(!summary){$('liveMeta').textContent='Menunggu data jadwal… Jika lama, klik ↻ pada strip LIVE SHIFT di header.';return}
    $('liveMeta').textContent=updatedAt?'Sinkron '+fmt.format(new Date(updatedAt))+' WIB · klik kartu untuk membuka departemen.':'Klik kartu untuk membuka departemen.';
    var now=Date.now();
    $('liveGrid').innerHTML=summary.map(function(row,i){
      var slots=row.live.length?row.live.map(function(s){
        var pct=Math.max(0,Math.min(100,Math.round((now-s.start)/(s.end-s.start)*100)));
        return '<div class="lc-slot" style="--sc:'+esc(s.color)+'"><b>'+esc(s.title)+'</b><small>'+s.from+'–'+s.to+' WIB · '+pct+'%</small><div class="lc-bar"><i style="width:'+pct+'%"></i></div><div class="lc-names">'+s.members.map(function(n){return '<span>'+esc(n)+'</span>'}).join('')+'</div></div>';
      }).join(''):'<p class="lc-none">Tidak ada shift aktif saat ini.</p>';
      var next=row.next?'<p class="lc-next">Berikutnya: <b>'+esc(row.next.title)+'</b> · '+fmt.format(new Date(row.next.start))+' WIB · '+row.next.members.length+' orang</p>':'';
      return '<button type="button" class="live-card" data-open="shift" data-dept="'+esc(row.dept)+'" style="--dc:'+esc(row.color)+';animation-delay:'+(i*70)+'ms"><span class="lc-dept">'+esc(row.dept)+'</span>'+slots+next+'</button>';
    }).join('');
  }
  if(window.CA){
    CA.on('ca:live',function(d){render(d.summary,d.updatedAt)});
    CA.post('ca:live-request');
  }
})();
