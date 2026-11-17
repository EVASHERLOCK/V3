import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {enterpriseAnalysis} from './enterprise_v08.mjs';
const context={console,localStorage:{getItem(){return null},setItem(){}},document:{readyState:'loading',addEventListener(){}},window:{},setTimeout(){},Intl,URLSearchParams,Date,Math,Number,JSON};
vm.runInNewContext(fs.readFileSync('static/enterprise_v08.js','utf8'),context,{filename:'enterprise_v08.js'});
const app=context.window.EnterpriseV08;
app.state.data=enterpriseAnalysis();
for(const view of ['overview','m01','m02','m04','m05','m06','m07','m08','m09','m10','documents','regulatory','workflow','reports','access','master','alerts']){
 const rendered=app.render(view);assert.ok(rendered.includes('e8-page'),view);console.log('VIEW OK',view,rendered.length);
}
for(const [view,tabs] of Object.entries({m01:['qc'],m02:['price','savings'],m04:['docs','audit'],m05:['contracts'],m06:['capital','trace'],m07:['quality','risk'],m08:['exceptions'],m09:['markets','reg'],m10:['actions','cost','delivery','supplier','inventory'],documents:['gaps','versions','pack'],regulatory:['impact','timeline'],workflow:['failures','config'],reports:['archive','subscribe'],access:['matrix','history'],master:['suppliers','quality'],alerts:['rules']}))for(const tab of tabs){app.state.tabs[view]=tab;let out=app.render(view);assert.ok(out.length>300,view+':'+tab);console.log('TAB OK',view,tab,out.length)}
assert.ok(app.sourcingExtra(app.state.data).includes('资格'));
console.log('ALL V0.8 UI tabs rendered');
