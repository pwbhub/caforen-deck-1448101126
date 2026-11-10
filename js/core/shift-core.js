/* ==========================================================================
   shift-core.js — logika jadwal shift bersama (dipakai ticker Live Shift header)
   Sumber data dan aturan jam identik dengan halaman Shift Live:
   - Google Sheets publik dibaca via JSONP gviz (bekerja juga di file://).
   - N (Dini Hari) membaca roster tanggal sebelumnya.
   - M polos dipetakan ke M Sore / M Malam memakai snapshot warna sel sumber.
   ========================================================================== */
(function(root){
  'use strict';
  var SHEET='1upL1XI4Q2IJ-VLcBWmGXDf_Uwo0DxFLAPxt3cFaiWps';
  var DEPARTMENTS=['CONTENT ANALYST','TRAFFIC','COMPOSITOR','DIGITAL IMAGING'];
  var DEPT_COLOR={'CONTENT ANALYST':'#C6F21B','TRAFFIC':'#7CC4FF','COMPOSITOR':'#FF9BC8','DIGITAL IMAGING':'#FFA94D'};
  var SHIFTS=[
    {id:'N_DINI',key:'N',title:'Dini Hari',start:0,end:9,from:'00:00',to:'09:00',color:'#71A7DD'},
    {id:'R_REGULER',key:'R',title:'Reguler',start:8,end:17,from:'08:00',to:'17:00',color:'#FFF3CD'},
    {id:'J_JANGKAR',key:'J',title:'Jangkar',start:12,end:21,from:'12:00',to:'21:00',color:'#FFFF00'},
    {id:'M_SORE',key:'M',title:'M Sore',start:16,end:25,from:'16:00',to:'01:00',color:'#F7B26A'},
    {id:'M_MALAM',key:'M',title:'M Malam',start:21,end:30,from:'21:00',to:'06:00',color:'#2B2F38'}
  ];
  var R10={id:'R10_PAGI',key:'R10',title:'R10 Pagi',start:10,end:19,from:'10:00',to:'19:00',color:'#FFF3CD'};
  var MONTH_ABBR=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

  function shiftsFor(dept){return (dept==='DIGITAL IMAGING'?SHIFTS.concat([R10]):SHIFTS).slice().sort(function(a,b){return a.start-b.start})}
  function monthTab(y,m){return MONTH_ABBR[m-1]+' '+String(y).slice(-2)}
  function jakartaParts(date){
    var parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date||new Date());
    var o={};parts.forEach(function(x){if(x.type!=='literal')o[x.type]=+x.value});return o;
  }
  function epochLocal(y,m,d,h){return Date.UTC(y,m-1,d,h)-7*3600000}
  function addDays(y,m,d,n){var x=new Date(Date.UTC(y,m-1,d));x.setUTCDate(x.getUTCDate()+n);return {y:x.getUTCFullYear(),m:x.getUTCMonth()+1,d:x.getUTCDate()}}

  function parseCSV(text){var rows=[],row=[],cell='',q=false;for(var i=0;i<text.length;i++){var c=text[i];if(c==='"'){if(q&&text[i+1]==='"'){cell+='"';i++}else q=!q}else if(c===','&&!q){row.push(cell);cell=''}else if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(function(v){return v.trim()}))rows.push(row);row=[];cell=''}else cell+=c}if(cell||row.length){row.push(cell);rows.push(row)}return rows}
  function norm(v){return String(v==null?'':v).trim().toUpperCase()}
  function parseRows(rows,tab,department){
    var dept=norm(department);var departments=new Set(DEPARTMENTS);
    var heading=rows.findIndex(function(r){return r.some(function(v){return norm(v)===dept})});
    if(heading<1)throw Error('Bagian '+dept+' tidak ditemukan.');
    var nameCol=rows[heading].findIndex(function(v){return norm(v)===dept});
    var months={JAN:0,FEB:1,MAR:2,APR:3,MAY:4,JUN:5,JUL:6,AUG:7,SEP:8,OCT:9,NOV:10,DEC:11};
    var match=/^([A-Z]{3})\s+(\d{2}|\d{4})$/i.exec(tab);if(!match)throw Error('Tab tidak dikenali');
    if(months[match[1].toUpperCase()]===undefined)throw Error('Tab tidak dikenali');
    var month=months[match[1].toUpperCase()],year=Number(match[2])+(match[2].length===2?2000:0),dayCount=new Date(Date.UTC(year,month+1,0)).getUTCDate();
    var dateCols=null;
    for(var i=heading-1;i>=Math.max(0,heading-6);i--){
      var row=rows[i]||[];var rowName=row.findIndex(function(v){return norm(v)==='NAME'});
      if(rowName>=0&&rowName!==nameCol)continue;
      var found=[];row.forEach(function(v,col){var d=Number(String(v==null?'':v).trim());if(Number.isInteger(d)&&d>=1&&d<=dayCount)found.push({day:d,col:col})});
      if(found.length===dayCount&&found.every(function(x,j){return x.day===j+1})){dateCols=found;break}
    }
    if(!dateCols)throw Error('Header tanggal tidak ditemukan');
    var result=[];
    for(var r=heading+1;r<rows.length;r++){
      var rr=rows[r]||[],name=String(rr[nameCol]==null?'':rr[nameCol]).trim(),n=norm(name);
      if(!name){if(result.length)break;continue}
      if(departments.has(n)||n==='NAME'||n==='CATERING'||n==='KETERANGAN'||n==='TOTAL')break;
      result.push({name:name,days:dateCols.map(function(x){return String(rr[x.col]==null?'':rr[x.col]).trim()})});
    }
    if(!result.length)throw Error('Daftar nama kosong');
    return result;
  }
  function jsonpSheet(tab){
    return new Promise(function(resolve,reject){
      var cb='caSheet_'+Date.now()+'_'+Math.random().toString(36).slice(2);var script=document.createElement('script');
      var timer=setTimeout(function(){finish(new Error('Waktu tunggu habis'))},18000);
      function finish(err,data){clearTimeout(timer);try{delete root[cb]}catch(_){root[cb]=undefined}script.remove();err?reject(err):resolve(data)}
      root[cb]=function(data){finish(null,data)};
      script.onerror=function(){finish(new Error('Tidak dapat mengakses Google Sheets'))};
      script.src='https://docs.google.com/spreadsheets/d/'+SHEET+'/gviz/tq?tqx='+encodeURIComponent('responseHandler:'+cb)+'&headers=0&sheet='+encodeURIComponent(tab)+'&t='+Date.now();
      document.head.appendChild(script);
    });
  }
  function gvizRows(data){
    if(!data||data.status!=='ok'||!data.table)throw Error('Tab kosong atau tidak tersedia');
    return (data.table.rows||[]).map(function(row){return (row.c||[]).map(function(cell){var v=cell?(cell.f!=null?cell.f:(cell.v!=null?cell.v:'')):'';return String(v)})}).filter(function(r){return r.some(function(v){return v.trim()})});
  }
  function resolvedCode(person,day,tab,dept){
    var raw=norm(person.days[day-1]);if(raw!=='M')return raw;
    var name=String(person.name).trim().toLowerCase().replace(/\s+/g,' ');
    var snap=root.CA_M_COLOR_SNAPSHOT||{};
    return (((snap[tab]||{})[dept]||{})[name]||{})[String(day)]||'M_UNRESOLVED';
  }
  function codeMatches(code,slot){
    var c=norm(code);
    if(slot.id==='M_SORE')return ['M_SORE','M-SORE','MS'].indexOf(c)>=0;
    if(slot.id==='M_MALAM')return ['M_MALAM','M-MALAM','MN'].indexOf(c)>=0;
    return c===slot.key;
  }
  /* rosters: { 'OCT 26': { 'CONTENT ANALYST':[{name,days}], ... } } */
  function liveSlots(rosters,dept,now){
    now=now||new Date();var t=now.getTime(),p=jakartaParts(now),out=[];
    [-1,0].forEach(function(off){
      var day=addDays(p.year,p.month,p.day,off);
      shiftsFor(dept).forEach(function(s){
        var start=epochLocal(day.y,day.m,day.d,s.start%24)+(s.start>=24?864e5:0);
        var end=epochLocal(day.y,day.m,day.d,s.end%24)+(s.end>=24?864e5:0);
        if(!(t>=start&&t<end))return;
        var a=s.id==='N_DINI'?addDays(day.y,day.m,day.d,-1):day;
        var tab=monthTab(a.y,a.m),roster=(rosters[tab]||{})[dept];if(!roster)return;
        var members=roster.filter(function(person){return codeMatches(resolvedCode(person,a.d,tab,dept),s)}).map(function(x){return x.name});
        if(members.length)out.push({id:s.id,title:s.title,from:s.from,to:s.to,color:s.color,start:start,end:end,members:members,progress:Math.max(0,Math.min(1,(t-start)/(end-start)))});
      });
    });
    return out.sort(function(a,b){return a.start-b.start});
  }
  function nextSlot(rosters,dept,now){
    now=now||new Date();var t=now.getTime(),p=jakartaParts(now),best=null;
    [0,1].forEach(function(off){
      var day=addDays(p.year,p.month,p.day,off);
      shiftsFor(dept).forEach(function(s){
        var start=epochLocal(day.y,day.m,day.d,s.start%24)+(s.start>=24?864e5:0);if(start<=t)return;
        var a=s.id==='N_DINI'?addDays(day.y,day.m,day.d,-1):day;var tab=monthTab(a.y,a.m),roster=(rosters[tab]||{})[dept];if(!roster)return;
        var members=roster.filter(function(person){return codeMatches(resolvedCode(person,a.d,tab,dept),s)}).map(function(x){return x.name});
        if(members.length&&(!best||start<best.start))best={id:s.id,title:s.title,from:s.from,to:s.to,start:start,members:members};
      });
    });
    return best;
  }
  /* Termasuk bulan berikutnya saat besok sudah berganti bulan (Next Shift). */
  function loadAll(){
    var p=jakartaParts(),cur=monthTab(p.year,p.month),pv=addDays(p.year,p.month,1,-1),prev=monthTab(pv.y,pv.m);
    var next=addDays(p.year,p.month,p.day,1),tabs=Array.from(new Set([cur,prev,monthTab(next.y,next.m)]));
    return Promise.all(tabs.map(function(tab){
      return jsonpSheet(tab).then(function(data){
        var rows=gvizRows(data),map={};
        DEPARTMENTS.forEach(function(d){try{map[d]=parseRows(rows,tab,d)}catch(_){}});
        return [tab,map];
      }).catch(function(){return [tab,null]});
    })).then(function(list){
      var rosters={},ok=0;list.forEach(function(x){if(x[1]){rosters[x[0]]=x[1];if(Object.keys(x[1]).length)ok++}});
      if(!ok||!rosters[cur]||!Object.keys(rosters[cur]).length)throw Error('Jadwal belum dapat dimuat dari Google Sheets untuk tab '+cur);
      return rosters;
    });
  }
  root.CAShift={SHEET:SHEET,DEPARTMENTS:DEPARTMENTS,DEPT_COLOR:DEPT_COLOR,shiftsFor:shiftsFor,monthTab:monthTab,jakartaParts:jakartaParts,parseCSV:parseCSV,parseRows:parseRows,jsonpSheet:jsonpSheet,gvizRows:gvizRows,liveSlots:liveSlots,nextSlot:nextSlot,loadAll:loadAll};
})(window);
