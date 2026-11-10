/* ==========================================================================
   Hotspot Studio — penempatan hotspot di atas gambar (diproses lokal di browser).
   Logika asli dipertahankan. Screensaver lokal dihapus (pakai screensaver shell).
   Tambahan: dukungan tempel gambar (Ctrl+V) dan tombol keyboard pada dropzone.
   ========================================================================== */
// Logic core diadaptasi dari hotspot studio aslinya.
const $=id=>document.getElementById(id);
let img=null, name='hotspot', spots=[], recs=[], sel=null, mode=null, didAdjust=false, saved=false;
const TN={billboard:'Billboard',sign:'Signage',pole:'Pole poster',stand:'Standing',product:'Product placement',existing:'Existing',bottle:'Botol',cupshape:'Gelas',standSign:'Stand sign',magazine:'Majalah',poleSquare:'Sign tiang',rack:'Rak',canFridge:'Kulkas minuman',car:'Mobil',can:'Kaleng',box:'Kardus',lcd:'LCD/TV',poster:'Poster dinding',productPlace:'Product placement'};
const BIG=['billboard','sign','pole','stand','poster','lcd'];
const edit=$('edit'), out=$('out');
const flowViz=$('flowViz');let flowRandomTimer;
function setFlowState(state,text){flowViz.dataset.state=state;$('flowStatus').textContent=state==='idle'?'MODE SIAGA':state==='dropped'?'GAMBAR DITERIMA':state==='scanning'?'MENGANALISIS':'ALUR SELESAI';$('flowStage').textContent=text;clearInterval(flowRandomTimer);if(state==='idle'){const nodes=flowViz.querySelectorAll('.flow-node');const randomize=()=>nodes.forEach(n=>{n.style.setProperty('--dx',(Math.random()*12-6).toFixed(1)+'px');n.style.setProperty('--dy',(Math.random()*12-6).toFixed(1)+'px');n.style.setProperty('--delay',(-Math.random()*2).toFixed(2)+'s')});randomize();flowRandomTimer=setInterval(randomize,2300)}}
setFlowState('idle','Menunggu gambar untuk memulai alur');

document.querySelectorAll('.wf-step').forEach(b=>b.addEventListener('click',()=>{
  const el = document.getElementById(b.dataset.target);
  if(el) {
    const y = el.getBoundingClientRect().top + window.scrollY - 24;
    window.scrollTo({top: y, behavior: 'smooth'});
  }
}));

const dz=$('dz');
dz.onclick=()=>$('file').click();
$('file').onchange=e=>e.target.files[0]&&load(e.target.files[0]);
['dragover','dragenter'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('on')}));
['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('on')}));
dz.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];f&&load(f)});

function load(f){
 if(!f.type.startsWith('image/'))return;
 name=(f.name||'hotspot').replace(/\.[^.]+$/,'');
 const im=new Image();im.onload=()=>{
  img=im;spots=[];recs=[];sel=null;didAdjust=false;saved=false;setFlowState('dropped','Gambar diterima · siap dianalisis');
  edit.width=out.width=im.naturalWidth;edit.height=out.height=im.naturalHeight;
  
  // Hide UI placeholder, show canvas
  document.querySelector('.editor-stage .empty').style.display = 'none';
  edit.style.display = 'block';
  
  // SEMBUNYIKAN PANEL UPLOAD & TAMPILKAN PANEL GALERI
  $('sourcePanel').style.display = 'none';
  $('adjust').style.display = 'block';
  
  // Enable Tools
  $('resetApp').disabled=false;
  $('smart').disabled=false;
  
	  $('sceneTitle').textContent='Siap dipindai';$('sceneDetail').textContent='Jalankan pemindaian untuk mengenali konteks adegan.';
	  $('scanProgress').classList.add('show');$('scanFill').classList.remove('running');$('scanFill').style.width='0%';$('scanPercent').textContent='0%';$('scanStage').textContent='Menunggu respons pelacakan';$('scanNote').textContent='Gambar siap. Tekan tombol lacak untuk memulai pemindaian.';
	  $('found').textContent='Gambar siap. Tekan Pindai cerdas untuk membaca karakter adegan.';
  
  render(); updateWorkflow(); 
 };
 im.src=URL.createObjectURL(f);
}

// Tombol Ganti Gambar / Reset App
$('resetApp').onclick = () => {
  img = null; spots = []; recs = []; sel = null; didAdjust = false; saved = false;setFlowState('idle','Menunggu gambar untuk memulai alur');
  $('file').value = '';
  
  document.querySelector('.editor-stage .empty').style.display = 'flex';
  edit.style.display = 'none';
  
  // TAMPILKAN PANEL UPLOAD & SEMBUNYIKAN KEMBALI PANEL GALERI
  $('sourcePanel').style.display = 'block';
  $('adjust').style.display = 'none';
  
  // Disable Tools
  $('resetApp').disabled = true;
  $('smart').disabled = true;
  
	  $('sceneTitle').textContent='Menunggu gambar';
	  $('sceneDetail').textContent='Unggah gambar untuk memulai analisis cerdas.';
	  $('scanProgress').classList.add('show');$('scanFill').classList.remove('running');$('scanFill').style.width='0%';$('scanPercent').textContent='0%';$('scanStage').textContent='Menunggu respons pelacakan';$('scanNote').textContent='Unggah gambar baru untuk memulai pelacakan.';
	  $('found').textContent='Unggah gambar lalu jalankan Pindai cerdas.';
  
  render(); updateWorkflow();
};

const fmt={O:v=>v+'%'};
$('O').oninput=()=>{ $('vO').textContent=fmt.O($('O').value); if(spots.length){didAdjust=true;saved=false} render(); };
$('vO').textContent=fmt.O($('O').value);
$('col').oninput=()=>{if(spots.length){didAdjust=true;saved=false}render()};

$('sizeRange').oninput=()=>{
  const target = +$('sizeRange').value;
  $('sizeValue').textContent = target + '%';
  resizeSelected(target);
};

$('smart').onclick=smartPlace;
$('acc').onclick=()=>{while(recs.length)acceptRec(0,1);$('found').textContent='Semua saran diterapkan. Anda bisa menggeser atau mengubah sudut hotspot.';render()};
$('resetRec').onclick=()=>{if(!recs.length)return;recs=[];$('found').textContent='Mode manual aktif — seret area kosong pada kanvas untuk menggambar hotspot.';render()};

function smartPlace(){
 if(!img){$('found').textContent='Unggah gambar terlebih dahulu.';return}
 $('smart').disabled=true;$('smart').textContent='Pelacakan sedang berjalan...';setFlowState('scanning','Menganalisis gradasi · menyusun rekomendasi');
 const progress=$('scanProgress'),fill=$('scanFill'),stage=$('scanStage'),percent=$('scanPercent'),note=$('scanNote');
 const phases=[
   ['Membaca gradasi warna',22,'Memetakan perubahan warna dari atas ke bawah dan antar-area.'],
   ['Melacak langit & pencahayaan',48,'Menguji pola warna biru, hangat, terang, serta gelap.'],
   ['Menganalisis komposisi ruang',74,'Mencari bidang yang berpotensi menjadi area penempatan.'],
   ['Menyusun saran hotspot',92,'Mencocokkan konteks visual dengan jenis hotspot yang relevan.']
 ];
 progress.classList.add('show');fill.classList.add('running');fill.style.width='0%';percent.textContent='0%';
 let step=0;
 const timer=setInterval(()=>{
   const phase=phases[step++];if(!phase){clearInterval(timer);fill.classList.remove('running');fill.style.width='100%';percent.textContent='100%';stage.textContent='Pelacakan selesai';note.textContent='Saran siap ditinjau dan disesuaikan.';finishGradientScan();return}
   stage.textContent=phase[0];note.textContent=phase[2];fill.style.width=phase[1]+'%';percent.textContent=phase[1]+'%';
 },520);
}

function finishGradientScan(){
   // Pemindaian lokal berbasis fitur piksel dan tren gradasi (tanpa unggah gambar).
   $('smart').disabled=true;
   recs=[]; const sample=document.createElement('canvas'),ctx=sample.getContext('2d',{willReadFrequently:true});
   const sw=96,sh=Math.max(48,Math.round(96*img.naturalHeight/img.naturalWidth));sample.width=sw;sample.height=sh;ctx.drawImage(img,0,0,sw,sh);
   const px=ctx.getImageData(0,0,sw,sh).data; let topN=0,blue=0,warm=0,dark=0,bright=0,indoor=0;
   for(let y=0;y<sh;y+=2)for(let x=0;x<sw;x+=2){const i=(y*sw+x)*4,r=px[i],g=px[i+1],b=px[i+2],lum=(r+g+b)/3;
     if(y<sh*.42){topN++;if(b>r*1.08&&b>g*.98&&b-r>12)blue++;if(r>150&&r>g*1.12&&g>b*1.06)warm++;if(lum<62)dark++;if(lum>190)bright++;}
     if(y>sh*.25&&y<sh*.9&&lum>100&&lum<235)indoor++;
   }
   const skyRatio=blue/Math.max(1,topN),warmRatio=warm/Math.max(1,topN),darkRatio=dark/Math.max(1,topN),brightRatio=bright/Math.max(1,topN);
   const landscape=img.naturalWidth>img.naturalHeight*1.12, desc=[];
   const add=(t,label,box,confidence)=>recs.push({k:'s',t,label,confidence, a:0,pts:[[box[0],box[1]],[box[2],box[1]],[box[2],box[3]],[box[0],box[3]]]});
   if(skyRatio>.20||warmRatio>.18||darkRatio>.38){
     const night=darkRatio>.38, sunset=warmRatio>.18&&!night;
     desc.push(night?'gradasi langit malam terdeteksi':sunset?'warna langit senja terdeteksi':'area langit cerah terdeteksi');
     add('billboard',night?'Billboard bercahaya — langit malam':'Billboard langit', [edit.width*.12,edit.height*.08,edit.width*.88,edit.height*.34],night ? .78 : .72);
     if(landscape)add('pole','Billboard dengan pole',[edit.width*.66,edit.height*.18,edit.width*.91,edit.height*.43],.61);
     else add('sign','Billboard tanpa pole',[edit.width*.12,edit.height*.08,edit.width*.88,edit.height*.30],.64);
   }
   // Area kandidat interior dan meja: sengaja disajikan sebagai saran untuk dikonfirmasi pengguna.
   const indoorLikely=skyRatio<.12&&darkRatio<.48&&indoor/Math.max(1,topN)>.18;
   if(indoorLikely){desc.push('komposisi menyerupai area dalam ruangan');add('poster','Poster dinding',[edit.width*.08,edit.height*.18,edit.width*.40,edit.height*.53],.60);add('standSign','Stand poster',[edit.width*.57,edit.height*.36,edit.width*.82,edit.height*.72],.55);add('productPlace','Product placement di area meja',[edit.width*.36,edit.height*.54,edit.width*.64,edit.height*.78],.54);}
   if(!recs.length){desc.push('area kontras/ruang visual tersedia');add('poster','Poster / signage kontekstual',[edit.width*.18,edit.height*.16,edit.width*.62,edit.height*.48],.46);add('productPlace','Product placement',[edit.width*.40,edit.height*.52,edit.width*.66,edit.height*.76],.42);}
   $('sceneTitle').textContent=desc.join(' · ');
   $('sceneDetail').textContent=`${recs.length} saran hotspot dibuat dengan analisis lokal warna dan komposisi. Saran adalah kandidat, bukan deteksi objek pasti; pilih/geser sesuai objek nyata.`;
   $('found').textContent='Pemindaian selesai. Klik area oranye untuk menerapkan saran; atur opasitas, warna, dan skala di kontrol hotspot.';
   render();$('smart').disabled=false;$('smart').textContent='✳ Lacak ulang gradasi';setFlowState('ready','Saran hotspot siap · sesuaikan di kanvas');
}
function acceptRec(i,batch){const r=recs.splice(i,1)[0];saved=false;spots.push({pts:r.pts,a:0,t:r.t});sel=spots.length-1;if(!batch)render()}

function path(x,pts){x.beginPath();pts.forEach((p,j)=>j?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1]));x.closePath()}
function draw(cv,ui){
 const x=cv.getContext('2d');x.clearRect(0,0,cv.width,cv.height);
 if(!img)return;x.drawImage(img,0,0);
 x.globalAlpha=$('O').value/100;x.fillStyle=$('col').value;
 spots.forEach(s=>{path(x,s.pts);x.fill()});x.globalAlpha=1;
 if(!ui)return;
 const R=Math.max(8,edit.width/110);x.font='bold '+R*1.5+'px system-ui';
 recs.forEach(r=>{x.globalAlpha=.28;x.fillStyle='#f59e0b';path(x,r.pts);x.fill();x.globalAlpha=1;x.setLineDash([R*1.4,R]);x.lineWidth=R/3;x.strokeStyle='#f59e0b';x.stroke();x.setLineDash([]);});
 spots.forEach((s,i)=>{
  if(i===sel){path(x,s.pts);x.setLineDash([R,R*.7]);x.lineWidth=R/5;x.strokeStyle='#fff';x.stroke();x.setLineDash([])}
  s.pts.forEach(p=>{
    x.beginPath();x.arc(p[0],p[1],i===sel?R:R*.7,0,7);x.fillStyle='#fff';x.fill();x.lineWidth=R/4;
    x.strokeStyle=$('col').value; 
    x.stroke()
  })});
}

function resizeSelected(target){
 if(sel===null||!spots[sel])return;saved=false;didAdjust=true;const s=spots[sel],old=s.scale||100,center=s.pts.reduce((a,p)=>[a[0]+p[0]/s.pts.length,a[1]+p[1]/s.pts.length],[0,0]);let fit=2.5;
 const ratio=Math.min(target/old,fit),actual=Math.max(25,Math.min(250,Math.round(old*ratio)));s.pts=s.pts.map(p=>[center[0]+(p[0]-center[0])*ratio,center[1]+(p[1]-center[1])*ratio]);s.scale=actual;render();
}

function updateWorkflow(){
 const done=[!!img, recs.length===0&&spots.length>0, spots.length>0, didAdjust||saved, saved&&spots.length>0];
 const active = done.findIndex(x=>!x);
 const current = active < 0 ? 4 : active;
 document.querySelectorAll('.wf-step').forEach((li,i)=>{
   li.classList.toggle('done', done[i]);
   li.classList.toggle('active', i===current && !done[i]);
 });
 $('workflowFill').style.width = ((current+1)*20)+'%';
 $('workflowCount').textContent = done.filter(Boolean).length + ' / 5 langkah';
 const msg = ['Pilih gambar.','Pindai adegan gambar.','Pilih bentuk atau saran.','Sesuaikan sudut & posisi.','Simpan hasil penempatan.'];
 $('workflowStatus').textContent = msg[current];
}

function render(){
 draw(edit,true);draw(out,false);
 $('clear').disabled=!spots.length;$('acc').disabled=!recs.length;$('resetRec').disabled=!recs.length;$('save').disabled=!img;
 const chosen=sel!==null?spots[sel]:null;
 $('sizeRange').disabled=!chosen; $('sizeRange').value=chosen?(chosen.scale||100):100; $('sizeValue').textContent=(chosen?(chosen.scale||100):100)+'%';
 updateWorkflow();
}

function pos(e){const r=edit.getBoundingClientRect();return[(e.clientX-r.left)*edit.width/r.width,(e.clientY-r.top)*edit.height/r.height]}
function inside(p,pts){if(!pts||pts.length<3)return false;let c=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];if((a[1]>p[1])!=(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])c=!c}return c}

edit.onpointerdown=e=>{if(!img)return;const p=pos(e),R=Math.max(8,edit.width/110)*1.8;mode=null;
 for(let i=spots.length-1;i>=0&&!mode;i--)spots[i].pts.forEach((q,k)=>{if(!mode&&Math.hypot(q[0]-p[0],q[1]-p[1])<=R)mode={t:'h',i,k}});
 if(!mode)for(let i=spots.length-1;i>=0;i--)if(inside(p,spots[i].pts)){mode={t:'m',i,last:p};break}
 if(!mode)for(let i=recs.length-1;i>=0;i--)if(inside(p,recs[i].pts)){acceptRec(i);mode=null;return}
 if(mode){sel=mode.i}else{sel=null;mode={t:'d',x0:p[0],y0:p[1]}}
 edit.setPointerCapture(e.pointerId);render()};
edit.onpointermove=e=>{if(!mode)return;const p=pos(e);
 if(mode.t==='h'){saved=false;didAdjust=true;spots[mode.i].pts[mode.k]=[Math.max(0,Math.min(edit.width,p[0])),Math.max(0,Math.min(edit.height,p[1]))]}
 else if(mode.t==='m'){saved=false;didAdjust=true;const dx=p[0]-mode.last[0],dy=p[1]-mode.last[1];spots[mode.i].pts.forEach(q=>{q[0]+=dx;q[1]+=dy});mode.last=p}
 else{const a=Math.min(mode.x0,p[0]),b=Math.min(mode.y0,p[1]),w=Math.abs(p[0]-mode.x0),h=Math.abs(p[1]-mode.y0);
  mode.tmp=[[a,b],[a+w,b],[a+w,b+h],[a,b+h]];draw(edit,true);const x=edit.getContext('2d');x.globalAlpha=.5;x.fillStyle=$('col').value;path(x,mode.tmp);x.fill();x.globalAlpha=1;return}
 render()};
edit.onpointerup=()=>{if(mode&&mode.t==='d'&&mode.tmp){const[a,,c]=mode.tmp;
  if(c[0]-a[0]>edit.width*.01&&c[1]-a[1]>edit.height*.01){spots.push({pts:mode.tmp,a:0,t:'manual'});sel=spots.length-1;saved=false}}
 mode=null;render()};
addEventListener('keydown',e=>{if((e.key==='Delete'||e.key==='Backspace')&&sel!==null&&!/INPUT|SELECT/.test(e.target.tagName)){spots.splice(sel,1);sel=null;saved=false;render()}});

$('clear').onclick=()=>{spots=[];sel=null;saved=false;didAdjust=false;render()};

$('save').onclick=()=>{
 draw(out,false);
 out.toBlob(async b=>{const fn=name+'_hotspot.jpg';
  const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=fn;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000);saved=spots.length>0;updateWorkflow();if(window.CA)CA.toast('Gambar disimpan',fn)},'image/jpeg',.92)
};
// Tempel gambar dari clipboard (Ctrl+V) — sebelumnya hanya disebut di UI.
addEventListener('paste',e=>{const items=e.clipboardData?.items||[];for(const it of items){if(it.type.startsWith('image/')){const f=it.getAsFile();if(f){load(f);break}}}});
dz.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('file').click()}});

