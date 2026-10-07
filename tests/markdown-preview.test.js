const test=require('node:test'),assert=require('node:assert/strict');
const {preview}=require('../src/main/markdown-preview');
test('plain result retains exact whitespace and escapes markup',()=>{
 const result=preview('A plain result\n  two spaces <script>alert(1)</script>');
 assert.equal(result.format,'plain');assert.equal(result.html,'A plain result\n  two spaces &lt;script&gt;alert(1)&lt;/script&gt;');
});
test('Markdown preview renders headings, lists, tables, code and links',()=>{
 const result=preview('# Title\n\n- **Strong**\n- `code`\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n```js\nconst x = "<tag>";\n```\n\n[Source](https://example.com/page)');
 assert.equal(result.format,'markdown');for(const tag of ['h1','ul','li','strong','code','table','th','td','pre','a'])assert.match(result.html,new RegExp('<'+tag+'(?:>| )'));
 assert.match(result.html,/&lt;tag&gt;/);assert.match(result.html,/href="https:\/\/example.com\/page"/);
});
test('untrusted result cannot create active HTML, unsafe links, images or resource loads',()=>{
 const result=preview('# Result\n\n<script>evil()</script><img src=x onerror=evil()>\n\n[bad](javascript:alert(1)) [file](file:///private/file) [remote](//example.com)\n\n![Diagram](https://example.com/image.png)');
 assert.doesNotMatch(result.html,/<(?:script|img|iframe)|<[^>]+\sonerror=|href="(?:javascript:|file:|\/\/)/);
 assert.match(result.html,/Diagram/);assert.match(result.html,/&lt;script&gt;/);
});
test('multiple image labels are escaped individually and never become network images',()=>{
 const result=preview('# Images\n\n![One](https://example.com/one) and ![Two](https://example.com/two)');
 assert.match(result.html,/One and Two/);assert.doesNotMatch(result.html,/<img/);
});
test('preview enforces input and structure bounds',()=>{
 assert.throws(()=>preview('x'.repeat(100001)),/text limit/);
 assert.throws(()=>preview('- x\n'.repeat(4000)),/structure limit/);
 assert.throws(()=>preview('> '.repeat(40)+'deep text'),/structure limit/);
});
