// Rebuild the 21 inline <script> blocks from their canonical JS source.
// Do not use a non-greedy '</script>' regex to find their ends: source JS can
// legitimately contain '</script>' as HTML output inside a template literal.
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const htmlPath=path.join(root,'static','index.html');
const html=fs.readFileSync(htmlPath,'utf8');
const scriptStart=/<script data-bundled-src="\/static\/([a-zA-Z0-9_.-]+\.js)">/g;
const scripts=[...html.matchAll(scriptStart)].map(m=>m[1]);
if(scripts.length!==21 || new Set(scripts).size!==21)
  throw new Error(`Expected 21 unique bundled scripts; got ${scripts.length}`);
const first=html.search(scriptStart);
const last=html.indexOf('<script id="pharma-v212-startup-diagnostic">');
if(first<0||last<first) throw new Error('HTML anchors for bundled scripts not found');
const before=html.slice(0,first), after=html.slice(last);
const blocks=scripts.map(file=>{
  const filePath=path.join(root,file==='browser_api_boot.js'?'':'static',file);
  if(!fs.existsSync(filePath))throw new Error('Script source missing: '+filePath);
  // HTML parser terminates script elements at literal </script> even when that
  // text appears inside JS strings. Escaping the slash preserves JS semantics.
  const extra=file==='portfolio_strategy.js' ? (fs.readFileSync(path.join(root,'static','material_lifecycle_v23.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'static','top10_governance.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'static','metric_audit_ui.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'static','enterprise_specialist_v2926.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'static','enterprise_dashboard_v2925.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'static','sourcing_admin_ui.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'static','strategic_sourcing_runtime.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'static','strategic_sourcing_official.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'static','strategic_sourcing_universe.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'static','strategic_sourcing_overview.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'static','strategic_sourcing_market.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'static','strategic_sourcing_kraljic.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'static','strategic_sourcing_ai.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'static','strategic_sourcing_cost.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'static','strategic_sourcing_project.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'static','strategic_sourcing_performance.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'static','strategic_sourcing_compliance.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'static','strategic_sourcing_technical.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'static','supplier_database_schema.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'static','evidence_registry_v2920.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'static','strategic_sourcing_compliance_v2916.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'static','supplier_database_v2916.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'static','strategic_sourcing_compliance_v2920.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'static','module_traceability_v2928.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'static','change_control_ra_v2931.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'static','change_control_reference_v2932.js'),'utf8')) : ''; // V2.9.8: prebundle unified raw-material universe, overview, and upstream market before app.js, retaining 21-script invariant
  const js=(fs.readFileSync(filePath,'utf8')+'\n'+extra).replace(/<\/script/gi,'<\\/script');
  return `<script data-bundled-src="/static/${file}">\n${js}\n//# sourceURL=/static/${file}\n</script>`;
});
const combined=before+blocks.join('\n')+'\n'+after;
if((combined.match(/<script\b/g)||[]).length!==(combined.match(/<\/script>/g)||[]).length)
  throw new Error('Unbalanced script elements after rebundling');
fs.writeFileSync(htmlPath,combined);
console.log(`Rebuilt ${scripts.length} safe inline scripts for V2.9.31 in static/index.html`);
