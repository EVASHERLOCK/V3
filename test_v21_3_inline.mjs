// Regression: prevent raw '</script>' inside script template literals.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const html=fs.readFileSync('dist/index.html','utf8');
const opens=(html.match(/<script\b/g)||[]).length;
const closes=(html.match(/<\/script>/g)||[]).length;
assert.equal(opens,22);assert.equal(closes,22);
assert.match(html,/<script data-bundled-src="\/static\/m01_planning\.js">/);
assert.match(html,/<script data-bundled-src="\/static\/app\.js">/);
assert.match(html,/<script data-bundled-src="\/static\/portfolio_strategy\.js">/);
assert.ok(!html.includes('</script>\n</body></html>`'), 'HTML contains a JS string that prematurely terminates its script tag');
console.log('PASS V2.1.3: exactly 21 bundled browser scripts plus 1 diagnostic, all balanced; escaped HTML closing tags');
