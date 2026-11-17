const $=id=>document.getElementById(id);
const fileInput=$("pdfFile"),dropzone=$("dropzone"),fileInfo=$("fileInfo"),fileName=$("fileName"),fileDetails=$("fileDetails"),statusBox=$("extractStatus"),statusText=$("statusText"),progressBar=$("progressBar"),promptBox=$("lessonPrompt"),generateBtn=$("generateBtn"),emptyOutput=$("emptyOutput"),resultArea=$("resultArea"),previewFrame=$("previewFrame"),toast=$("toast");
let pdfFile=null,extractedText="",generatedHTML="";
function notify(msg){toast.textContent=msg;toast.classList.add("show");clearTimeout(notify.timer);notify.timer=setTimeout(()=>toast.classList.remove("show"),2500)}
function escapeHTML(value){return value.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function setProgress(percent,msg){progressBar.style.width=percent+"%";statusText.textContent=msg}
function rebuildArabicPage(items){
 const rows=[];
 for(const item of items){
  if(!item.str||!item.str.trim())continue;
  const x=item.transform?.[4]??0,y=item.transform?.[5]??0,size=Math.abs(item.transform?.[0]||item.transform?.[3]||10);
  let row=rows.find(r=>Math.abs(r.y-y)<=Math.max(2,size*.28));
  if(!row){row={y,items:[]};rows.push(row)}
  row.items.push({str:item.str.trim(),x,width:Math.abs(item.width||0),size});
 }
 rows.sort((a,b)=>b.y-a.y);
 return rows.map(row=>{
  const line=row.items.sort((a,b)=>b.x-a.x);
  let result="",previous=null;
  for(const item of line){
   if(previous){
    const gap=previous.x-(item.x+item.width);
    if(gap>Math.max(1.5,item.size*.22)&&!result.endsWith(" "))result+=" ";
   }
   result+=item.str;
   previous=item;
  }
  return result.replace(/[ \t]+/g," ").trim();
 }).filter(Boolean).join("\n");
}
async function readPDF(file){
 if(!window.pdfjsLib)throw new Error("تعذر تحميل مكتبة قراءة PDF. تحقق من اتصال الإنترنت ثم أعد تحميل الصفحة.");
 pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
 const data=await file.arrayBuffer();const pdf=await pdfjsLib.getDocument({data}).promise;let pages=[];
 for(let n=1;n<=pdf.numPages;n++){
  const page=await pdf.getPage(n);
  const content=await page.getTextContent({disableCombineTextItems:false});
  const text=rebuildArabicPage(content.items);
  pages.push(text);
  setProgress(Math.round(n/pdf.numPages*100),"استخراج نص الصفحة "+n+" من "+pdf.numPages);
 }
 return {text:pages.join("\n\n"),pages:pdf.numPages};
}
function updateReady(){generateBtn.disabled=!(pdfFile&&extractedText.trim()&&promptBox.value.trim())}
async function acceptFile(file){
 if(!file)return;if(file.type!=="application/pdf"&&!file.name.toLowerCase().endsWith(".pdf")){notify("من فضلك اختر ملف PDF فقط");return}
 pdfFile=file;extractedText="";fileInfo.hidden=false;fileName.textContent=file.name;fileDetails.textContent="جارٍ قراءة الملف...";statusBox.hidden=false;setProgress(3,"جارٍ فتح ملف PDF");updateReady();
 try{const result=await readPDF(file);extractedText=result.text;fileDetails.textContent=result.pages+" صفحات · "+(file.size/1024/1024).toFixed(2)+" MB";setProgress(100,"تم استخراج النص بنجاح");if(!extractedText.trim())throw new Error("لم أجد نصًا قابلًا للاستخراج. قد يكون الملف صورًا ممسوحة ضوئيًا.");notify("تمت قراءة الملف بنجاح")}
 catch(err){fileDetails.textContent="تعذرت قراءة النص";notify(err.message);extractedText=""}
 updateReady();
}
fileInput.addEventListener("change",e=>acceptFile(e.target.files[0]));
["dragenter","dragover"].forEach(name=>dropzone.addEventListener(name,e=>{e.preventDefault();dropzone.classList.add("dragover")}));
["dragleave","drop"].forEach(name=>dropzone.addEventListener(name,e=>{e.preventDefault();dropzone.classList.remove("dragover")}));
dropzone.addEventListener("drop",e=>acceptFile(e.dataTransfer.files[0]));
$("removeFile").addEventListener("click",()=>{pdfFile=null;extractedText="";fileInput.value="";fileInfo.hidden=true;statusBox.hidden=true;updateReady()});
promptBox.addEventListener("input",updateReady);
function makeLessonHTML(){
 const request=promptBox.value.trim();
 const rawLines=extractedText.replace(/\r/g,"").split("\n").map(s=>s.trim()).filter(Boolean);
 const titleMatch=extractedText.match(/الدرس\s*[0-9٠-٩-]*\s*[^\n]*/);
 const title=titleMatch?titleMatch[0].slice(0,120):request||"شرح الدرس";
 const headingPattern=/^(الدرس|الوحدة|أهداف التعلم|أهداف الدرس|مقدمة|تمهيد|أولاً|ثانياً|ثالثاً|رابعاً|خامساً|الخلاصة|ملحوظة|ملاحظة|مثال|تدريب|تطبيق|[0-9٠-٩]+[.)-])/;
 const bulletPattern=/^([•●▪◦*-]|\d+[.)-]|[٠-٩]+[.)-])/;
 let blocks=[],paragraph=[];
 const flush=()=>{if(paragraph.length){blocks.push({type:"p",text:paragraph.join(" ")});paragraph=[]}};
 for(const line of rawLines){
  if(headingPattern.test(line)){flush();blocks.push({type:"h",text:line});}
  else if(bulletPattern.test(line)){flush();blocks.push({type:"li",text:line.replace(/^([•●▪◦*-]|\d+[.)-]|[٠-٩]+[.)-])\s*/,"")});}
  else paragraph.push(line);
 }
 flush();
 const content=blocks.map((block,i)=>{
  if(block.type==="h")return '<h2 class="section-title">'+escapeHTML(block.text)+'</h2>';
  if(block.type==="li")return '<div class="note-list-item"><span>•</span><p>'+escapeHTML(block.text)+'</p></div>';
  return '<p class="lesson-paragraph">'+escapeHTML(block.text)+'</p>';
 }).join("");
 return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHTML(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Baloo+Bhaijaan+2:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
:root{--paper:#fffdf5;--grid:#e2ebf3;--red:#ff8585;--blue:#2b4c7e;--ink:#2c3e50;--yellow:#fff9c4;--pale-blue:#e1f5fe}
*{box-sizing:border-box}body{margin:0;padding:22px;background:#dcd6cd;color:var(--ink);font:18px/1.9 "Baloo Bhaijaan 2",Tahoma,sans-serif}
.notebook{max-width:950px;margin:0 auto;padding:34px 34px 42px;background-color:var(--paper);background-image:linear-gradient(var(--red) 1px,transparent 1px),linear-gradient(90deg,var(--grid) 1px,transparent 1px);background-size:100% 34px,34px 100%;border-right:20px solid var(--blue);border-radius:9px;box-shadow:0 10px 30px #0002}
.header{text-align:center;border-bottom:3px double var(--blue);padding:0 0 18px;margin-bottom:28px}.header h1{margin:0;color:var(--blue);font-size:clamp(25px,4vw,34px);font-weight:800;line-height:1.5}.header p{margin:5px 0 0;color:#687386;font-size:16px}
.lesson-content{display:block}.section-title{display:table;color:var(--blue);font-size:23px;font-weight:800;margin:25px 0 12px;padding-bottom:3px;border-bottom:2px dashed var(--blue)}
.lesson-paragraph,.note-list-item{margin:0 0 13px}.lesson-paragraph{padding:3px 2px}.note-list-item{display:flex;gap:10px;align-items:flex-start;padding:3px 5px}.note-list-item span{color:#d9381e;font-weight:800}.note-list-item p{margin:0}
.section-title:nth-of-type(even){color:#246a8b}
.footer{text-align:center;border-top:2px dashed #aab5c5;margin-top:30px;padding-top:14px;color:#66758a;font-size:13px}
@media(max-width:600px){body{padding:8px;font-size:16px}.notebook{padding:22px 16px;border-right-width:10px}.section-title{font-size:20px}}
@media print{body{background:white;padding:0}.notebook{box-shadow:none;margin:0;max-width:none}}
</style></head><body><main class="notebook"><header class="header"><h1>${escapeHTML(title)}</h1><p>شرح الدرس</p></header><article class="lesson-content">${content}</article><footer class="footer">Kshkooll AI · شرح تعليمي</footer></main></body></html>`;
}
generateBtn.addEventListener("click",()=>{
 if(!extractedText.trim()||!promptBox.value.trim())return;
 generatedHTML=makeLessonHTML();emptyOutput.hidden=true;resultArea.hidden=false;
 previewFrame.srcdoc=generatedHTML;
 $("resultWordCount").textContent=extractedText.trim().split(/\s+/).length+" كلمة مستخرجة";
 notify("تم تجهيز مسودة صفحة HTML");
});
$("copyBtn").addEventListener("click",async()=>{if(!generatedHTML)return;try{await navigator.clipboard.writeText(generatedHTML);notify("تم نسخ كود HTML")}catch{notify("تعذر النسخ؛ استخدم التنزيل") }});
$("downloadBtn").addEventListener("click",()=>{if(!generatedHTML)return;const blob=new Blob([generatedHTML],{type:"text/html;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="FA5-AI-lesson.html";a.click();URL.revokeObjectURL(url);notify("بدأ تنزيل ملف HTML")});
$("menuBtn").addEventListener("click",()=>$("sidebar").classList.toggle("open"));
