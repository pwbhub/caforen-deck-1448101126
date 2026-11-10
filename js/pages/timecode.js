/* ==========================================================================
   Timecode Decoder — OCR timecode dari screenshot ke spreadsheet (Tesseract.js).
   Logika asli dipertahankan: 4 pass prapemrosesan piksel, konsensus, verifikasi.
   Screensaver lokal dihapus (digantikan screensaver terpadu di shell).
   ========================================================================== */
const $=id=>document.getElementById(id);
const LABELS=["Source In","Source Out","Duration"];
let worker=null,uncertainCount=0,reviewConfirmed=false,ocrPass=0;
/* Workflow-aware decoder. During OCR it rolls, then locks to actual candidates returned by Tesseract. */
const decoderFields=[["tcHH",24],["tcMM",60],["tcSS",60],["tcFF",60]],decoderNodes=decoderFields.map(([id])=>$(id));
let decoderTimer=null,decoderTimeout=0,decoderMode="",decoderFrame=1,decoderLastCode="",copyToastTimer=0;
function setDecoderMode(step,force=false){
 const mode=typeof step==="string"?step:["idle","scan","verify","ready","done"][Math.max(0,Math.min(4,Number(step)||0))];
 if(decoderNodes.some(n=>!n))return;if(mode===decoderMode&&!force)return;decoderMode=mode;clearInterval(decoderTimer);clearTimeout(decoderTimeout);
 const panel=document.querySelector(".decoder-panel"),reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
 if(panel){panel.dataset.mode=mode;panel.classList.remove("mode-idle","mode-scan","mode-verify","mode-ready","mode-done","mode-reading","locked");panel.classList.add("mode-"+mode)}
 const rand=max=>Math.floor(Math.random()*max),fmt=n=>String(n).padStart(2,"0");
 const showCode=code=>{const a=String(code).split(":");if(a.length===4)decoderNodes.forEach((el,i)=>{el.textContent=a[i];el.classList.remove("rolling")})};
 const lockAll=()=>{if(decoderLastCode&&["reading","verify","ready","done"].includes(mode))showCode(decoderLastCode);else decoderNodes.forEach((el,i)=>{el.textContent=fmt(rand(decoderFields[i][1]));el.classList.remove("rolling")})};
 const status=$("decoderState");if(status)status.textContent=({idle:"IDLE · READY",scan:"SCANNING IMAGE",reading:"OCR CANDIDATE LOCKED",verify:"VERIFY TIMECODE",ready:"READY TO COPY",done:"COPY COMPLETE"}[mode]||"FRAME SYNC");
 if(reduced){lockAll();return}
 const update=i=>{decoderNodes[i].textContent=fmt(rand(decoderFields[i][1]));decoderNodes[i].classList.add("rolling");setTimeout(()=>decoderNodes[i]?.classList.remove("rolling"),220)};
 if(mode==="scan")decoderTimer=setInterval(()=>{decoderFields.forEach((_,i)=>{if(Math.random()>.14)update(i)});decoderFrame+=Math.floor(Math.random()*4)+1;$("frameNumber").textContent=String(decoderFrame).padStart(5,"0")},78);
 else if(mode==="verify")decoderTimer=setInterval(()=>{update(rand(4));decoderFrame++;$("frameNumber").textContent=String(decoderFrame).padStart(5,"0")},720);
 else if(mode==="idle")decoderTimer=setInterval(()=>{update(rand(4));decoderFrame+=Math.floor(Math.random()*12)+1;$("frameNumber").textContent=String(decoderFrame).padStart(5,"0")},2100);
 else if(mode==="done"){decoderTimer=setInterval(()=>decoderFields.forEach((_,i)=>{if(Math.random()>.35)update(i)}),65);decoderTimeout=setTimeout(()=>{clearInterval(decoderTimer);lockAll();if(panel)panel.classList.add("locked")},760)}
 else{lockAll();if(panel)panel.classList.add("locked")}
}
function displayOcrTimecode(code,pass){decoderLastCode=code;decoderMode="reading";clearInterval(decoderTimer);clearTimeout(decoderTimeout);const panel=document.querySelector(".decoder-panel");if(panel){panel.dataset.mode="reading";panel.classList.remove("mode-idle","mode-scan","mode-verify","mode-ready","mode-done","locked");panel.classList.add("mode-reading","ocr-hit");setTimeout(()=>panel.classList.remove("ocr-hit"),650)}code.split(":").forEach((n,i)=>{decoderNodes[i].textContent=n;decoderNodes[i].classList.remove("rolling")});$("decoderState").textContent=`PASS ${pass+1}/4 · CODE READ`;$('frameNumber').textContent=String(pass+1).padStart(5,"0")}
setDecoderMode("idle");
document.querySelector(".workflow-steps")?.addEventListener("click",e=>{const step=e.target.closest(".wf-step");if(step)setDecoderMode(Number(step.dataset.step),true)});
function setReviewState(state){const b=$("confirmAll");b.classList.remove("review-waiting","review-needed","review-done");b.classList.add("review-"+state);b.textContent=state==="needed"?"! Harap Diperiksa":state==="done"?"Sudah Diperiksa":"Menunggu Pemeriksaan";b.setAttribute("aria-live","polite")}
/* Input gambar */
const drop=$("drop");
drop.onclick=()=>$("file").click();
drop.onkeydown=e=>{if(e.key==="Enter")$("file").click()};
$("file").onchange=e=>e.target.files[0]&&handle(e.target.files[0]);
["dragenter","dragover"].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add("over")}));
["dragleave","drop"].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove("over")}));
drop.addEventListener("drop",e=>{const f=e.dataTransfer.files[0];f&&handle(f)});
addEventListener("dragover",e=>e.preventDefault());
addEventListener("drop",e=>{if(!drop.contains(e.target)){e.preventDefault();const f=e.dataTransfer.files[0];f&&handle(f)}});
addEventListener("paste",e=>{for(const i of e.clipboardData.items){if(i.type.startsWith("image/")){handle(i.getAsFile());break}}});
function setStatus(t,err){$("status").textContent=t;$("status").className="muted"+(err?" err":"")}
function setProg(p){$("prog").style.display=p==null?"none":"block";$("prog").firstElementChild.style.width=(p||0)*100+"%"}
function setWorkflow(step,label,pct){const panel=$("workflow");if(!panel)return;panel.style.display="block";if(!(step===1&&decoderMode==="reading"))setDecoderMode(step);const percent=pct==null?step*25:pct;$("workflowFill").style.width=Math.max(0,Math.min(100,percent))+"%";$("workflowPercent").textContent=Math.round(Math.max(0,Math.min(100,percent)))+"%";$("workflowText").textContent=label;panel.dataset.step=step;panel.querySelectorAll(".wf-step").forEach((el,i)=>{el.classList.toggle("active",i===step);el.classList.toggle("done",i<step)})}
function handle(file){if(!file.type.startsWith("image/")){setStatus("File harus berupa gambar.",true);return}const img=$("preview");$("previewWrap").style.display="block";img.style.display="block";img.onload=()=>scan(img);img.src=URL.createObjectURL(file)}
/* Pixel-sensitive preprocessing: 4x upscaling, enhanced grayscale, global thresholds, local adaptive threshold. */
function prep(img,mode){
 const scale=Math.min(4,3400/Math.max(img.naturalWidth,img.naturalHeight)),c=document.createElement("canvas");
 c.width=Math.max(1,Math.round(img.naturalWidth*scale));c.height=Math.max(1,Math.round(img.naturalHeight*scale));
 const x=c.getContext("2d",{willReadFrequently:true});x.imageSmoothingEnabled=true;x.imageSmoothingQuality="high";x.drawImage(img,0,0,c.width,c.height);
 const d=x.getImageData(0,0,c.width,c.height),p=d.data,g=new Float32Array(p.length/4);let sum=0;
 for(let i=0,j=0;i<p.length;i+=4,j++){let v=.299*p[i]+.587*p[i+1]+.114*p[i+2];if(mode===0)v=Math.max(0,Math.min(255,(v-128)*1.18+128));g[j]=v;sum+=v}
 const mean=sum/g.length,dark=mean<140,threshold=mode===1?120:mode===2?150:180;
 if(mode===3){const blur=document.createElement("canvas");blur.width=c.width;blur.height=c.height;const bx=blur.getContext("2d",{willReadFrequently:true});bx.filter=`blur(${Math.max(3,Math.round(scale*4))}px)`;bx.drawImage(c,0,0);bx.filter="none";const local=bx.getImageData(0,0,c.width,c.height).data;
  for(let i=0,j=0;i<p.length;i+=4,j++){const m=.299*local[i]+.587*local[i+1]+.114*local[i+2],cut=dark?m+9:m-9,v=(dark?g[j]>cut:g[j]<cut)?0:255;p[i]=p[i+1]=p[i+2]=v;p[i+3]=255}
 }else{for(let i=0,j=0;i<p.length;i+=4,j++){let v=g[j];if(mode){const t=dark?255-threshold:threshold;v=(dark?v<t:v>t)?255:0}p[i]=p[i+1]=p[i+2]=v;p[i+3]=255}}
 x.putImageData(d,0,0);return c;
}
async function scan(img){
 if(window.CA)CA.keepAwake(true);
 $("result").style.display="block";setWorkflow(1,"Menyiapkan mesin OCR",25);setProg(0);
 try{
  if(typeof Tesseract==="undefined")throw new Error("Library OCR gagal dimuat (cek koneksi internet).");
  setStatus("Menyiapkan mesin OCR…");
  if(!worker){worker=await Tesseract.createWorker("eng",1,{logger:m=>{if(m.status==="recognizing text"){setProg(m.progress);const pct=25+25*((ocrPass+(m.progress||0))/4);setWorkflow(1,"Membaca gambar · pass "+(ocrPass+1)+"/4",pct);setStatus("Membaca timecode… "+Math.round(m.progress*100)+"%")}else setStatus("Memuat: "+m.status)}});await worker.setParameters({tessedit_char_whitelist:"0123456789:;. ",tessedit_pageseg_mode:"6",preserve_interword_spaces:"1"})}
  const passes=[];
  for(let pass=0;pass<4;pass++){ocrPass=pass;setDecoderMode("scan",true);$("decoderState").textContent=`OCR PASS ${pass+1}/4 · SCANNING`;const {data}=await worker.recognize(prep(img,pass));passes.push(parse(data.text));const found=extractTimecodes(data.text);if(found.length)displayOcrTimecode(found[Math.min(pass,found.length-1)],pass);else $("decoderState").textContent=`PASS ${pass+1}/4 · READING IMAGE`}
  const result=consensus(passes);setProg(null);
  if(!result.rows.length){setWorkflow(1,"Timecode belum terbaca",25);setStatus("Tidak ada timecode terdeteksi. Coba gambar yang lebih jelas.",true);return}
  render(result.rows,result.uncertain);setStatus("Selesai: 4 pembacaan OCR dibandingkan. Periksa sel kuning sebelum menyalin.");
 }catch(e){setProg(null);setWorkflow(1,"OCR tidak selesai",25);setStatus("Gagal: "+e.message,true)}
 finally{if(window.CA)CA.keepAwake(false)}
}
function parse(text){const re=/(\d{2})\D{0,2}(\d{2})\D{0,2}(\d{2})\D{0,2}(\d{2})/g,rows=[];for(const line of text.split("\n")){const m=[...line.matchAll(re)].map(a=>a.slice(1,5).join(":"));if(m.length>=2)rows.push(m)}return rows}
function extractTimecodes(text){const re=/(\d{2})\D{0,2}(\d{2})\D{0,2}(\d{2})\D{0,2}(\d{2})/g;return [...text.matchAll(re)].map(m=>m.slice(1,5).join(":"))}
function consensus(passes){
 const rows=[],uncertain=new Set(),n=Math.max(...passes.map(p=>p.length));
 for(let ri=0;ri<n;ri++){const candidates=passes.map(p=>p[ri]).filter(Boolean);if(!candidates.length)continue;const cols=Math.max(...candidates.map(r=>r.length)),row=[];
  for(let ci=0;ci<cols;ci++){const vals=candidates.map(r=>r[ci]).filter(Boolean),counts=new Map();vals.forEach(v=>counts.set(v,(counts.get(v)||0)+1));const sorted=[...counts].sort((a,b)=>b[1]-a[1]);row.push(sorted[0]?.[0]||"");if(vals.length<2||sorted[0][1]<2||(sorted[1]&&sorted[1][1]===sorted[0][1]))uncertain.add(`${rows.length}:${ci}`)}
  if(row.length>=2)rows.push(row)
 }
 return {rows,uncertain};
}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function render(rows,uncertain=new Set()){
 uncertainCount=uncertain.size;reviewConfirmed=false;const cols=Math.max(...rows.map(r=>r.length));
 $("thead").innerHTML="<tr><th class='n'>#</th>"+Array.from({length:cols},(_,i)=>`<th>${LABELS[i]||"Kolom "+(i+1)}<br><button class="btn btn-outline btn-sm" data-c="${i}" type="button">Salin kolom</button></th>`).join("")+"</tr>";
 $("tbody").innerHTML=rows.map((r,i)=>`<tr style="animation-delay:${i*50}ms"><td class='n'>${i+1}</td>`+Array.from({length:cols},(_,c)=>{const u=uncertain.has(`${i}:${c}`);return `<td contenteditable="true" spellcheck="false" class="${u?"uncertain":""}" title="${u?"Hasil OCR berbeda; cocokkan dengan gambar lalu klik sel ini":"Klik untuk mengedit dan menandai telah diperiksa"}">${escapeHTML(r[c]||"")}${u?"<span class='badge-review'>PERIKSA</span>":""}</td>`}).join("")+"</tr>").join("");
 $("chips").innerHTML=`<span class="chip">${rows.length} baris</span><span class="chip">${cols} kolom</span><span class="chip">${rows.length*cols} timecode</span><span class="chip">${uncertainCount} perlu diperiksa</span>`;
 $("verifyNote").textContent=uncertainCount?`⚠️ ${uncertainCount} sel berbeda antar-pembacaan OCR. Cocokkan satu per satu dengan gambar; klik sel untuk menandai telah diperiksa.`:"✓ Semua pembacaan OCR sepakat. Tetap cocokkan hasil dengan gambar sebelum digunakan.";setReviewState(uncertainCount>0?"needed":"waiting");setWorkflow(uncertainCount>0?2:3,uncertainCount>0?"Periksa angka yang ditandai":"Hasil siap disalin",uncertainCount>0?65:82);
 $("result").style.display="block";$("result").scrollIntoView({behavior:"smooth",block:"start"});
}
$("tbody").addEventListener("input",e=>{if(e.target.matches("td[contenteditable]")){e.target.classList.remove("verified");e.target.dataset.checked="";e.target.classList.toggle("invalid",!/^\d{2}:\d{2}:\d{2}:\d{2}$/.test(e.target.textContent.trim()))}});
$("tbody").addEventListener("dblclick",e=>{if(!e.target.matches("td[contenteditable]"))return;const td=e.target;if(td.querySelector(".badge-review"))td.querySelector(".badge-review").remove();td.classList.remove("uncertain","invalid");td.classList.add("verified");td.dataset.checked="1";uncertainCount=Math.max(0,uncertainCount-1);if(!reviewConfirmed)setReviewState(uncertainCount>0?"needed":"waiting");if(uncertainCount===0)setWorkflow(3,"Semua sel terverifikasi · siap salin",82);$("verifyNote").textContent=uncertainCount?`⚠️ Masih ada ${uncertainCount} sel yang perlu diperiksa.`:"✓ Semua sel sudah ditandai diperiksa. Pastikan nilainya cocok dengan gambar.";const chip=$("chips").lastElementChild;if(chip)chip.textContent=`${uncertainCount} perlu diperiksa`});
function grid(){return [...$("tbody").rows].map(tr=>[...tr.cells].slice(1).map(td=>td.textContent.trim()))}
async function copy(rows,showCopiedPopup=false){
 const text=rows.map(r=>r.join("\t")).join("\n");
 const html=`<table border="1" cellspacing="0" cellpadding="5" style="border-collapse:collapse;border:1px solid #9aa4b2">${rows.map(r=>`<tr>${r.map(v=>`<td style="border:1px solid #9aa4b2;padding:6px 9px;text-align:center;mso-number-format:'\\@'">${escapeHTML(v)}</td>`).join("")}</tr>`).join("")}</table>`;
 try{await navigator.clipboard.write([new ClipboardItem({"text/plain":new Blob([text],{type:"text/plain"}),"text/html":new Blob([html],{type:"text/html"})})])}
 catch{const t=document.createElement("textarea");t.value=text;document.body.appendChild(t);t.select();const h=e=>{e.clipboardData.setData("text/plain",text);e.clipboardData.setData("text/html",html);e.preventDefault()};document.addEventListener("copy",h);document.execCommand("copy");document.removeEventListener("copy",h);t.remove()}
 setWorkflow(4,"Selesai · data berhasil disalin",100);if(showCopiedPopup){const el=$("toast"),panel=document.querySelector(".decoder-panel");clearTimeout(copyToastTimer);el.textContent="TIMECODE COPIED !";el.classList.remove("show");panel?.classList.add("copy-notice");void el.offsetWidth;el.classList.add("show");copyToastTimer=setTimeout(()=>{el.classList.remove("show");panel?.classList.remove("copy-notice")},1900)}
}
function checkedRows(){const cells=[...$("tbody").querySelectorAll("td[contenteditable]")],invalid=cells.find(td=>!/^\d{2}:\d{2}:\d{2}:\d{2}$/.test(td.textContent.trim()));if(invalid){invalid.classList.add("invalid");setStatus("Format tidak valid. Gunakan HH:MM:SS:FF pada setiap sel.",true);invalid.focus();return false}if(cells.some(td=>td.classList.contains("uncertain"))){setStatus("Masih ada angka yang belum diperiksa. Cocokkan sel kuning dengan gambar.",true);return false}return true}
$("confirmAll").onclick=()=>{const cells=[...$("tbody").querySelectorAll("td[contenteditable]")];if(!cells.length)return;cells.forEach(td=>{td.classList.remove("uncertain");td.classList.add("verified");td.dataset.checked="1";td.querySelector(".badge-review")?.remove()});uncertainCount=0;reviewConfirmed=true;setReviewState("done");setWorkflow(3,"Pemeriksaan selesai · siap salin",82);$("verifyNote").textContent="✓ Semua baris dan kolom ditandai sudah diperiksa. Pastikan angka telah dicocokkan dengan gambar sebelum menyalin.";const chip=$("chips").lastElementChild;if(chip)chip.textContent="0 perlu diperiksa";setStatus("Semua hasil ditandai sudah diperiksa. Tombol salin semua dan salin kolom siap digunakan.")};
$("copyAll").onclick=()=>{if(checkedRows())copy(grid(),true)};
$("thead").onclick=e=>{const b=e.target.closest("button[data-c]");if(b&&checkedRows()){const c=+b.dataset.c;copy(grid().map(r=>[r[c]]),false)}};
$("clear").onclick=()=>{$("result").style.display="none";$("preview").style.display="none";$("previewWrap").style.display="none";$("file").value="";setProg(null);uncertainCount=0;reviewConfirmed=false;setReviewState("waiting");setWorkflow(0,"Menunggu gambar",0);setStatus("")};
