/* news.js — RSS berita terkini (Detik, ANTARA, CNN Indonesia) di strip header.
   Logika asli Shift Live: gabung beberapa sumber, urut tanggal terbit terbaru,
   fallback via proxy RSS publik, cache 6 jam di localStorage, refresh 5 menit. */
(function(){
  'use strict';
  var $=function(id){return document.getElementById(id)};
  var esc=window.CATicker.esc;
  var NEWS_FEEDS=[{id:'detik',name:'Detik',url:'https://news.detik.com/berita/rss'},{id:'antara',name:'ANTARA',url:'https://www.antaranews.com/rss/terkini.xml'},{id:'cnn',name:'CNN Indonesia',url:'https://www.cnnindonesia.com/rss'}];
  var NEWS_CACHE_KEY='whisper-schedule-news-v3';
  var newsSig='',newsBusy=false,cache={};

  function request(url,asJSON){
    var controller=new AbortController(),timer=setTimeout(function(){controller.abort()},6500);
    return fetch(url,{signal:controller.signal,credentials:'omit'}).then(function(r){if(!r.ok)throw Error('HTTP '+r.status);return asJSON?r.json():r.text()}).finally(function(){clearTimeout(timer)});
  }
  function parseDate(value,jsonAdapter){var text=String(value||'').trim();if(!text)return NaN;if(jsonAdapter&&/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(text))text=text.replace(' ','T')+'Z';return Date.parse(text)}
  function normalize(item,feed){
    var title=String(item.title||'').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();
    var link=String(item.link||'').trim(),timestamp=Number(item.timestamp);
    if(!title||!Number.isFinite(timestamp)||!/^https?:\/\//i.test(link)||timestamp>Date.now()+5*60000)return null;
    return {title:title,link:link,timestamp:timestamp,source:feed.name,sourceID:feed.id};
  }
  function parseXML(text,feed){
    var doc=new DOMParser().parseFromString(text,'text/xml');if(doc.querySelector('parsererror'))throw Error('RSS tidak valid');
    var items=Array.prototype.map.call(doc.querySelectorAll('item, entry'),function(node){
      var t=function(tag){var n=node.querySelector(tag);return n?n.textContent:''};
      var linkNode=node.querySelector('link[rel="alternate"]')||node.querySelector('link');
      return normalize({title:t('title'),link:linkNode?(linkNode.getAttribute('href')||linkNode.textContent):'',timestamp:parseDate(t('pubDate')||t('published')||t('updated'))},feed);
    }).filter(Boolean);
    if(!items.length)throw Error('RSS kosong');return items.slice(0,30);
  }
  async function fetchSource(feed){
    try{return parseXML(await request(feed.url),feed)}catch(_){}
    try{return parseXML(await request('https://api.allorigins.win/raw?url='+encodeURIComponent(feed.url)),feed)}catch(_){}
    try{var data=await request('https://api.rss2json.com/v1/api.json?rss_url='+encodeURIComponent(feed.url),true);if(data.status!=='ok'||!Array.isArray(data.items))throw Error('x');var items=data.items.map(function(it){return normalize({title:it.title,link:it.link,timestamp:parseDate(it.pubDate,true)},feed)}).filter(Boolean);if(items.length)return items}catch(_){}
    return null;
  }
  function merge(batches){
    var all=[].concat.apply([],batches).filter(Boolean).sort(function(a,b){return b.timestamp-a.timestamp||a.source.localeCompare(b.source)});
    var seenU=new Set(),seenT=new Set();
    return all.filter(function(item){
      var canonical;try{var url=new URL(item.link);url.hash='';Array.from(url.searchParams.keys()).forEach(function(k){if(/^utm_|^fbclid$|^gclid$/i.test(k))url.searchParams.delete(k)});canonical=url.href}catch(_){return false}
      var title=item.title.toLowerCase().replace(/\s+/g,' ').trim();if(seenU.has(canonical)||seenT.has(title))return false;seenU.add(canonical);seenT.add(title);return true;
    }).slice(0,36);
  }
  function dateLabel(ts){
    var date=new Date(ts),key=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'});
    var hm=new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date);
    return key.format(date)===key.format(new Date())?hm+' WIB':new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',day:'numeric',month:'short'}).format(date)+' · '+hm;
  }
  function display(items){
    if(!items.length)return;
    var sig=items.map(function(i){return i.source+'|'+i.timestamp+'|'+i.link}).join('\n');if(sig===newsSig)return;newsSig=sig;
    var html=items.map(function(item){
      var full=item.source+' · '+new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',dateStyle:'medium',timeStyle:'short'}).format(new Date(item.timestamp));
      return '<a class="news-item" href="'+esc(item.link)+'" target="_blank" rel="noopener" title="'+esc(full)+'"><span class="news-src">'+esc(item.source)+'</span><span class="news-time">'+dateLabel(item.timestamp)+'</span><span>'+esc(item.title)+'</span></a>';
    }).join('');
    window.CATicker.set($('newsTrack'),html,items.length,22);
  }
  async function fetchNews(){
    if(newsBusy)return;newsBusy=true;
    try{
      var results=await Promise.all(NEWS_FEEDS.map(async function(feed){return {feed:feed,items:await fetchSource(feed)}}));
      var now=Date.now(),success=0;
      results.forEach(function(r){if(r.items&&r.items.length){cache[r.feed.id]={items:r.items,fetchedAt:now};success++}});
      var valid=NEWS_FEEDS.map(function(f){return cache[f.id]}).filter(function(g){return g&&now-g.fetchedAt<6*3600000});
      var merged=merge(valid.map(function(g){return g.items}));
      if(merged.length){
        display(merged);
        if(success){try{localStorage.setItem(NEWS_CACHE_KEY,JSON.stringify({sources:cache,checkedAt:now}))}catch(_){}}
        $('newsStatus').textContent=success?new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit'}).format(new Date(now)):'Tersimpan';
        $('newsStatus').title=success?success+' dari '+NEWS_FEEDS.length+' sumber diperiksa · urut terbit terbaru · refresh 5 menit':'Sumber belum merespons; menampilkan RSS tersimpan.';
      }else{
        if(!$('newsTrack').querySelector('a'))$('newsTrack').innerHTML='<span class="strip-empty">RSS berita belum dapat dimuat. Mencoba lagi otomatis…</span>';
        $('newsStatus').textContent='Belum tersedia';
      }
    }finally{newsBusy=false}
  }
  try{
    var saved=JSON.parse(localStorage.getItem(NEWS_CACHE_KEY)||'null');
    if(saved&&saved.sources){NEWS_FEEDS.forEach(function(feed){var g=saved.sources[feed.id];if(g&&Array.isArray(g.items)&&Number.isFinite(g.fetchedAt)&&Date.now()-g.fetchedAt<6*3600000){var items=g.items.map(function(i){return normalize(i,feed)}).filter(Boolean);if(items.length)cache[feed.id]={items:items,fetchedAt:g.fetchedAt}}});
      var m=merge(Object.keys(cache).map(function(k){return cache[k].items}));if(m.length){display(m);$('newsStatus').textContent='Tersimpan'}}
  }catch(_){}
  fetchNews();setInterval(fetchNews,300000);
})();
