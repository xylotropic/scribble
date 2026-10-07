'use strict';
const sharp = require('sharp');
const LIMITS = Object.freeze({images:5,bytes:3*1024*1024,dimension:1536,sample:128});
const MIME_FORMATS = Object.freeze({'image/jpeg':'jpeg','image/png':'png','image/webp':'webp'});
function isScreenPaletteCommand(text) {
  return typeof text==='string' && text.length<=300 && !/[\x00-\x1f\x7f;]/.test(text) && /^(?:get|extract|generate|create|make|show) (?:a |the )?(?:color |colour )?palette (?:on|from) (?:the |this )?(?:screen|display)[.!?]?$/i.test(text.trim());
}
async function paletteFromImages(images,{colors=6}={}) {
  if(!Number.isInteger(colors)||colors<1||colors>16)throw new Error('Palette colors must be an integer between1 and16');
  if(!Array.isArray(images)||images.length<1||images.length>LIMITS.images)throw new Error('Choose between1 and5 screen images');
  const bins=new Map();let sampledPixels=0;const sources=[];
  for(const item of images){
    if(!item||typeof item!=='object'||!MIME_FORMATS[item.mimeType]||typeof item.data!=='string')throw new Error('Screen images require JPEG, PNG, or WebP MIME and base64 data');
    if(!item.data.length||item.data.length>4*Math.ceil(LIMITS.bytes/3)||item.data.length%4!==0||/[^A-Za-z0-9+/=]/.test(item.data))throw new Error('Screen image base64 is invalid or exceeds3MiB');
    const bytes=Buffer.from(item.data,'base64');
    if(bytes.length>LIMITS.bytes||bytes.toString('base64')!==item.data)throw new Error('Screen image base64 must be canonical and at most3MiB');
    const image=sharp(bytes,{limitInputPixels:LIMITS.dimension**2,failOn:'warning'});
    const metadata=await image.metadata();
    if(metadata.format!==MIME_FORMATS[item.mimeType])throw new Error('Screen image MIME does not match encoded bytes');
    if(!metadata.width||!metadata.height||metadata.width>LIMITS.dimension||metadata.height>LIMITS.dimension||(metadata.pages||1)!==1)throw new Error('Screen image must be one frame with dimensions at most1536');
    if(item.width!==undefined&&item.width!==metadata.width||item.height!==undefined&&item.height!==metadata.height)throw new Error('Screen image declared dimensions do not match encoded bytes');
    const {data,info}=await image.toColourspace('srgb').resize({width:LIMITS.sample,height:LIMITS.sample,fit:'inside',withoutEnlargement:true,kernel:'nearest'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    let visible=0;
    for(let i=0;i<data.length;i+=4){if(data[i+3]<128)continue;visible++;sampledPixels++;const key=(data[i]>>5)*64+(data[i+1]>>5)*8+(data[i+2]>>5);const bin=bins.get(key)||{count:0,r:0,g:0,b:0};bin.count++;bin.r+=data[i];bin.g+=data[i+1];bin.b+=data[i+2];bins.set(key,bin);}
    sources.push({width:metadata.width,height:metadata.height,sampleWidth:info.width,sampleHeight:info.height,visibleSampledPixels:visible});
  }
  if(!sampledPixels)throw new Error('Screen images contain no visible pixels for a palette');
  const result=[...bins.entries()].sort((a,b)=>b[1].count-a[1].count||a[0]-b[0]).slice(0,colors).map(([,bin])=>{const rgb=[bin.r,bin.g,bin.b].map(x=>Math.round(x/bin.count));return {hex:'#'+rgb.map(x=>x.toString(16).padStart(2,'0')).join(''),rgb,proportion:bin.count/sampledPixels,count:bin.count};});
  return {colors:result,sourceCount:images.length,sampledPixels,sources,method:'Combined visible nearest-neighbor sampled pixels; RGB bins of width32 with mean color per bin. Each image contributes its sampled pixel count; alpha below128 is ignored.'};
}
module.exports={paletteFromImages,isScreenPaletteCommand,LIMITS};
