/* ==========================================================================
   Feed berita Jakarta (Beranda) — kartu bergambar dari RSS publik beberapa media.
   - Sumber: Detik, Tempo (Metro), CNN Indonesia, ANTARA (Megapolitan), Suara,
     CNBC Indonesia, Okezone. Sumber yang gagal dilewati tanpa mengganggu yang lain.
   - Gambar diambil dari enclosure / media:content / media:thumbnail / <img> deskripsi.
   - Jalur ambil: langsung → proxy AllOrigins → konverter rss2json (agar jalan di file://).
   - Urut terbit terbaru, duplikat dibuang, cache 60 menit, refresh otomatis 10 menit.
   ========================================================================== */
(function(){
  'use strict';
  var $=function(id){return document.getElementById(id)};
  var SOURCES=[
    {id:'detik',name:'Detik',color:'#7CC4FF',feeds:[{url:'https://news.detik.com/berita/rss'},{url:'https://rss.detik.com/index.php/metro',jakarta:true}]},
    {id:'tempo',name:'Tempo',color:'#F6E000',feeds:[{url:'https://rss.tempo.co/metro',jakarta:true},{url:'https://rss.tempo.co/nasional'}]},
    {id:'cnn',name:'CNN Indonesia',color:'#FF6B57',feeds:[{url:'https://www.cnnindonesia.com/nasional/rss'},{url:'https://www.cnnindonesia.com/rss'}]},
    {id:'antara',name:'ANTARA',color:'#5EE6B5',feeds:[{url:'https://megapolitan.antaranews.com/rss/terkini.xml',jakarta:true},{url:'https://www.antaranews.com/rss/terkini.xml'}]},
    {id:'suara',name:'Suara',color:'#FFA94D',feeds:[{url:'https://www.suara.com/rss/news'}]},
    {id:'cnbc',name:'CNBC Indonesia',color:'#B9A4FF',feeds:[{url:'https://www.cnbcindonesia.com/news/rss'}]},
    {id:'okezone',name:'Okezone',color:'#C6F21B',feeds:[{url:'https://sindikasi.okezone.com/index.php/rss/1/RSS2.0'}]}
  ];
  var byId={};SOURCES.forEach(function(s){byId[s.id]=s});
  var JKT=/\b(jakarta|dki|jabodetabek|jaksel|jaktim|jakbar|jakut|jakpus|bekasi|depok|tangerang|bogor|kepulauan seribu|balai kota|transjakarta|mrt|lrt jakarta|krl|polda metro|monas|ancol|kemayoran|senayan|gbk|tanjung priok|cengkareng|pramono|rano karno|pemprov dki|bundaran hi|sudirman|thamrin|kuningan|menteng|cilincing|kalideres|pasar minggu|kebayoran|grogol|pluit|ragunan)\b/i;
  var CACHE='ca-newsfeed-v1',PAGE=13,REFRESH=10*60*1000;
  var all=[],filter='all',jakartaOnly=true,shown=PAGE,busy=false,okSources={};
  try{var pf=JSON.parse(localStorage.getItem('ca-newsfeed-pref')||'{}');if(typeof pf.jkt==='boolean')jakartaOnly=pf.jkt;if(pf.src&&(pf.src==='all'||byId[pf.src]))filter=pf.src}catch(_){}
  function savePref(){try{localStorage.setItem('ca-newsfeed-pref',JSON.stringify({jkt:jakartaOnly,src:filter}))}catch(_){}}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}

  /* ---------- ambil RSS ---------- */
  function req(url,json){
    var c=new AbortController(),t=setTimeout(function(){c.abort()},8000);
    return fetch(url,{signal:c.signal,credentials:'omit'}).then(function(r){if(!r.ok)throw Error('HTTP '+r.status);return json?r.json():r.text()}).finally(function(){clearTimeout(t)});
  }
  function textOf(html){if(!html)return '';var d=new DOMParser().parseFromString('<body>'+html+'</body>','text/html');return (d.body.textContent||'').replace(/\s+/g,' ').trim()}
  function firstImg(html){var m=/<img[^>]+src=["']([^"']+)["']/i.exec(html||'');return m?m[1]:''}
  function bigger(u){
    if(!u)return '';u=u.replace(/&amp;/g,'&').trim();if(u.indexOf('//')===0)u='https:'+u;
    if(!/^https?:\/\//i.test(u))return '';
    return u.replace(/([?&])w=\d+/,'$1w=640').replace(/([?&])h=\d+/,'$1h=400');
  }
  function clean(title,desc){
    var cap=textOf(desc);
    if(!cap||cap===title)return '';
    if(cap.indexOf(title)===0)cap=cap.slice(title.length).trim();
    if(cap.length>230)cap=cap.slice(0,227).replace(/\s+\S*$/,'')+'…';
    return cap;
  }
  function norm(o,src,feed){
    var title=textOf(o.title);var link=String(o.link||'').trim();var ts=Date.parse(o.date||'');
    if(!title||!/^https?:\/\//i.test(link)||!Number.isFinite(ts)||ts>Date.now()+10*60000)return null;
    var caption=clean(title,o.desc);
    return {title:title,link:link,ts:ts,img:bigger(o.img),caption:caption,src:src.id,jakarta:!!feed.jakarta||JKT.test(title+' '+caption)};
  }
  function parseXML(text,src,feed){
    var doc=new DOMParser().parseFromString(text,'text/xml');if(doc.querySelector('parsererror'))throw Error('xml');
    var nodes=Array.prototype.slice.call(doc.querySelectorAll('item, entry'));
    var items=nodes.map(function(n){
      var g=function(tag){var x=n.getElementsByTagName(tag)[0];return x?x.textContent:''};
      var linkNode=n.querySelector('link[rel="alternate"]')||n.querySelector('link');
      var desc=g('description')||g('content:encoded')||g('summary')||g('content');
      var img='';
      var enc=n.getElementsByTagName('enclosure')[0];if(enc&&/image|jpe?g|png|webp/i.test((enc.getAttribute('type')||'')+(enc.getAttribute('url')||'')))img=enc.getAttribute('url');
      if(!img){var mc=n.getElementsByTagNameNS('*','content');for(var i=0;i<mc.length&&!img;i++){var u=mc[i].getAttribute('url');if(u&&(!mc[i].getAttribute('medium')||mc[i].getAttribute('medium')==='image'))img=u}}
      if(!img){var mt=n.getElementsByTagNameNS('*','thumbnail')[0];if(mt)img=mt.getAttribute('url')||mt.textContent}
      if(!img){var im=n.getElementsByTagName('image')[0];if(im)img=(im.getElementsByTagName('url')[0]||im).textContent}
      if(!img)img=firstImg(desc)||firstImg(g('content:encoded'));
      return norm({title:g('title'),link:linkNode?(linkNode.getAttribute('href')||linkNode.textContent):'',date:g('pubDate')||g('published')||g('updated')||g('dc:date'),desc:desc,img:img},src,feed);
    }).filter(Boolean);
    if(!items.length)throw Error('kosong');return items;
  }
  function fromJSON(d,src,feed){
    if(!d||d.status!=='ok'||!Array.isArray(d.items))throw Error('json');
    var items=d.items.map(function(it){
      var date=it.pubDate&&/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(it.pubDate)?it.pubDate.replace(' ','T')+'Z':it.pubDate;
      var img=it.thumbnail||(it.enclosure&&it.enclosure.link&&/image|jpe?g|png|webp/i.test((it.enclosure.type||'')+it.enclosure.link)?it.enclosure.link:'')||firstImg(it.description)||firstImg(it.content);
      return norm({title:it.title,link:it.link,date:date,desc:it.description||it.content,img:img},src,feed);
    }).filter(Boolean);
    if(!items.length)throw Error('kosong');return items;
  }
  function any(ps){return new Promise(function(res,rej){var n=ps.length;ps.forEach(function(p){p.then(res,function(){if(--n===0)rej(Error('gagal'))})})})}
  function fetchFeed(src,feed){
    var u=feed.url;
    return any([
      req(u).then(function(t){return parseXML(t,src,feed)}),
      req('https://api.allorigins.win/raw?url='+encodeURIComponent(u)).then(function(t){return parseXML(t,src,feed)}),
      req('https://api.rss2json.com/v1/api.json?rss_url='+encodeURIComponent(u),true).then(function(d){return fromJSON(d,src,feed)})
    ]);
  }
  function fetchSource(src){
    return Promise.all(src.feeds.map(function(f){return fetchFeed(src,f).catch(function(){return []})})).then(function(lists){return [].concat.apply([],lists)});
  }
  function merge(list){
    list.sort(function(a,b){return b.ts-a.ts});
    var seenL=new Set(),seenT=new Set();
    return list.filter(function(it){
      var l=it.link.replace(/[?#].*$/,''),t=it.title.toLowerCase().replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim();
      if(seenL.has(l)||seenT.has(t))return false;seenL.add(l);seenT.add(t);return true;
    }).slice(0,160);
  }

  /* ---------- tampilan ---------- */
  var timeFmt=new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  var dayFmt=new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',day:'numeric',month:'short'});
  function ago(ts){var m=Math.max(0,Math.round((Date.now()-ts)/60000));if(m<1)return 'baru saja';if(m<60)return m+' mnt lalu';var h=Math.floor(m/60);if(h<24)return h+' jam lalu';return dayFmt.format(new Date(ts))}
  function initials(name){return name.split(/\s+/).map(function(w){return w[0]}).join('').slice(0,3).toUpperCase()}
  function visible(){return all.filter(function(it){return (filter==='all'||it.src===filter)&&(!jakartaOnly||it.jakarta)})}
  function card(it,i){
    var s=byId[it.src],cls='nf-card'+(i===0?' nf-feature':(i===5||i===10)?' nf-wide':'');
    var fresh=Date.now()-it.ts<30*60000;
    var media='<div class="nf-media"><div class="nf-ph"><span>'+esc(initials(s.name))+'</span></div>'+(it.img?'<img src="'+esc(it.img)+'" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">':'')+'<span class="nf-badge">'+esc(s.name)+'</span><span class="nf-time">'+timeFmt.format(new Date(it.ts))+'</span>'+(fresh&&i!==0?'<span class="nf-new">BARU</span>':'')+'</div>';
    return '<a class="'+cls+'" data-ts="'+it.ts+'" href="'+esc(it.link)+'" target="_blank" rel="noopener" style="--sc:'+s.color+';animation-delay:'+Math.min(i,12)*45+'ms" title="'+esc(s.name+' · '+timeFmt.format(new Date(it.ts))+' WIB')+'">'+media+
      '<div class="nf-body">'+(i===0?'<span class="nf-kick">'+(fresh?'TERBARU · ':'')+'SOROTAN</span>':'')+'<h3>'+esc(it.title)+'</h3>'+(it.caption?'<p>'+esc(it.caption)+'</p>':'')+
      '<div class="nf-foot"><span><b>'+esc(s.name)+'</b> · <em class="nf-ago">'+ago(it.ts)+'</em></span><span class="nf-read">Baca ↗</span></div></div></a>';
  }
  function render(){
    var list=visible(),grid=$('nfGrid');
    if(!all.length)return;
    if(!list.length){
      grid.innerHTML='<div class="nf-empty">Belum ada berita '+(jakartaOnly?'bertema Jakarta ':'')+(filter!=='all'?'dari '+esc(byId[filter].name)+' ':'')+'saat ini. '+(jakartaOnly?'Matikan “Fokus Jakarta” untuk melihat semua berita terkini.':'Coba pilih sumber lain.')+'</div>';
      $('nfMore').hidden=true;return;
    }
    grid.innerHTML=list.slice(0,shown).map(card).join('');
    grid.querySelectorAll('.nf-media img').forEach(function(img){
      var done=function(){if(img.naturalWidth>40)img.classList.add('ok');else img.remove()};
      if(img.complete)done();else{img.addEventListener('load',done);img.addEventListener('error',function(){img.remove()})}
    });
    $('nfMore').hidden=list.length<=shown;
  }
  function renderFilters(){
    var counts={};all.forEach(function(it){if(!jakartaOnly||it.jakarta)counts[it.src]=(counts[it.src]||0)+1});
    var total=Object.keys(counts).reduce(function(a,k){return a+counts[k]},0);
    $('nfFilters').innerHTML='<button type="button" data-src="all" aria-pressed="'+(filter==='all')+'">Semua <small>'+total+'</small></button>'+
      SOURCES.filter(function(s){return okSources[s.id]}).map(function(s){return '<button type="button" data-src="'+s.id+'" style="--sc:'+s.color+'" aria-pressed="'+(filter===s.id)+'"><i></i>'+esc(s.name)+' <small>'+(counts[s.id]||0)+'</small></button>'}).join('');
  }
  function status(t){$('nfStatus').textContent=t}
  function apply(items,fromCache,at){
    all=merge(items);okSources={};all.forEach(function(it){okSources[it.src]=true});
    if(filter!=='all'&&!okSources[filter])filter='all';
    renderFilters();render();
    status((fromCache?'Tersimpan · ':'Diperbarui ')+timeFmt.format(new Date(at||Date.now()))+' WIB · '+Object.keys(okSources).length+' media');
  }
  function load(){
    if(busy)return;busy=true;$('nfRefresh').disabled=true;status('Mengambil berita terbaru…');
    Promise.all(SOURCES.map(function(s){return fetchSource(s).catch(function(){return []})})).then(function(lists){
      var items=[].concat.apply([],lists);
      if(items.length){apply(items,false);try{localStorage.setItem(CACHE,JSON.stringify({at:Date.now(),items:all}))}catch(_){}}
      else if(!all.length){$('nfGrid').innerHTML='<div class="nf-empty">Feed berita belum dapat dimuat (sumber RSS atau proxy sedang tidak merespons). Periksa koneksi internet lalu klik “Muat ulang”.</div>';status('Belum tersedia')}
      else status('Sumber belum merespons · menampilkan data tersimpan');
    }).finally(function(){busy=false;$('nfRefresh').disabled=false});
  }

  /* ---------- event ---------- */
  $('nfFilters').addEventListener('click',function(e){var b=e.target.closest('[data-src]');if(!b)return;filter=b.dataset.src;shown=PAGE;savePref();renderFilters();render()});
  $('nfJakarta').checked=jakartaOnly;
  $('nfJakarta').addEventListener('change',function(){jakartaOnly=this.checked;shown=PAGE;savePref();renderFilters();render()});
  $('nfRefresh').addEventListener('click',function(){this.blur();load()});
  $('nfMore').addEventListener('click',function(){shown+=12;render()});
  /* perbarui label "x mnt lalu" tiap menit tanpa memuat ulang */
  setInterval(function(){document.querySelectorAll('.nf-card[data-ts]').forEach(function(c){var e=c.querySelector('.nf-ago');if(e)e.textContent=ago(Number(c.dataset.ts))})},60000);

  try{var c=JSON.parse(localStorage.getItem(CACHE)||'null');if(c&&Array.isArray(c.items)&&Date.now()-c.at<60*60000&&c.items.length)apply(c.items.filter(function(it){return it&&byId[it.src]&&it.title&&it.link}),true,c.at)}catch(_){}
  load();setInterval(function(){if(!document.hidden)load()},REFRESH);
})();
