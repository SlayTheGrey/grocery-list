#!/usr/bin/env node
// Learnable Walmart aisle map for the grocery app.
// Usage (run from anywhere; MAP defaults to the aisle-map.json next to this script):
//   node update-aisle-map.js --init data.js [preferred-products.json]   add every item (name,url,cat) to the map; aisle unknown ones go to the todo list
//   node update-aisle-map.js --observe "<url>" "<aisle label>" ["<name>"] ["<cat>"] [--conf high|medium|low]
//   node update-aisle-map.js --from obs.json      obs.json = [{url,aisle,name?,cat?,conf?,date?}]  (e.g. output of a browser pass)
//   node update-aisle-map.js --html page.html "<url>"   parse a saved walmart.com/ip page (store selected) for its aisle
//   node update-aisle-map.js --fetch [N]           try up to N (default 5) todo URLs with curl, 5 s apart; stops at the first bot block
//   node update-aisle-map.js --apply data.js       fill missing item.aisle in data.js from the map (never overwrites)
//   node update-aisle-map.js --todo                print URLs that still need an aisle
// Every run recomputes the category table and the walking-path order (path/pathOrder come from the explicit "walkOrder" table when present).
// Privacy: the map holds product names/urls and store aisle labels only. No store address, no people.
const fs=require("fs"),path=require("path"),cp=require("child_process");
const MAP=process.env.AISLE_MAP||path.join(__dirname,"aisle-map.json");
const ROUTE=["Other","Fruits & Veggies","Breads & Grains","Meat & Seafood","Dairy","Sauces & Spices","Snacks & Beverages","Frozen Foods"];
const today=new Date().toISOString().slice(0,10);
const load=()=>fs.existsSync(MAP)?JSON.parse(fs.readFileSync(MAP,"utf8")):{};
const M=Object.assign({version:1,note:"Store aisle labels observed on walmart.com product pages for our store. Product info only.",route:ROUTE,items:{},categories:{},path:[]},load());
const key=u=>{const m=String(u||"").match(/\/ip\/(?:[^/]+\/)?(\d+)/);return m?"ip:"+m[1]:null};
const readWeek=f=>{const t=fs.readFileSync(f,"utf8");return JSON.parse(t.slice(t.indexOf("{"),t.lastIndexOf("}")+1))};
const norm=a=>String(a||"").trim().replace(/^aisle\s*/i,"").toUpperCase();
function upsert(o){const k=key(o.url);if(!k)return console.error("skip (no /ip/ url):",o.url);const e=M.items[k]||(M.items[k]={url:o.url});
 if(o.name&&!e.name)e.name=o.name;if(o.cat&&!e.cat)e.cat=o.cat;
 if(o.aisle){const a=norm(o.aisle);if(e.aisle!==a){e.aisle=a;e.observed=o.date||today;e.confidence=o.conf||"high";e.source=o.source||"walmart product page (store selected)";console.log("aisle",a,"←",e.name||k)}}}
function parseHtml(h){let m=h.match(/"productLocation"\s*:\s*\[\s*\{[^\]]*?"displayValue"\s*:\s*"([^"]+)"/)||h.match(/"aisleLocation"[^}]*?"displayValue"\s*:\s*"([^"]+)"/)||h.match(/\bAisle\s+([A-Z]{0,2}\d{1,3}[A-Z]?)\b/);return m?m[1]:null}
function allItems(W){const out=[];const add=(cats)=>(cats||[]).forEach(c=>(c.items||[]).forEach(i=>out.push({name:i.name,url:i.url,cat:c.name,aisle:i.aisle})));add(W.categories);add((W.nextWeek||{}).categories);
 (W.staples||[]).forEach(s=>out.push({name:s.name,url:s.url,cat:s.cat}));return out}
function recompute(){const cats={},ais={};
 for(const e of Object.values(M.items)){if(!e.aisle)continue;const c=e.cat||"Other";(cats[c]=cats[c]||{})[e.aisle]=(cats[c][e.aisle]||0)+1;const A=ais[e.aisle]=ais[e.aisle]||{n:0,cats:{}};A.n++;A.cats[c]=(A.cats[c]||0)+1}
 M.categories={};for(const [c,m] of Object.entries(cats))M.categories[c]=Object.entries(m).sort((a,b)=>b[1]-a[1]).map(([aisle,n])=>({aisle,items:n}));
 const zone=a=>{const m=a.match(/^([A-Z]*)(\d*)/);return [m[1],+m[2]||0]};
 M.path=Object.entries(ais).map(([a,A])=>{const top=Object.entries(A.cats).sort((x,y)=>y[1]-x[1])[0][0];const r=ROUTE.indexOf(top);return {aisle:a,section:top,rank:r<0?0:r,items:A.n}})
  .sort((x,y)=>x.rank-y.rank||zone(x.aisle)[0].localeCompare(zone(y.aisle)[0])||zone(x.aisle)[1]-zone(y.aisle)[1])
  .map((p,i)=>({order:i+1,aisle:p.aisle,section:p.section,items:p.items,basis:"guess: section from item categories + usual path; within section by aisle letter/number"}));
 // explicit walkOrder (if present) wins; observed aisles not in it are slotted after their category anchor
 if(Array.isArray(M.walkOrder)&&M.walkOrder.length){const wo=M.walkOrder.slice().sort((x,y)=>x.order-y.order),known=new Set(wo.map(w=>w.aisle)),anc=M.categoryAnchor||{};
  const extra=M.path.filter(p=>!known.has(p.aisle)).map(p=>{const w=wo.find(w=>w.aisle===anc[p.section]);return {order:(w?w.order:999)+5,aisle:p.aisle,zone:w?w.zone:"Unplaced",basis:"guess: not in walkOrder; slotted after category anchor "+(anc[p.section]||"?")}});
  M.path=wo.map(w=>({order:w.order,aisle:w.aisle,zone:w.zone,basis:"walkOrder (observed map)"})).concat(extra).sort((x,y)=>x.order-y.order);
  if(extra.length)console.log("aisles not in walkOrder (add them):",extra.map(e=>e.aisle).join(", "))}
 M.pathOrder=M.path.map(p=>p.aisle);M.updated=today;
 const todo=Object.values(M.items).filter(e=>!e.aisle);M.coverage={items:Object.keys(M.items).length,withAisle:Object.keys(M.items).length-todo.length};
 fs.writeFileSync(MAP,JSON.stringify(M,null,1)+"\n");console.log(`map: ${M.coverage.withAisle}/${M.coverage.items} items with aisle, ${M.path.length} aisles on path → ${MAP}`)}
const a=process.argv.slice(2),cmd=a[0];const ci=a.indexOf("--conf");const conf=ci>0?a[ci+1]:undefined;
if(cmd==="--init"){const W=readWeek(a[1]);allItems(W).forEach(i=>upsert(i));if(a[2]){const P=JSON.parse(fs.readFileSync(a[2],"utf8")).products||{};for(const [n,v] of Object.entries(P))upsert({name:n,url:v.url,cat:v.cat})}}
else if(cmd==="--observe")upsert({url:a[1],aisle:a[2],name:a[3]&&!a[3].startsWith("--")?a[3]:undefined,cat:a[4]&&!a[4].startsWith("--")?a[4]:undefined,conf});
else if(cmd==="--from")JSON.parse(fs.readFileSync(a[1],"utf8")).forEach(upsert);
else if(cmd==="--html"){const v=parseHtml(fs.readFileSync(a[1],"utf8"));if(!v){console.error("no aisle found in page (store not selected, or not stocked in store)");process.exit(2)}upsert({url:a[2],aisle:v})}
else if(cmd==="--fetch"){const n=+a[1]||5,todo=Object.values(M.items).filter(e=>!e.aisle).slice(0,n);
 for(const e of todo){let h="";try{h=cp.execFileSync("curl",["-sL","-m","20","-A","Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36","-b","assortmentStoreId="+(process.env.WALMART_STORE_ID||fs.existsSync(path.join(__dirname,".aisle-store"))&&fs.readFileSync(path.join(__dirname,".aisle-store"),"utf8").trim()||""),e.url],{encoding:"utf8"})}catch(x){}
  if(/Robot or human|px-captcha|\/blocked\?/i.test(h)||!h){console.error("blocked by walmart bot check at",e.url,"- use a browser pass (see README)");break}
  const v=parseHtml(h);if(v)upsert({url:e.url,aisle:v});else console.log("no aisle shown:",e.name);cp.execFileSync("sleep",["5"])}}
else if(cmd==="--apply"){recompute();const f=a[1],t=fs.readFileSync(f,"utf8"),W=readWeek(f);let n=0;
 const fill=cats=>(cats||[]).forEach(c=>(c.items||[]).forEach(i=>{const e=M.items[key(i.url)];if(e&&e.aisle&&!i.aisle){i.aisle=e.aisle;n++}}));fill(W.categories);fill((W.nextWeek||{}).categories);
 fs.writeFileSync(f,t.slice(0,t.indexOf("{"))+JSON.stringify(W,null,1)+t.slice(t.lastIndexOf("}")+1));console.log("filled",n,"item aisles in",f);process.exit(0)}
else if(cmd==="--todo"){Object.values(M.items).filter(e=>!e.aisle).forEach(e=>console.log(e.url,"\t",e.name||""));process.exit(0)}
else if(cmd){console.error("unknown command; see header of",__filename);process.exit(1)}
recompute();
