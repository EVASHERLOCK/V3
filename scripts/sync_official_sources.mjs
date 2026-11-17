/** Run once per day by scheduler or GitHub Actions, no credential required for public FDA APIs. */
import {SourcingRegistry} from '../sourcing_registry.mjs';
const reg=new SourcingRegistry();const result=await reg.sync({force:process.argv.includes('--force')});
console.log(JSON.stringify({last_run:result.last_run,sources:result.sources,pending_review:result.pending_review},null,2));
if(Object.values(result.sources).some(x=>x.status==='ERROR'))process.exitCode=1;
