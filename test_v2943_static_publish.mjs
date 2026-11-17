/** V2.9.43: published snapshot must match Node's unified simulation source, not legacy DEMO. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
const file='dist/static/procurement-execution/site-data.js';
assert(fs.existsSync(file),'Static snapshot missing. Run npm run build first.');
const js=fs.readFileSync(file,'utf8');
assert(js.includes('V2.9.43 SIMULATED static-host'),'Build produced the wrong data mode');
const prefix='window.APP_DATA = ';
const start=js.indexOf(prefix);assert(start>0,'Missing static read model');
const raw=js.slice(start+prefix.length).trim().replace(/;\s*$/,'');
const data=JSON.parse(raw);
assert.equal(data.pages.length,9);
const expected={rfq:4320,contracts:1440,orders:1440,shipments:1440,invoices:1440,payments:1440,claims:84,closing:1440,exceptions:679};
for(const p of data.pages){
 assert.equal(p.rows.length,expected[p.id],p.id+' missing published source records');
 assert(p.rows.every(r=>r.simulated==='TRUE'),p.id+' includes unsourced data');
 assert(p.rows.every(r=>r.project_id&&r.supplier&&r.material&&r.month),p.id+' missing cross-page keys');
}
assert(data.pages.find(p=>p.id==='rfq').rows.some(r=>String(r.quote_id).startsWith('ALT-')),'Alternative RFQ bids not published');
assert(data.pages.find(p=>p.id==='payments').rows.some(r=>r.bank_account_masked),'Payment authorizations not published');
assert(data.pages.find(p=>p.id==='claims').rows.some(r=>r.credit_note),'Settlement evidence not published');
console.log('PASS V2.9.43 static published nine-page dataset: correct mode, all sourced rows and 4-key joins; bytes:',js.length);
