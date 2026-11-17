import assert from 'node:assert/strict';
import {buildExecutionDataset,metricForPage,PAGE_IDS,executionCrossflowRows,exportExecutionWorkbook} from './procurement_execution_v2937.mjs';
import {validateAll,overview} from './sim_data_center_v2941.mjs';
assert.equal(process.env.PHARMA_DATA_MODE,'SIMULATED','Run with PHARMA_DATA_MODE=SIMULATED');
assert.equal(validateAll().violation_count,0,'All simulator source links must be valid');
const counts={rfq:4320,contracts:1440,orders:1440,shipments:1440,invoices:1440,payments:1440,claims:84,closing:1440,exceptions:679};
let metricCount=0,checkCount=0;
for(const page of PAGE_IDS){
 const data=buildExecutionDataset({page}),model=data.pages.find(p=>p.id===page),rows=data.rows;
 assert.equal(rows.length,counts[page],page+' count');
 for(const row of rows){
  for(const c of [...model.columns,...model.derived])assert(row[c.key]!==undefined&&row[c.key]!==null&&row[c.key]!=='',page+': '+c.key+' blank');
  for(const k of ['supplier','material','project_id','month','source_file','source_id'])assert(row[k],page+': '+k+' not sourced');
 }
 for(const m of model.metrics){const result=metricForPage(page,m.key,rows);assert(Number.isFinite(result.value),page+' KPI '+m.key+' invalid');metricCount++;}
 assert.equal(new Set(rows.map(x=>x.month)).size,12,page+' no full 12-month spread');
 // Slicing by common supplier+material+project+month works, where a source match exists.
 const chosen=rows[0];const slice=buildExecutionDataset({page,supplier:chosen.supplier,material:chosen.material,project:chosen.project_id,month:chosen.month});
 assert(slice.row_count>0,page+' missing matching 4D scope');
 assert(slice.rows.every(r=>r.supplier===chosen.supplier&&r.material===chosen.material&&r.project_id===chosen.project_id&&r.month===chosen.month));
 checkCount++;
}
const rfq=buildExecutionDataset({page:'rfq'}).rows;const groups=new Map();for(const q of rfq){if(!groups.has(q.rfq_id))groups.set(q.rfq_id,[]);groups.get(q.rfq_id).push(q)}
assert.equal(groups.size,1440);assert([...groups.values()].every(g=>g.length===3&&new Set(g.map(x=>x.supplier)).size===3),'3 traceable RFQ bids');
const po=buildExecutionDataset({page:'orders'}).rows,shipment=new Map(buildExecutionDataset({page:'shipments'}).rows.map(x=>[x.po,x])),invoice=new Map(buildExecutionDataset({page:'invoices'}).rows.map(x=>[x.po,x])),payment=new Map(buildExecutionDataset({page:'payments'}).rows.map(x=>[x.po,x])),closing=new Map(buildExecutionDataset({page:'closing'}).rows.map(x=>[x.po,x]));
for(const p of po){const s=shipment.get(p.po),iv=invoice.get(p.po),pm=payment.get(p.po),c=closing.get(p.po);assert(s&&iv&&pm&&c);assert.equal(p.po_qty,s.ordered_qty);assert.equal(s.received_qty,iv.invoiced_qty);assert(Math.abs(iv.invoice_total-(iv.invoiced_qty*iv.invoice_price))<.025);assert(Math.abs(pm.invoice_total-iv.invoice_total)<.025);assert(Math.abs(pm.open_amount-(iv.invoice_total-pm.paid_amount))<.025);assert(Math.abs(c.payment_balance-pm.open_amount)<.025);assert.equal(c.open_cases>=0,true);if(c.closed_flag)assert.equal(c.open_cases,0);if(c.closed_flag)assert.equal(c.payment_balance,0);if(c.closed_flag)assert.equal(c.remaining_qty,0);}
const settlements=overview().table_counts.claim_settlements;assert.equal(settlements,84);
const claims=buildExecutionDataset({page:'claims'}).rows;assert(claims.every(c=>c.open_flag===1&&c.recovered_amount<=c.claimed_amount&&Math.abs(c.recovery_gap-(c.claimed_amount-c.recovered_amount))<.025));
const cross=executionCrossflowRows({page:'orders'});assert.equal(cross.length,1440);assert(cross.every(x=>x.po_id&&x.contract_id&&x.invoice_id&&x.payment_id&&x.project_id));
const bytes=await exportExecutionWorkbook({page:'exceptions',supplier:'SUP-018'});assert(bytes.length>4000&&bytes.readUInt32LE(0)===0x04034b50);
const json=JSON.stringify(buildExecutionDataset({page:'payments',project:'PRJ-001'}).scope);assert(json.includes('PRJ-001'));
console.log('PASS V2.9.43 nine pages, '+metricCount+' KPI formulas, '+checkCount+' four-dimensional scopes, 12 months, 1440 reconciled PO chains, 3 RFQ bids, claim settlements and real XLSX');
