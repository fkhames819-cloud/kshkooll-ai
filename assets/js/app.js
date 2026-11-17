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
  return result.replace(/[ \\t]+/g," ").trim();
 }).filter(Boolean).join("\\n");
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
 return {text:pages.join("\\n\\n"),pages:pdf.numPages};
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
 const request=escapeHTML(promptBox.value.trim());
 const source=escapeHTML(extractedText);
 const titleMatch=extractedText.match(/الدرس\s*[0-9٠-٩-]*\s*([\s\S]{0,100})/);
 const title=titleMatch?titleMatch[0].replace(/\s+/g," ").slice(0,90):"الدرس التعليمي";
 const summary=extractedText.split(/[.؟!\n]/).map(s=>s.trim()).filter(s=>s.length>35).slice(0,7);
 const includeSummary=$("includeSummary").checked,includeQuestions=$("includeQuestions").checked;
 const paragraphs=summary.map(s=>"<p>"+escapeHTML(s)+"</p>").join("");
 const questions=includeQuestions?'<section class="card"><h2>اختبر فهمك</h2><p>راجع الأفكار الأساسية في الدرس، ثم أجب عن الأسئلة التالية:</p><ol><li>ما الفكرة الرئيسية التي يعرضها الدرس؟</li><li>اذكر مفهومين أساسيين وردا في المحتوى.</li><li>اشرح مثالًا أو تطبيقًا من الدرس بأسلوبك.</li></ol></section>':"";
 const summarySection=includeSummary?'<section class="card"><h2>ملخص سريع</h2>'+paragraphs+'</section>':"";
 return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHTML(title)}</title><style>
:root{--ink:#17233b;--muted:#60708a;--accent:#6358c9;--soft:#f2f3ff;--line:#e1e6f0}*{box-sizing:border-box}body{margin:0;background:#f4f6fb;color:var(--ink);font-family:Tahoma,Arial,sans-serif;line-height:1.95}.page{max-width:920px;margin:35px auto;padding:0 20px}.hero{padding:38px 34px;border-radius:22px;background:linear-gradient(125deg,#171e3a,#393b79 62%,#367c83);color:white;position:relative;overflow:hidden}.tag{font-size:12px;color:#b8fff4;letter-spacing:1px}.hero h1{font-size:clamp(25px,4vw,38px);line-height:1.5;margin:12px 0}.hero p{color:#d9e0f3;margin:0}.meta{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}.meta span{font-size:11px;background:#ffffff1c;border:1px solid #ffffff30;border-radius:20px;padding:4px 12px}.card{background:white;border:1px solid var(--line);border-radius:16px;padding:23px 26px;margin:18px 0;box-shadow:0 7px 25px #24365a09}.card h2{font-size:20px;margin:0 0 13px;color:var(--accent)}.card p{margin:8px 0}.goals li,.card li{padding:4px 0}.source{background:#f7f8fc;border-right:4px solid var(--accent);padding:15px 18px;border-radius:10px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px}.footer{text-align:center;color:var(--muted);font-size:12px;padding:22px}@media print{body{background:white}.page{margin:0 auto}.card{break-inside:avoid;box-shadow:none}}
</style></head><body><main class="page"><header class="hero"><div class="tag">FA5 AI · درس تعليمي</div><h1>${escapeHTML(title)}</h1><p>مسودة أولية مبنية على ملف المصدر المرفوع.</p><div class="meta"><span>طلب الإنشاء: ${request}</span><span>محتوى مستخرج من PDF</span></div></header>
<section class="card"><h2>طلب الدرس</h2><p>${request}</p></section>
${summarySection}
<section class="card"><h2>محتوى المصدر المستخرج</h2><div class="source">${source}</div></section>
${questions}<footer class="footer">تم إنشاء هذه الصفحة باستخدام FA5 AI · يمكنك تعديل ملف HTML بحرية</footer></main></body></html>`;
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
