/* live-ticker.js — ticker header yang hanya menampilkan shift yang SEDANG BERJALAN
   di seluruh departemen (Content Analyst, Traffic, Compositor, Digital Imaging). */
(function(root){
  'use strict';
  var $=function(id){return document.getElementById(id)};
  var S=root.CAShift,esc=root.CATicker.esc;
  var rosters=null,lastSig='',loading=false,updatedAt=null,listeners=[];
  var SHORT={'CONTENT ANALYST':'CONTENT ANALYST','TRAFFIC':'TRAFFIC','COMPOSITOR':'COMPOSITOR','DIGITAL IMAGING':'DIGITAL IMAGING'};

  function summary(){
    var now=new Date();
    return S.DEPARTMENTS.map(function(d){
      return {dept:d,color:S.DEPT_COLOR[d],live:rosters?S.liveSlots(rosters,d,now):[],next:rosters?S.nextSlot(rosters,d,now):null};
    });
  }
  function render(){
    if(!rosters)return;
    var list=summary(),items=[];
    list.forEach(function(row){
      if(!row.live.length){
        items.push('<button type="button" class="live-item" data-dept="'+esc(row.dept)+'" title="Buka Shift Live '+esc(row.dept)+'"><span class="live-dept" style="--dc:'+row.color+'">'+esc(SHORT[row.dept])+'</span><span class="live-none">Tidak ada shift aktif</span></button>');
        return;
      }
      row.live.forEach(function(s){
        var names=s.members.map(function(n){return '<b>'+esc(n)+'</b>'}).join(' <span class="live-sep">·</span> ');
        items.push('<button type="button" class="live-item" data-dept="'+esc(row.dept)+'" title="Buka Shift Live '+esc(row.dept)+' · '+Math.round(s.progress*100)+'% berjalan"><span class="live-dept" style="--dc:'+row.color+'">'+esc(SHORT[row.dept])+'</span><span class="live-shift" style="--sc:'+s.color+'"><i></i>'+esc(s.title)+' · '+s.from+'–'+s.to+'</span><span class="live-names">'+names+'</span></button>');
      });
    });
    var sig=items.join('');
    if(sig!==lastSig){lastSig=sig;root.CATicker.set($('liveTrack'),sig,items.length,30)}
    listeners.forEach(function(fn){try{fn(list,updatedAt)}catch(e){console.error(e)}});
  }
  function setStatus(t,title){$('liveStatus').textContent=t;if(title)$('liveStatus').title=title}
  function load(){
    if(loading)return;loading=true;$('liveRefresh').classList.add('is-busy');setStatus('Sinkron…');
    S.loadAll().then(function(r){
      rosters=r;updatedAt=new Date();
      setStatus(new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit'}).format(updatedAt)+' WIB','Jadwal Google Sheets dimuat untuk '+Object.keys(r).join(' & ')+'. Sinkron otomatis setiap 5 menit.');
      render();
    }).catch(function(err){
      setStatus(rosters?'Data lama':'Gagal',err.message+' · klik ↻ untuk mencoba lagi');
      lastSig='';$('liveTrack').dataset.html='';if(!rosters)$('liveTrack').innerHTML='<span class="strip-empty">Jadwal belum dapat dimuat dari Google Sheets. Periksa koneksi lalu klik ↻.</span>';
    }).finally(function(){loading=false;$('liveRefresh').classList.remove('is-busy')});
  }
  $('liveRefresh').addEventListener('click',function(e){e.currentTarget.blur();load()});
  $('liveTrack').addEventListener('click',function(e){var b=e.target.closest('[data-dept]');if(b&&root.CAShell)root.CAShell.navigate('shift',{dept:b.dataset.dept})});
  load();setInterval(render,30000);setInterval(load,300000);
  root.addEventListener('online',load);
  document.addEventListener('visibilitychange',function(){if(!document.hidden)load()});
  root.CALive={summary:function(){return rosters?summary():null},updatedAt:function(){return updatedAt},onUpdate:function(fn){listeners.push(fn)},reload:load};
})(window);
