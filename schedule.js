// Pure work-day scheduler. Browser: window.Schedule; Node: module.exports.
(function(root){
const DAYS=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const RX_PER=/chicken thigh|thighs|ground beef|raw (chicken|poultry)|shrimp|80\/20/i;
function kind(r){const t=(r.id||"")+" "+(r.title||"")+" "+(r.meta||"");
 if(r.type)return r.type;if(/slow.?cooker|crock/i.test(t))return"slowcooker";if(/batch|sheet.?pan|make.?ahead/i.test(t))return"batch";return"quick";}
function perishable(r){return r.perishable!=null?!!r.perishable:RX_PER.test((r.ingredients||[]).join(" ")+" "+(r.title||""));}
function dayOf(r){return r.day||(String(r.title||"").match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/)||[])[1]||"";}
// workDays: ["Tue",...]; recipes: [{id,day,...}] -> {active, map:{id:day}, work:[...], off:[...], noCook:{day:true}, moved:[{id,from,to}], prepDay(day)}
function assign(workDays,recipes){
 const work=DAYS.filter(d=>(workDays||[]).includes(d)),dinners=(recipes||[]).filter(r=>DAYS.includes(dayOf(r)));
 const base={};dinners.forEach(r=>base[r.id||r.title]=dayOf(r));
 const off=DAYS.filter(d=>!work.includes(d));
 if(!work.length||!off.length)return{active:false,map:base,work:[],off:DAYS.slice(),noCook:{},moved:[],prepDay:d=>d};
 const map={},load={};off.forEach(d=>load[d]=0);const moved=[];
 dinners.forEach(r=>{const d=dayOf(r);if(off.includes(d)){map[r.id||r.title]=d;load[d]++}});
 const disp=dinners.filter(r=>!off.includes(dayOf(r))).sort((a,b)=>(perishable(b)-perishable(a))||DAYS.indexOf(dayOf(a))-DAYS.indexOf(dayOf(b)));
 disp.forEach(r=>{const from=DAYS.indexOf(dayOf(r)),per=perishable(r),k=kind(r);
  const score=d=>{const i=DAYS.indexOf(d);return load[d]*100+(per?i:Math.abs(i-from)*2+(i<from?1:0))+((k!=="quick"&&load[d])?50:0)};
  const to=off.slice().sort((a,b)=>score(a)-score(b))[0];map[r.id||r.title]=to;load[to]++;moved.push({id:r.id||r.title,from:dayOf(r),to,kind:k,perishable:per});});
 const noCook={};work.forEach(d=>noCook[d]=true);
 const prepDay=d=>{if(!work.includes(d))return d;const i=DAYS.indexOf(d);return off.slice().sort((a,b)=>Math.abs(DAYS.indexOf(a)-i)-Math.abs(DAYS.indexOf(b)-i)||DAYS.indexOf(a)-DAYS.indexOf(b))[0]};
 return{active:true,map,work,off,noCook,moved,prepDay};}
// Relabel prep lines that start with a day name ("Mon evening: ...") onto off days.
function prep(lines,res){return(lines||[]).map(s=>{const m=String(s).match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/);if(!m||!res.active||!res.noCook[m[1]])return s;return res.prepDay(m[1])+String(s).slice(3)+" (moved: "+m[1]+" is a work day)"})}
const NO_COOK="No cooking: reheat or zero-prep lunch";
const api={DAYS,assign,prep,kind,perishable,dayOf,NO_COOK};
if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.Schedule=api;
})(typeof window!=="undefined"?window:this);
