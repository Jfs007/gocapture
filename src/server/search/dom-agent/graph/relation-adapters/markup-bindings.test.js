'use strict';

const test = require('node:test');
const assert = require('assert');
const { extractMarkupBindings } = require('./markup-bindings');

test('component detection uses the full HTML standard tag set, not a hand-rolled partial list', () => {
  // 旧的手写名单漏掉这些原生标签 → 会把它们误判成组件（假 uses-component 边）。
  const text = '<template>'
    + '<h1>t</h1><video src="a" /><canvas /><dialog /><code>x</code><pre>y</pre>'
    + '<strong>b</strong><caption>c</caption><details><summary>s</summary></details>'
    + '<div class="x" /><MyCard :data="d" /><user-panel />'
    + '</template>';
  const components = extractMarkupBindings({ file: 'src/View.vue', text })
    .filter(relation => relation.type === 'uses-component')
    .map(relation => relation.component)
    .sort();
  // 只有真正的自定义组件被检出；原生元素（含以前漏掉的 h1/video/code/dialog…）与 <template> 都不算组件。
  assert.deepEqual(components, ['my-card', 'user-panel']);
});
