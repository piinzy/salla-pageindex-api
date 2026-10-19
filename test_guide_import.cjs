// Pasted-table and photo import helpers; pure functions, no browser needed.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const dom=new JSDOM('<body></body>',{runScripts:'outside-only'}),w=dom.window;
try{
  w.eval(fs.readFileSync(path.join(__dirname,'static','size-guide-import.js'),'utf8'));
  const I=w.SizeGuideImport,j=value=>JSON.parse(JSON.stringify(value));
  // Excel paste (tabs) with Arabic headers
  let g=I.toGrid('المقاس\tالصدر\tالخصر\tEU\nS\t90-94\t70\t36\nM\t96\t74\t38\n');
  assert.deepEqual(j(g.columns),[{label:'الصدر',kind:'measurement'},{label:'الخصر',kind:'measurement'},{label:'EU',kind:'measurement'}]);
  assert.deepEqual(j(g.rows),[{size:'S',values:['90-94','70','36']},{size:'M',values:['96','74','38']}]);assert.equal(g.sizeHeader,'المقاس');assert.deepEqual(j(g.warnings),[]);
  // CSV with quotes, commas inside quotes, semicolons and Windows line endings
  g=I.toGrid('Size;Chest;Note\r\nS;"90,5";"runs, small"\r\nM;96;"say ""hi"""\r\n');
  assert.equal(g.rows[0].values[0],'90,5');assert.equal(g.rows[0].values[1],'runs, small');assert.equal(g.rows[1].values[1],'say "hi"');
  assert.deepEqual(j(g.columns.map(c=>c.kind)),['measurement','text']);
  g=I.toGrid('﻿Size,Chest\nS,90\nM,٩٦\n');assert.equal(g.columns[0].kind,'measurement','Arabic digits count as numbers');
  // messy input: duplicate and empty headers, blanks, ragged rows, limits
  g=I.toGrid('x,a,a,,A\nS,1,2\n,3,4,5,6\n');
  assert.deepEqual(j(g.columns.map(c=>c.label)),['a','a 2','عمود 3','A 3']);assert.equal(g.rows[1].size,'');assert.equal(g.rows[0].values.length,4);
  assert.ok(g.warnings.some(x=>/بلا اسم/.test(x)));assert.ok(g.warnings.some(x=>/فارغة/.test(x)));
  const wide=Array.from({length:15},(_,i)=>'c'+i).join(','),many=Array.from({length:40},(_,i)=>'S'+i+','+Array(14).fill(i).join(',')).join('\n');
  g=I.toGrid('size,'+wide+'\n'+many);assert.equal(g.columns.length,I.MAX_COLUMNS);assert.equal(g.rows.length,I.MAX_ROWS);assert.equal(g.warnings.filter(x=>/أول/.test(x)).length,2);
  g=I.toGrid('s,'+'h'.repeat(80)+'\n'+'S'.repeat(60)+','+'9'.repeat(100));assert.equal(g.columns[0].label.length,40);assert.equal(g.rows[0].size.length,30);assert.equal(g.rows[0].values[0].length,60);
  // nothing usable
  for(const bad of ['','   \n  ','only one line,a,b','a\nb\nc','x'])assert.throws(()=>I.toGrid(bad),/الصق جدولًا/);
  // markup stays text (it is inserted with textContent / value only, never as HTML)
  g=I.toGrid('s,<img src=x onerror=alert(1)>\nS,<b>1</b>');assert.equal(g.columns[0].label,'<img src=x onerror=alert(1)>');assert.equal(g.columns[0].kind,'text');
  await_rejects();
  async function await_rejects(){
    await assert.rejects(I.imageToDataUrl({type:'application/pdf'}),/PNG/);await assert.rejects(I.imageToDataUrl(null),/PNG/);
    console.log('PASS: import parsing (tabs, CSV, quotes, Arabic digits, duplicates, limits, bad input) and image type checks.');w.close();
  }
}catch(error){w.close();throw error;}
