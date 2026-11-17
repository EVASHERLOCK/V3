import fs from 'node:fs';
const essential=[
 'package.json','build_static.mjs','enterprise_v08.mjs','suite.mjs','calculations.mjs','executive.mjs','scenario_master.mjs','browser_api.mjs','v10_validation.mjs','browser_api_boot.js','demo_master.json','v08_demo.json','rules.json',
 'static/index.html','static/app.js','static/enterprise_v08.js','static/portfolio_strategy.js','static/m01_planning.js','static/material_lifecycle_v23.js','static/material_lifecycle_v23.css','scripts/regenerate-inline.mjs','test_v24.mjs'
];
const missing=essential.filter(x=>!fs.existsSync(x));
if(missing.length){
 console.error('V2.4 GitHub/Bolt 源码不完整，缺失 '+missing.length+' 个文件:\n'+missing.map(x=>' - '+x).join('\n'));
 process.exitCode=1;
}else console.log('PASS V2.4: '+essential.length+' 个关键源码与数据文件齐全。');
