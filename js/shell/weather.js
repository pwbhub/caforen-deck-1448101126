/* weather.js — Widget cuaca v4 (Open-Meteo, ikon Meteocons MIT) dari Shift Live,
   dipindahkan ke strip berita header. Logika validasi, cache, backoff, dan lokasi
   perangkat dipertahankan. Endpoint publik Open-Meteo untuk demo/nonkomersial. */
(function(){
  'use strict';
  var $=function(id){return document.getElementById(id)};
  var CFG={endpoint:'https://api.open-meteo.com/v1/forecast',refreshMs:15*60*1000,timeoutMs:10000,staleMs:45*60*1000,maxCacheMs:6*3600000,defaultLocation:{latitude:-6.1754,longitude:106.8272,label:'Jakarta Pusat',device:false},sourceURL:'https://open-meteo.com/'};
  var ICONS=window.CA_WEATHER_ICONS||{};
  var CACHE='whisper-current-weather-v4';
  var loc=Object.assign({},CFG.defaultLocation),data=null,controller=null,busy=false,failed=false,seq=0,nextTimer=null,lastAttempt=0,failures=0,iconKey='';
  var motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  function key(l){return Number(l.latitude).toFixed(4)+','+Number(l.longitude).toFixed(4)}
  function num(v,min,max){if(v===null||v===undefined||String(v).trim()==='')return null;var n=Number(v);return Number.isFinite(n)&&n>=min&&n<=max?n:null}
  function condition(code,isDay){
    var c=Number(code),day=isDay===1;
    var names={0:'Cerah',1:'Sebagian besar cerah',2:'Cerah berawan',3:'Berawan tebal',45:'Berkabut',48:'Kabut beku',51:'Gerimis ringan',53:'Gerimis',55:'Gerimis lebat',56:'Gerimis beku ringan',57:'Gerimis beku',61:'Hujan ringan',63:'Hujan',65:'Hujan lebat',66:'Hujan beku ringan',67:'Hujan beku',71:'Salju ringan',73:'Salju',75:'Salju lebat',77:'Butiran salju',80:'Hujan sesaat ringan',81:'Hujan sesaat',82:'Hujan sesaat lebat',85:'Salju sesaat ringan',86:'Salju sesaat lebat',95:'Hujan petir',96:'Petir dan hujan es ringan',97:'Hujan petir lebat',99:'Petir dan hujan es lebat'};
    var icon='cloudy';if(c===0||c===1)icon=day?'clear-day':'clear-night';else if(c===2)icon=day?'partly-cloudy-day':'partly-cloudy-night';else if(c===45||c===48)icon='fog';else if([95,96,97,99].indexOf(c)>=0)icon='thunderstorms';else if([71,73,75,77,85,86].indexOf(c)>=0)icon='snow';else if([51,53,55,56,57,61,63,65,66,67,80,81,82].indexOf(c)>=0)icon='rain';
    return {text:names[c]||'Kondisi belum terklasifikasi',icon:icon};
  }
  function syncMotion(){var svg=$('weatherSymbol').querySelector('svg');if(!svg)return;try{if(motion.matches){svg.setCurrentTime&&svg.setCurrentTime(1);svg.pauseAnimations&&svg.pauseAnimations()}else if(document.hidden)svg.pauseAnimations&&svg.pauseAnimations();else svg.unpauseAnimations&&svg.unpauseAnimations()}catch(_){}}
  function setIcon(icon){if(icon===iconKey)return;iconKey=icon;$('weatherSymbol').innerHTML=ICONS[icon]||'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><path d="M10 9a2 2 0 1 1 3 2c-1 0-1 1-1 2m0 3h.01"/></svg>';syncMotion()}
  function stamp(ts){var d=new Date(ts),k=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'});var label=new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(d);if(k.format(d)!==k.format(new Date()))label=new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',day:'numeric',month:'short'}).format(d)+' · '+label;return label+' WIB'}
  function parse(payload,location,now){
    location=location||loc;now=now||Date.now();
    if(payload&&payload.error)throw Error('API cuaca menolak permintaan');var cur=payload&&payload.current;if(!cur)throw Error('Kondisi terkini tidak tersedia');
    var temp=num(cur.temperature_2m,-90,65),epoch=num(cur.time,1,1e12),code=num(cur.weather_code,0,999),isDay=num(cur.is_day,0,1);
    if(temp===null||epoch===null||code===null||isDay===null)throw Error('Data cuaca tidak lengkap');
    var validAt=epoch*1000;if(validAt>now+10*60000||now-validAt>CFG.maxCacheMs)throw Error('Waktu data sumber tidak valid');
    if(payload.current_units&&payload.current_units.temperature_2m&&payload.current_units.temperature_2m!=='°C')throw Error('Satuan suhu bukan Celsius');
    return {temp:temp,code:code,isDay:isDay,humidity:num(cur.relative_humidity_2m,0,100),feelsLike:num(cur.apparent_temperature,-110,85),wind:num(cur.wind_speed_10m,0,450),rain:num(cur.precipitation,0,1000),validAt:validAt,receivedAt:now,location:Object.assign({},location),key:key(location)};
  }
  function render(){
    if(!data)return;var cond=condition(data.code,data.isDay),stale=failed||Date.now()-data.validAt>CFG.staleMs;
    setIcon(cond.icon);$('weatherTemperature').textContent=Math.round(data.temp)+'°C';$('weatherSummary').textContent=cond.text;$('weatherLocationLabel').textContent=data.location.label;
    $('weatherNow').dataset.state=stale?'stale':'current';
    var st=$('weatherStatus');st.replaceChildren(document.createTextNode((stale?'Data tersimpan · ':'Data berlaku ')+stamp(data.validAt)+' · sumber '));var a=document.createElement('a');a.href=CFG.sourceURL;a.target='_blank';a.rel='noopener';a.textContent='Open-Meteo';st.append(a);
    var facts=[];if(data.feelsLike!==null)facts.push('Terasa '+Math.round(data.feelsLike)+'°C');if(data.humidity!==null)facts.push('Kelembapan '+Math.round(data.humidity)+'%');if(data.wind!==null)facts.push('Angin '+data.wind.toFixed(1).replace('.',',')+' km/jam');if(data.rain!==null)facts.push('Presipitasi '+data.rain.toFixed(1).replace('.',',')+' mm');if(data.location.device)facts.push('Lokasi '+key(data.location));
    $('weatherFacts').replaceChildren.apply($('weatherFacts'),facts.map(function(t){var s=document.createElement('span');s.textContent=t;return s}));
    $('weatherToggle').title=cond.text+' · '+Math.round(data.temp)+'°C · berlaku '+stamp(data.validAt)+' (klik untuk detail)';
  }
  function empty(msg){setIcon('unknown');$('weatherTemperature').textContent='--°';$('weatherSummary').textContent=msg||'Cuaca belum tersedia';$('weatherLocationLabel').textContent=loc.label;$('weatherNow').dataset.state='unavailable';$('weatherFacts').replaceChildren()}
  function plan(delay){clearTimeout(nextTimer);nextTimer=setTimeout(function(){if(!document.hidden)fetchWx();else plan()},delay==null?CFG.refreshMs:delay)}
  async function fetchWx(){
    if(busy)return;busy=true;lastAttempt=Date.now();var s=++seq,location=Object.assign({},loc);controller=new AbortController();var ctl=controller,timer=setTimeout(function(){ctl.abort()},CFG.timeoutMs);
    var refresh=$('weatherRefresh');refresh.disabled=true;refresh.classList.add('is-refreshing');$('weatherLocate').disabled=true;
    if(!data){$('weatherNow').dataset.state='loading';$('weatherStatus').textContent='Mengambil data terbaru…'}
    try{
      if(navigator.onLine===false)throw Error('Perangkat offline');
      var params=new URLSearchParams({latitude:Number(location.latitude).toFixed(4),longitude:Number(location.longitude).toFixed(4),current:'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m',timezone:'Asia/Jakarta',timeformat:'unixtime',temperature_unit:'celsius',wind_speed_unit:'kmh',precipitation_unit:'mm',forecast_days:'1'});
      var res=await fetch(CFG.endpoint+'?'+params.toString(),{signal:ctl.signal,credentials:'omit',cache:'default'});if(!res.ok)throw Error('HTTP '+res.status);
      var d=parse(await res.json(),location);if(s!==seq||d.key!==key(loc))return;
      data=d;failed=false;failures=0;if(!location.device)try{localStorage.setItem(CACHE,JSON.stringify(d))}catch(_){}
      render();
    }catch(err){
      if(s!==seq)return;failed=true;failures++;
      if(data&&data.key===key(loc))render();else{empty();$('weatherStatus').textContent=navigator.onLine===false?'Offline · mencoba lagi saat terhubung':'Sumber belum merespons · coba perbarui'}
    }finally{
      clearTimeout(timer);
      if(s===seq){busy=false;controller=null;refresh.disabled=false;refresh.classList.remove('is-refreshing');$('weatherLocate').disabled=false;plan(failed?Math.min(CFG.refreshMs,60000*Math.pow(2,Math.min(failures,4))):CFG.refreshMs)}
    }
  }
  function setLocation(l){seq++;controller&&controller.abort();busy=false;loc=Object.assign({},l);data=null;failed=false;failures=0;empty('Memuat cuaca');$('weatherStatus').textContent='Mengambil data lokasi baru…';var b=$('weatherLocate');b.dataset.active=String(l.device);b.title=l.device?'Kembali ke Jakarta Pusat':'Gunakan lokasi perangkat · koordinat dikirim ke Open-Meteo';fetchWx()}
  function locate(){
    if(busy)return;if(loc.device){setLocation(CFG.defaultLocation);return}
    if(!navigator.geolocation){$('weatherStatus').textContent='Lokasi tidak didukung · tetap Jakarta Pusat';return}
    $('weatherLocate').disabled=true;$('weatherStatus').textContent='Menunggu izin lokasi perangkat…';
    navigator.geolocation.getCurrentPosition(function(pos){var la=num(pos.coords.latitude,-90,90),lo=num(pos.coords.longitude,-180,180);if(la===null||lo===null){$('weatherLocate').disabled=false;$('weatherStatus').textContent='Koordinat tidak valid';return}setLocation({latitude:la,longitude:lo,label:'Lokasi perangkat',device:true})},function(e){$('weatherLocate').disabled=false;if(data)render();$('weatherStatus').textContent=e.code===1?'Lokasi tidak diizinkan · tetap Jakarta Pusat':'Lokasi belum ditemukan · tetap Jakarta Pusat'},{enableHighAccuracy:false,timeout:10000,maximumAge:300000});
  }
  /* popover detail */
  var pop=$('weatherPop');
  function placePop(){var strip=document.querySelector('.mh-news'),wx=$('weatherNow');pop.style.top=(strip.offsetTop+strip.offsetHeight+6)+'px';var left=Math.max(12,Math.min(wx.offsetLeft,window.innerWidth-pop.offsetWidth-12));pop.style.left=left+'px'}
  function togglePop(open){open=open==null?pop.hidden:open;pop.hidden=!open;$('weatherToggle').setAttribute('aria-expanded',String(open));if(open)placePop()}
  $('weatherToggle').addEventListener('click',function(){togglePop()});
  $('weatherClose').addEventListener('click',function(){togglePop(false)});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!pop.hidden)togglePop(false)});
  document.addEventListener('pointerdown',function(e){if(!pop.hidden&&!pop.contains(e.target)&&!$('weatherNow').contains(e.target))togglePop(false)});
  window.addEventListener('resize',function(){if(!pop.hidden)placePop()});

  $('weatherRefresh').addEventListener('click',fetchWx);$('weatherLocate').addEventListener('click',locate);$('weatherLocate').title='Gunakan lokasi perangkat · koordinat dikirim ke Open-Meteo';
  motion.addEventListener&&motion.addEventListener('change',syncMotion);
  document.addEventListener('visibilitychange',function(){syncMotion();if(!document.hidden&&Date.now()-lastAttempt>=CFG.refreshMs)fetchWx()});
  window.addEventListener('online',function(){if(failed||!data)fetchWx()});
  window.addEventListener('offline',function(){failed=true;if(data)render();else{empty();$('weatherStatus').textContent='Offline · menunggu koneksi'}});
  setIcon('unknown');
  try{var saved=JSON.parse(localStorage.getItem(CACHE)||'null');if(saved&&!(saved.location&&saved.location.device)&&saved.key===key(CFG.defaultLocation)&&Number.isFinite(saved.validAt)&&Date.now()-saved.validAt>=0&&Date.now()-saved.validAt<CFG.maxCacheMs&&num(saved.temp,-90,65)!==null&&num(saved.code,0,999)!==null&&[0,1].indexOf(saved.isDay)>=0){data=Object.assign({},saved,{location:Object.assign({},CFG.defaultLocation)});failed=Date.now()-saved.receivedAt>CFG.refreshMs;render()}}catch(_){}
  $('weatherExplanation').innerHTML='Kondisi terkini dari model cuaca, bukan sensor langsung. Diperiksa setiap 15 menit; waktu yang tampil adalah waktu berlaku data sumber. Lokasi perangkat hanya dipakai setelah izin dan tidak disimpan. <a href="https://open-meteo.com/en/pricing" target="_blank" rel="noopener">API publik untuk demo/nonkomersial</a>. Ikon <a href="https://github.com/basmilius/meteocons" target="_blank" rel="noopener">Meteocons</a> (MIT).';
  fetchWx();setInterval(function(){if(data)render()},60000);
})();
