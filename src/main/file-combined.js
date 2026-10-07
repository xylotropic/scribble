"use strict";
const fs=require('node:fs/promises'),path=require('node:path');
const EXTENSIONS=Object.freeze({'pdf-merge':'pdf','archive-create':'zip'});
const fold=value=>value.normalize('NFC').toLowerCase();
function outputName(operation,value) {
 const extension=EXTENSIONS[operation];if(!extension)throw Error('Unsupported combined file operation');
 if(value===undefined)return operation==='pdf-merge'?'merged.pdf':'archive.zip';
 if(typeof value!=='string')throw Error('Output filename must be a basename');
 let name=value.trim();if((name.startsWith('"')&&name.endsWith('"'))||(name.startsWith("'")&&name.endsWith("'")))name=name.slice(1,-1);
 if(!name||name.length>150||Buffer.byteLength(name)>240||/[\x00-\x1f\x7f/\\:]/.test(name)||name.includes('..')||name.startsWith('.')||name.endsWith('.')||name.trim()!==name)throw Error('Output filename must be a bounded basename without paths or traversal');
 const supplied=path.extname(name).slice(1);if(supplied&&supplied.toLowerCase()!==extension)throw Error('Output filename must use .'+extension);
 return supplied?name:name+'.'+extension;
}
function matches(stat,file){return !stat.isSymbolicLink()&&(stat.isFile()||stat.isDirectory())&&stat.isDirectory()===file.directory&&['dev','ino','size','mtimeMs','ctimeMs'].every(key=>stat[key]===file[key]);}
async function absent(output){const target=fold(path.basename(output)),dir=await fs.opendir(path.dirname(output));let count=0;for await(const entry of dir){if(++count>100000)throw Error('Output directory exceeds 100,000 entries');if(fold(entry.name)===target)throw Error('Output already exists (including a case-equivalent name): '+output);}}
async function preflight({operation,files,expected,outputName:name}) {
 if(!Object.hasOwn(EXTENSIONS,operation))throw Error('Unsupported combined file operation');
 if(!Array.isArray(files)||!files.length||files.length>32||(operation==='pdf-merge'&&files.length<2)||!Array.isArray(expected)||expected.length!==files.length)throw Error('Invalid selected combined input count or identities');
 if(files.some((input,index)=>typeof input!=='string'||!path.isAbsolute(input)||input.length>4096||/[\x00-\x1f\x7f]/.test(input)||expected[index]?.path!==input))throw Error('Selected paths must be bounded absolute paths');
 const filename=outputName(operation,name),output=path.join(path.dirname(files[0]),filename),parent=path.dirname(output);
 if(output.length>4096)throw Error('Combined output path is too long');
 const parentStat=await fs.lstat(parent);
 if(!parentStat.isDirectory()||parentStat.isSymbolicLink())throw Error('Output parent must be a regular directory');
 const canonicalParent=await fs.realpath(parent),canonicalOutput=fold(path.join(canonicalParent,filename));
 let inputBytes=0;
 const identities=new Set(),names=new Set(),archiveNames=new Set();
 for(let index=0;index<files.length;index++){
  const input=files[index];if(typeof input!=='string'||!path.isAbsolute(input)||input.length>4096||/[\x00-\x1f\x7f]/.test(input)||expected[index].path!==input)throw Error('Selected paths must be bounded absolute paths');
  const stat=await fs.lstat(input).catch(()=>null);if(!stat||!matches(stat,expected[index]))throw Error('Selected file changed after command activation');
  if(operation==='pdf-merge'&&(!stat.isFile()||path.extname(input).toLowerCase()!=='.pdf'))throw Error('Select only PDF files for merging');
  const canonical=fold(await fs.realpath(input)),identity=stat.dev+':'+stat.ino;
  if(names.has(canonical)||identities.has(identity))throw Error('Duplicate or case-equivalent selected inputs');names.add(canonical);identities.add(identity);
  if(canonicalOutput===canonical||(stat.isDirectory()&&canonicalOutput.startsWith(canonical.endsWith(path.sep)?canonical:canonical+path.sep)))throw Error('Output must not replace or be inside an input');
  if(operation==='archive-create'){if(stat.isFile()&&(inputBytes+=stat.size)>512*1024*1024)throw Error('Archive inputs exceed 512 MB resource limit');const basename=fold(path.basename(input));if(archiveNames.has(basename))throw Error('Selected inputs have duplicate or case-equivalent archive names');archiveNames.add(basename);}
 }
 await absent(output);
 const plan={operation,files:[...files],expected:expected.map(file=>({...file})),output,parent,canonicalParent,parentIdentity:{dev:parentStat.dev,ino:parentStat.ino}};
 await verify(plan);return plan;
}
async function verify(plan){
 const parent=await fs.lstat(plan.parent);if(!parent.isDirectory()||parent.isSymbolicLink()||parent.dev!==plan.parentIdentity.dev||parent.ino!==plan.parentIdentity.ino||await fs.realpath(plan.parent)!==plan.canonicalParent)throw Error('Output parent changed after preflight');
 for(let index=0;index<plan.files.length;index++){const stat=await fs.lstat(plan.files[index]).catch(()=>null);if(!stat||!matches(stat,plan.expected[index]))throw Error('Selected file changed after command activation');}
 await absent(plan.output);
}
module.exports={outputName,preflight,verify};
