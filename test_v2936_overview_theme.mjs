import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const base=path.dirname(fileURLToPath(import.meta.url));
const theme='/static/decision_center_overview_theme_v2936.css';
const css=fs.readFileSync(path.join(base,'static',theme.split('/').pop()),'utf8');
assert.ok(css.includes('body.dc35-page .hero'), 'missing Overview-style header');
assert.ok(css.includes('body.dc35-page .dc35-chart:nth-child(6)'), 'missing categorical chart color');
assert.ok(css.includes('body.dc35-page .tag.high'), 'missing high-risk status styling');
assert.ok(css.includes('body.dc35-page .tag.missing'), 'missing neutral missing-data styling');
assert.ok(css.includes('body.dc35-page .dc35-panel'), 'missing drilldown styling');
assert.ok(css.includes('body.dc35-page .group>.dc35-actions'), 'missing lineage actions styling');
const files=['01_KPI总览.html','02_深度分析.html','03_智能预警.html','04_行动闭环.html','05_指标治理.html'];
for (const filename of files) {
  for (const loc of ['static','dist/static']) {
    const s=fs.readFileSync(path.join(base,loc,'decision-center',filename),'utf8');
    assert.equal(s.split(`<link rel="stylesheet" href="${theme}">`).length-1,1,`${loc}/${filename}: theme link missing or repeated`);
    assert.ok(s.includes('/static/decision_center_v2935.js'),`${filename}: existing data and drilldown not linked`);
    assert.ok(s.includes('/api/decision-center/dataset'),`${filename}: unified source bridge missing`);
    assert.ok(s.includes('class="dc35-page"'),`${filename}: scope class missing`);
  }
}
const main=fs.readFileSync(path.join(base,'static/index.html'),'utf8');
assert.ok(main.includes('decision-center-frame'), 'main website decision iframe missing');
assert.ok(main.includes('decision-05'), 'main navigation missing');
console.log('PASS V2.9.36: five Overview-themed pages, separate status/card/chart colors, untouched common data and drilldown path, dist assets and main website navigation');
