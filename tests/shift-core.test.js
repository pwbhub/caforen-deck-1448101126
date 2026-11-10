'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function core(now,requests=[]){
  class Clock extends Date {constructor(...args){super(...(args.length?args:[now]));}}
  const window={};
  const document={createElement:()=>({remove(){}}),head:{appendChild(script){
    const url=new URL(script.src);requests.push(url);
    const callback=url.searchParams.get('tqx').split(':')[1];
    window[callback]({status:'ok',table:{rows:[]}});
  }}};
  vm.runInNewContext(fs.readFileSync('js/core/shift-core.js','utf8'),{window,document,Date:Clock,Intl,setTimeout,clearTimeout});
  return window.CAShift;
}
test('JSONP preserves date header rows and selects the requested tab',async()=>{
  const requests=[];await core('2026-11-10T00:00:00Z',requests).jsonpSheet('NOV 26');
  assert.equal(requests[0].searchParams.get('sheet'),'NOV 26');
  assert.equal(requests[0].searchParams.get('headers'),'0');
});
test('month boundary loads next month as well as current and previous months',async()=>{
  const requests=[];await assert.rejects(core('2026-12-31T15:00:00Z',requests).loadAll());
  assert.deepEqual(requests.map(x=>x.searchParams.get('sheet')),['DEC 26','NOV 26','JAN 27']);
});
test('empty department data is not accepted as a successful synchronization',async()=>{
  await assert.rejects(core('2026-11-10T00:00:00Z').loadAll(),/Jadwal belum dapat dimuat/);
});
async function selectMonth(selected,currentMonth){
  const source=fs.readFileSync('js/pages/shift-live.js','utf8');
  const elements={month:{value:selected,options:[],replaceChildren(...options){this.options=options}},department:{value:'CONTENT ANALYST'},refresh:{},syncState:{},notice:{classList:{remove(){},add(){}}}};
  const context={syncing:false,$:id=>elements[id],document:{createElement:()=>({})},
    monthCandidates:()=>['OCT 26','NOV 26','DEC 26'],scanMonth:async tab=>({tab,people:[{name:tab,days:[]}]}),
    jakartaParts:()=>({year:2026,month:currentMonth}),monthTab:(y,m)=>['OCT 26','NOV 26','DEC 26'][m-10],
    setDepartmentDisplay(){},updateMappingNote(){},render(){},toast(){},Date,Intl,
    scheduleCache:{},people:[],loadedMonth:'',loadedDepartment:'CONTENT ANALYST',instancesCacheKey:'',lastBoardSignature:'',lastUpdated:null};
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('async function loadSheet()'),source.indexOf('\nfunction statusFor')),context);
  await context.loadSheet();
  return {context,elements};
}
test('automatic selection follows the current month, even when future tabs exist',async()=>{
  const {context,elements}=await selectMonth('auto',11);
  assert.equal(context.loadedMonth,'NOV 26');assert.equal(elements.month.value,'auto');
});
test('automatic selection advances when the month changes',async()=>{
  assert.equal((await selectMonth('auto',12)).context.loadedMonth,'DEC 26');
});
test('manual tab selection is retained',async()=>{
  assert.equal((await selectMonth('OCT 26',11)).context.loadedMonth,'OCT 26');
});
