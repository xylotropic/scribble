"use strict";
const MarkdownIt = require("markdown-it");
const sanitize = require("sanitize-html");
const parser = new MarkdownIt({html:false,linkify:false,typographer:false,maxNesting:65});
parser.renderer.rules.image = (tokens,index) => parser.utils.escapeHtml(tokens[index].content || "");
function preview(text) {
  if (typeof text !== "string" || text.length > 100000) throw Error("Result preview exceeds the text limit");
  const markdown = /^(?: {0,3}(?:#{1,6} |```|~~~|>|[-+*] |\d+\. ))/m.test(text) || /(?:\*\*[^\n]+\*\*|__[^\n]+__|`[^`\n]+`|\[[^\]\n]+\]\([^\n]+\)|\n\s*\|?.+\|.+\n\s*\|?\s*:?-{3,})/.test(text);
  if (!markdown) return {format:"plain",html:parser.utils.escapeHtml(text)};
  const tokens=parser.parse(text,{});
  let count=0;
  function budget(nodes) {for(const node of nodes){if(++count>10000 || node.level>32)throw Error("Result preview exceeds the structure limit");if(node.children)budget(node.children);}}
  budget(tokens);
  const html = sanitize(parser.renderer.render(tokens,parser.options,{}), {
    allowedTags:["p","br","h1","h2","h3","h4","h5","h6","ul","ol","li","blockquote","pre","code","strong","em","s","hr","a","table","thead","tbody","tr","th","td"],
    allowedAttributes:{a:["href","title"],ol:["start"]},
    allowedSchemes:["http","https"],allowProtocolRelative:false,
  });
  if(html.length>500000)throw Error("Result preview exceeds the rendered limit");
  return {format:"markdown",html};
}
module.exports={preview};
