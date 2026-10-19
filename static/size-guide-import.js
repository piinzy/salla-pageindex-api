/* Turn pasted Excel/CSV text, or a photo, into the guide's grid. Results are proposals the merchant reviews. */
(() => {
'use strict';
const MAX_COLUMNS=10,MAX_ROWS=30;
const NUMERIC=/^[\d٠-٩۰-۹.,٫]+(?:\s*[-–]\s*[\d٠-٩۰-۹.,٫]+)?$/;
function delimiterOf(text){
  const line=text.split(/\r?\n/).find(l=>l.trim())||'';
  if(line.includes('\t'))return '\t';
  const counts=[';',',','|'].map(d=>[d,line.split(d).length-1]).sort((a,b)=>b[1]-a[1]);
  return counts[0][1]>0?counts[0][0]:',';
}
/* RFC 4180-style parsing: quoted fields may contain delimiters, quotes ("") and line breaks. */
function parseRows(text){
  const delimiter=delimiterOf(String(text||'')),rows=[];let row=[],field='',quoted=false;
  const input=String(text||'').replace(/^﻿/,'');
  for(let i=0;i<input.length;i++){
    const c=input[i];
    if(quoted){if(c==='"'){if(input[i+1]==='"'){field+='"';i++;}else quoted=false;}else field+=c;}
    else if(c==='"'&&field==='')quoted=true;
    else if(c===delimiter){row.push(field);field='';}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&input[i+1]==='\n')i++;row.push(field);rows.push(row);row=[];field='';}
    else field+=c;
  }
  if(field!==''||row.length){row.push(field);rows.push(row);}
  return rows.map(r=>r.map(cell=>cell.replace(/\s+/g,' ').trim())).filter(r=>r.some(Boolean));
}
function unique(labels){
  const seen=new Set();
  return labels.map((raw,i)=>{const base=(raw||'').slice(0,40)||'عمود '+(i+1);let label=base,n=1;
    while(seen.has(label.toLowerCase())){n++;label=base.slice(0,36)+' '+n;}
    seen.add(label.toLowerCase());return label;});
}
/* First column = size names, first row = headers. Throws a readable message when nothing usable was pasted. */
function toGrid(text){
  const rows=parseRows(text);
  if(rows.length<2||Math.max(...rows.map(r=>r.length))<2)throw new Error('الصق جدولًا يحتوي صفًا للعناوين وصفًا واحدًا على الأقل، وعمودين على الأقل.');
  const warnings=[],width=Math.max(...rows.map(r=>r.length)),header=rows[0];
  if(width-1>MAX_COLUMNS)warnings.push(`تم أخذ أول ${MAX_COLUMNS} أعمدة قياس فقط.`);
  const labels=unique(Array.from({length:Math.min(width-1,MAX_COLUMNS)},(_,i)=>header[i+1]||''));
  let body=rows.slice(1);if(body.length>MAX_ROWS){warnings.push(`تم أخذ أول ${MAX_ROWS} صفًا فقط.`);body=body.slice(0,MAX_ROWS);}
  const grid=body.map(r=>({size:(r[0]||'').slice(0,30),values:labels.map((_,i)=>(r[i+1]||'').slice(0,60))}));
  const columns=labels.map((label,i)=>{const cells=grid.map(r=>r.values[i]).filter(Boolean);
    return {label,kind:cells.length&&cells.every(c=>NUMERIC.test(c))?'measurement':'text'};});
  if(grid.some(r=>!r.size))warnings.push('بعض الصفوف بلا اسم مقاس.');
  const blanks=grid.reduce((n,r)=>n+r.values.filter(v=>!v).length,0);
  if(blanks)warnings.push(`${blanks} خانة فارغة؛ أكملها قبل النشر أو اكتب — للخانات غير المنطبقة.`);
  return {columns,rows:grid,sizeHeader:(header[0]||'').slice(0,20),warnings};
}
/* Shrink a photo before upload: the server accepts up to 4 MB and larger pictures add no accuracy. */
function imageToDataUrl(file,maxSide=1600){
  return new Promise((resolve,reject)=>{
    if(!file||!/^image\/(png|jpe?g|webp)$/.test(file.type))return reject(new Error('استخدم صورة PNG أو JPEG أو WebP.'));
    const url=URL.createObjectURL(file),img=new Image();
    img.onload=()=>{
      const scale=Math.min(1,maxSide/Math.max(img.width,img.height)),canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
      const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(img,0,0,canvas.width,canvas.height);
      URL.revokeObjectURL(url);resolve(canvas.toDataURL('image/jpeg',.88));
    };
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('تعذر قراءة الصورة.'));};img.src=url;
  });
}
window.SizeGuideImport={parseRows,toGrid,imageToDataUrl,MAX_COLUMNS,MAX_ROWS};
})();
