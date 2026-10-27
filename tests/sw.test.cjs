const vm = require('node:vm'), fs = require('node:fs'), assert = require('node:assert/strict');
const handlers = {}, stores = new Map([['invoice-v1',new Map()],['unrelated',new Map()],['work-invoice-shell-old',new Map()]]);
let skip = false, claim = false, fail = false, status = 200, body = 'new build', storageFail = false, precacheFail = false;
const urlOf = r => typeof r === 'string' ? r : r.url;
const caches = {keys:async()=>[...stores.keys()],delete:async n=>stores.delete(n),open:async n=>{
 if(!stores.has(n))stores.set(n,new Map()); const store=stores.get(n);
 return {addAll:async requests=>{if(precacheFail)throw Error('install failed');for(const r of requests){assert.equal(r.cache,'reload');store.set(r.url,new Response('precache'));}},match:async r=>store.get(urlOf(r))?.clone(),put:async(r,v)=>{if(storageFail)throw Error('quota');store.set(urlOf(r),v);}};
}};
const c=vm.createContext({URL,Request,Response,Set,Promise,AbortController,setTimeout,clearTimeout,caches,self:{registration:{scope:'https://test.example/work-invoice/'},addEventListener:(n,fn)=>handlers[n]=fn,skipWaiting:async()=>{skip=true},clients:{claim:async()=>{claim=true}}},fetch:async r=>{assert.equal(r.cache,'no-store');if(fail)throw Error('offline');const response=new Response(body,{status});Object.defineProperty(response,'type',{value:'basic'});return response;}});
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'..','sw.js'),'utf8'),c);
const lifecycle=async n=>{let p;handlers[n]({waitUntil:v=>p=v});await p;};
const get=async(url='https://test.example/work-invoice/index.html',method='GET')=>{let p;handlers.fetch({request:new Request(url,{method}),respondWith:v=>p=v});return p?await p:undefined;};
(async()=>{
 await lifecycle('install');assert(skip);await lifecycle('activate');assert(claim);assert.deepEqual([...stores.keys()].sort(),['unrelated','work-invoice-shell-2026-10-27-v2']);
 assert.equal(await (await get()).text(),'new build');body='newer build';assert.equal(await (await get()).text(),'newer build');
 fail=true;assert.equal(await (await get()).text(),'newer build');fail=false;status=503;assert.equal(await (await get()).text(),'newer build');status=200;
 storageFail=true;assert.equal(await (await get()).text(),'newer build');storageFail=false;
 for(const [url,method] of [['https://other.example/work-invoice/index.html','GET'],['https://test.example/work-invoice/api','GET'],['https://test.example/work-invoice/index.html','POST'],['https://test.example/work-invoice/sw.js','GET']])assert.equal(await get(url,method),undefined);
 fail=true;assert.equal(await (await get('https://test.example/work-invoice/index.html?launch=home')).text(),'newer build');fail=false;
 skip=false;precacheFail=true;await assert.rejects(lifecycle('install'));assert.equal(skip,false);
 console.log('PASS install/activate, scoped legacy cleanup, immediate takeover, fresh network files, offline/query/503 fallback, quota failure, API/cross-origin/POST bypass, failed-install guard');
})().catch(e=>{console.error(e);process.exitCode=1});
