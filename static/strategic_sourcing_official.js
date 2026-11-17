/* V2.9.11 official discovery adapter. THIS IS NOT GMP/CEP/ASL proof.
 * openFDA's device-registration data are device-establishment registrations,
 * NOT API suppliers or GMP approvals. Browser-only daily refresh when opted in.
 */
(()=>{'use strict';
const KEY='pharma.sourcing.fda.device.v2911',PREF='pharma.sourcing.fda.device.autosync',API='https://api.fda.gov/device/registrationlisting.json?limit=20&search=establishment_type:%22Manufacture%20Medical%20Device%22';
let snapshot={fetched_at:null,source_updated:null,items:[],status:'未接入',error:''},busy=null;
try{const old=JSON.parse(localStorage.getItem(KEY)||'null');if(old&&Array.isArray(old.items))snapshot={...snapshot,...old}}catch{}
const countryName={US:'United States',CN:'China',CH:'Switzerland',DE:'Germany',FR:'France',GB:'United Kingdom',SG:'Singapore',IN:'India',IT:'Italy',JP:'Japan',KR:'South Korea',AT:'Austria',CA:'Canada',BR:'Brazil',MX:'Mexico'};
const getRegion=code=>['CN','JP','KR'].includes(code)?'East Asia':['SG','TH','MY','VN','ID'].includes(code)?'Southeast Asia':['IN','PK','BD'].includes(code)?'South Asia':['US','CA','MX'].includes(code)?'North America':['BR','AR','CO'].includes(code)?'South America':['CH','DE','FR','GB','AT','IT','ES','NL','PL','BE'].includes(code)?'Europe':'Other';
function normalize(results){const seen=new Set();return results.map((row,i)=>{
 const r=row.registration||{},id=String(r.fei_number||r.registration_number||'').trim(),name=String(r.name||r.owner_operator?.firm_name||'').trim();if(!name||!id||seen.has(id))return null;seen.add(id);
 const country=String(r.iso_country_code||''),sid='FDA-DEVICE-'+id.replace(/[^\w-]/g,'').slice(0,30);
 return {supplier_id:sid,supplier_name:name.slice(0,120),country:countryName[country]||country||'未知',region:getRegion(country),site:[r.city,country].filter(Boolean).join(', '),material_category:'DeviceComponent',category_name:'器械零部件（待物料映射）',material_id:'DEVICE-UNASSIGNED',data_origin:'FDA_DEVICE_REGISTRATION',source_system:'openFDA / FDA Device Registration & Listing',source_url:'https://api.fda.gov/device/registrationlisting.json',source_record_id:id,source_fetched_at:new Date().toISOString(),evidence_status:'FDA 官方注册线索 · 不代表批准 / GMP / 可采购',qualified_for_purchase:'NO',is_scenario:true,risk_origin:'UNASSESSED',risk_geo:null,risk_capacity:null,risk_material:null,risk_policy:null,risk_registration:null,risk_index_scenario:null,risk_grade_scenario:'待评估',demo_asset_risk:null,demo_esg_risk:null,official_device_types:(row.products||[]).slice(0,3).map(x=>x.openfda?.device_name||x.product_code).filter(Boolean).join('、')};
 }).filter(Boolean)}
async function sync(force=false){if(busy)return busy;
 if(!force&&snapshot.fetched_at&&Date.now()-new Date(snapshot.fetched_at).getTime()<24*3600*1000)return snapshot;
 busy=(async()=>{try{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 let response;try{response=await fetch(API,{headers:{Accept:'application/json'},signal:controller.signal,cache:'no-store'})}finally{clearTimeout(timer)}
 if(!response.ok)throw Error('FDA API HTTP '+response.status);
 const payload=await response.json();if(!Array.isArray(payload.results))throw Error('官方返回结构无 results');
 const items=normalize(payload.results);
 snapshot={fetched_at:new Date().toISOString(),source_updated:payload.meta?.last_updated||null,items,status:'成功获取 '+items.length+' 条 FDA 器械注册线索',error:''};
 try{localStorage.setItem(KEY,JSON.stringify(snapshot))}catch{}
 window.PharmaSourcingUniverse?.ingestOfficial?.(items);
 return snapshot;
 }catch(ex){snapshot={...snapshot,status:'获取失败 / 可通过官方链接核验',error:String(ex.message||ex)};return snapshot}
 finally{busy=null}})();return busy}
function setAuto(value){try{localStorage.setItem(PREF,value?'1':'0')}catch{}}
function getAuto(){try{return localStorage.getItem(PREF)==='1'}catch{return false}}
function maybeDaily(){if(!getAuto())return Promise.resolve(snapshot);return sync(false)}
window.PharmaOfficialSourcing={sync,maybeDaily,setAuto,getAuto,getSnapshot:()=>({...snapshot,items:[...snapshot.items]}),cached:()=>[...snapshot.items],sourceUrl:API};
})();
