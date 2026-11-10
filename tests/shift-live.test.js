'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');

function board(source=fs.readFileSync('js/pages/shift-live.js','utf8')){
  const window={};
  vm.runInNewContext(fs.readFileSync('js/data/m-color-snapshot.js','utf8'),{window});
  vm.runInNewContext(fs.readFileSync('js/core/shift-core.js','utf8'),{window,Intl,Date});
  const elements={};
  function element(){return {dataset:{},style:{setProperty(){}},classList:{contains(name){return this.owner.className.split(' ').includes(name)}},replaceChildren(...children){this.children=children}}}
  const document={getElementById(id){return elements[id]??=element()},createElement(){const node=element();node.classList.owner=node;return node},querySelectorAll(){return[]}};
  const context=vm.createContext({window,document,Intl,Date});
  const bootstrap=source.indexOf("$('refresh').addEventListener");
  vm.runInContext(bootstrap<0?source:source.slice(0,bootstrap),context);
  vm.runInContext(`loadedMonth='NOV 26';people=['Ardi','Wahid','Miko'].map(name=>({name,days:Array.from({length:30},(_,i)=>i===9?'M':'L')}));scheduleCache={'NOV 26':people};`,context);
  return {context,elements,at(iso){vm.runInContext(`render(new Date('${iso}'))`,context);return elements.shiftGrid.children}};
}

for(const variant of ['page','standalone']){
  test(`${variant}: M Malam joins Live at 21 WIB while M Sore continues`,()=>{
    const source=variant==='page'?undefined:JSON.parse(fs.readFileSync('standalone/shift-live.html','utf8').match(/window.CA_STANDALONE_PAGE=(.*);<\/script>/)[1]);
    // The standalone page includes earlier scripts; select the Shift Live application only.
    const app=source?.slice(source.indexOf("const SHEET='"),source.indexOf("$('refresh').addEventListener"));
    const b=board(app);
    const live=cards=>cards.find(card=>card.className==='shift-card current')?.innerHTML||'';
    let cards=b.at('2026-11-10T13:59:59Z');
    assert.match(live(cards),/M Sore/);assert.doesNotMatch(live(cards),/M Malam/);
    assert.match(cards.find(card=>card.className==='shift-card next').innerHTML,/M Malam/);
    cards=b.at('2026-11-10T14:00:00Z');
    assert.match(live(cards),/2 slot kerja aktif/);assert.match(live(cards),/M Sore/);assert.match(live(cards),/M Malam/);assert.match(live(cards),/Miko/);
    assert.ok(!cards.some(card=>card.className==='shift-card next'&&card.dataset.shiftId==='M_MALAM'));
    assert.match(live(b.at('2026-11-10T17:00:00Z')),/2 slot kerja aktif/);
    cards=b.at('2026-11-10T18:00:00Z');
    assert.doesNotMatch(live(cards),/M Sore/);assert.match(live(cards),/M Malam/);
    assert.doesNotMatch(live(b.at('2026-11-10T23:00:00Z')),/M Malam/);
  });
}

test('header updates the live overlap each clock second and on returning to the tab',async()=>{
  let now=new Date('2026-11-10T13:59:59Z'),onVisible;
  class Clock extends Date {constructor(...args){super(...(args.length?args:[now]));}}
  const window={};
  vm.runInNewContext(fs.readFileSync('js/data/m-color-snapshot.js','utf8'),{window});
  vm.runInNewContext(fs.readFileSync('js/core/shift-core.js','utf8'),{window,Date:Clock,Intl});
  const roster={'NOV 26':{'CONTENT ANALYST':['Ardi','Miko'].map(name=>({name,days:Array.from({length:30},(_,i)=>i===9?'M':'L')}))}};
  window.CAShift.loadAll=async()=>roster;
  const intervals=[],elements={};let html='';
  window.CATicker={esc:String,set(element,value){html=value}};window.addEventListener=()=>{};
  const document={hidden:false,getElementById(id){return elements[id]??={dataset:{},classList:{add(){},remove(){}},addEventListener(){}}},addEventListener(event,fn){if(event==='visibilitychange')onVisible=fn}};
  vm.runInNewContext(fs.readFileSync('js/shell/live-ticker.js','utf8'),{window,document,Date:Clock,Intl,setInterval(fn,delay){intervals.push({fn,delay})}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.doesNotMatch(html,/M Malam/);
  const tick=intervals.find(timer=>timer.delay===1000);assert.ok(tick,'live header must follow each clock second');
  now=new Date('2026-11-10T14:00:00Z');tick.fn();
  assert.match(html,/M Sore/);assert.match(html,/M Malam/);
  now=new Date('2026-11-10T18:00:00Z');onVisible();
  assert.doesNotMatch(html,/M Sore/);assert.match(html,/M Malam/);
});

for(const variant of ['page','standalone']){
  function application(){
    if(variant==='page')return fs.readFileSync('js/pages/shift-live.js','utf8');
    const page=JSON.parse(fs.readFileSync('standalone/shift-live.html','utf8').match(/window.CA_STANDALONE_PAGE=(.*);<\/script>/)[1]);
    return page.slice(page.indexOf("const SHEET='"),page.indexOf("$('refresh').addEventListener"));
  }
  test(`${variant}: selecting another month never overrides the live date or roster`,()=>{
    const b=board(application());
    vm.runInContext(`loadedMonth='OCT 26';people=[{name:'Old roster',days:Array(31).fill('MN')}];scheduleCache['OCT 26']=people;`,b.context);
    const cards=b.at('2026-11-10T14:00:00Z');
    const live=cards.find(c=>c.className==='shift-card current').innerHTML;
    assert.match(live,/Miko/);assert.match(live,/Ardi/);assert.doesNotMatch(live,/Old roster/);
    assert.match(b.elements.dayCaption.textContent,/10 November 2026/);
    assert.match(b.elements.statusGrid.innerHTML,/<b>3<\/b>/);
  });
  test(`${variant}: every work window joins Live independently at its own start`,()=>{
    const b=board(application());
    vm.runInContext(`loadedDepartment='DIGITAL IMAGING';people=['N','R','R10','J','MS','MN'].map(code=>({name:code,days:Array(30).fill(code)}));scheduleCache={'NOV 26':people};instancesCacheKey='';`,b.context);
    const cases=[
      ['00:00:00',['Dini Hari','M Sore','M Malam']],
      ['01:00:00',['Dini Hari','M Malam']],
      ['06:00:00',['Dini Hari']],
      ['08:00:00',['Dini Hari','Reguler']],
      ['09:00:00',['Reguler']],
      ['10:00:00',['Reguler','R10 Pagi']],
      ['12:00:00',['Reguler','R10 Pagi','Jangkar']],
      ['16:00:00',['Reguler','R10 Pagi','Jangkar','M Sore']],
      ['17:00:00',['R10 Pagi','Jangkar','M Sore']],
      ['19:00:00',['Jangkar','M Sore']],
      ['20:59:59',['Jangkar','M Sore']],
      ['21:00:00',['M Sore','M Malam']],
      ['23:59:59',['M Sore','M Malam']]
    ];
    for(const [time,expected] of cases){
      const cards=b.at('2026-11-10T'+time+'+07:00');
      const live=cards.find(c=>c.className==='shift-card current').innerHTML;
      const actual=Array.from(live.matchAll(/<strong>(.*?) · kerja /g),m=>m[1]);
      assert.deepEqual(actual.sort(),expected.slice().sort(),time+' WIB');
    }
  });
  test(`${variant}: overnight overlap uses the previous month roster at a month boundary`,()=>{
    const b=board(application());
    vm.runInContext(`loadedMonth='NOV 26';people=[{name:'New month',days:Array(30).fill('L')}];scheduleCache={'OCT 26':[{name:'Evening previous day',days:Array(31).fill('MS')},{name:'Night previous day',days:Array(31).fill('MN')},{name:'Early previous day',days:Array(31).fill('N')}],'NOV 26':people};`,b.context);
    const cards=b.at('2026-11-01T00:00:00+07:00');
    const live=cards.find(c=>c.className==='shift-card current').innerHTML;
    assert.match(live,/Evening previous day/);assert.match(live,/Night previous day/);assert.match(live,/Early previous day/);
    assert.match(live,/3 slot kerja aktif/);
  });
}

test('main and standalone HTML load the shared shift rules before the page',()=>{
  const main=fs.readFileSync('pages/shift-live.html','utf8');
  assert.ok(main.indexOf('../js/core/shift-core.js')<main.indexOf('../js/pages/shift-live.js'));
  assert.match(main,/<script src="\.\.\/js\/core\/shift-core\.js"><\/script>/);
  const html=fs.readFileSync('standalone/shift-live.html','utf8');
  const page=JSON.parse(html.match(/window.CA_STANDALONE_PAGE=(.*);<\/script>/)[1]);
  const scripts=Array.from(page.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g),m=>m[1].trim());
  const normalize=source=>source.replace(/\r\n/g,'\n').trim();
  const app=normalize(fs.readFileSync('js/pages/shift-live.js','utf8'));
  const core=normalize(fs.readFileSync('js/core/shift-core.js','utf8'));
  const coreIndex=scripts.findIndex(script=>normalize(script)===core);
  const appIndex=scripts.findIndex(script=>normalize(script)===app);
  assert.ok(coreIndex>=0,'standalone must embed the current shared rules');
  assert.ok(appIndex>coreIndex,'standalone must embed the current page after the shared rules');
  for(const name of fs.readdirSync('standalone').filter(name=>name.endsWith('.html'))){
    const file=fs.readFileSync('standalone/'+name,'utf8');
    const marker='/* js/core/shift-core.js */';const start=file.indexOf(marker)+marker.length;
    const embedded=file.slice(start,file.indexOf('</script>',start));
    assert.equal(normalize(embedded),core,name+' header shift rules');
  }
});

test('five requested work windows match both HTML legends and shared schedule rules',()=>{
  const window={};
  vm.runInNewContext(fs.readFileSync('js/core/shift-core.js','utf8'),{window,Intl,Date});
  const expected=[['N_DINI',0,9,'00:00','09:00'],['R_REGULER',8,17,'08:00','17:00'],['J_JANGKAR',12,21,'12:00','21:00'],['M_SORE',16,25,'16:00','01:00'],['M_MALAM',21,30,'21:00','06:00']];
  assert.deepEqual(JSON.parse(JSON.stringify(window.CAShift.shiftsFor('CONTENT ANALYST').map(s=>[s.id,s.start,s.end,s.from,s.to]))),expected);
  const standalone=JSON.parse(fs.readFileSync('standalone/shift-live.html','utf8').match(/window.CA_STANDALONE_PAGE=(.*);<\/script>/)[1]);
  for(const html of [fs.readFileSync('pages/shift-live.html','utf8'),standalone]){
    for(const [id,start,end,from,to] of expected)assert.ok(html.includes(from+'–'+to),id+' legend');
  }
  for(const slot of window.CAShift.shiftsFor('CONTENT ANALYST')){
    const bounds=window.CAShift.slotBounds(2026,11,10,slot);
    assert.equal(bounds.end-bounds.start,9*3600000,slot.id+' duration');
    assert.equal(window.CAShift.isLiveSlot(bounds,bounds.start-1),false);
    assert.equal(window.CAShift.isLiveSlot(bounds,bounds.start),true);
    assert.equal(window.CAShift.isLiveSlot(bounds,bounds.end-1),true);
    assert.equal(window.CAShift.isLiveSlot(bounds,bounds.end),false);
  }
});
