'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const cloud=require('../src/main/cloud-ai');
const ai=require('../src/main/ai');
const pdf={mimeType:'application/pdf',data:Buffer.from('%PDF-1.7\nsynthetic transport fixture').toString('base64')};
const messages=[{role:'system',content:'rules'},{role:'user',content:'earlier'},{role:'assistant',content:'prior answer'},{role:'user',content:'summarize'},{role:'assistant',content:'later'}];
const image={mimeType:'image/png',data:Buffer.from('fixture-image').toString('base64')};
const base={model:'fixture-model',apiKey:'fixture-key',messages,documents:[pdf],images:[image]};
for(const provider of ['gemini','anthropic'])test(`${provider} PDF transport through ai.chat retains images and final user ownership`,async t=>{
 let requests=0;
 const server=http.createServer(async(req,res)=>{
  requests++;let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);
  if(provider==='gemini'){
   assert.equal(req.url,'/v1beta/models/fixture-model:generateContent');assert.equal(req.headers['x-goog-api-key'],'fixture-key');
   assert.deepEqual(body.contents[2].parts,[{inlineData:pdf},{text:'summarize'},{inlineData:image}]);
   assert.deepEqual(body.contents[0].parts,[{text:'earlier'}]);assert.deepEqual(body.contents[3].parts,[{text:'later'}]);
   res.end(JSON.stringify({candidates:[{content:{parts:[{text:'fixture summary'}]}}]}));
  }else{
   assert.equal(req.url,'/v1/messages');assert.equal(req.headers['anthropic-version'],'2023-06-01');assert.equal(body.system,'rules');
   assert.deepEqual(body.messages[2].content,[{type:'document',source:{type:'base64',media_type:pdf.mimeType,data:pdf.data}},{type:'text',text:'summarize'},{type:'image',source:{type:'base64',media_type:image.mimeType,data:image.data}}]);
   assert.deepEqual(body.messages[0].content,[{type:'text',text:'earlier'}]);assert.deepEqual(body.messages[3].content,[{type:'text',text:'later'}]);
   res.end(JSON.stringify({content:[{type:'text',text:'fixture summary'}]}));
  }
 });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const result=await ai.chat({aiProvider:provider,aiEndpoint:`http://127.0.0.1:${server.address().port}`,aiModel:base.model},messages,base.apiKey,{documents:[pdf],images:[image]});
 assert.equal(result,'fixture summary');assert.equal(requests,1);
});
test('PDF strict schema, canonical base64, type, size and user-turn validation',()=>{
 for(const documents of [null,{},[pdf,pdf],[{...pdf,title:'extra'}],[{...pdf,mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}],[{...pdf,data:'JVBERi0=\n'}],[{...pdf,data:'JVBERi1='}],[{...pdf,data:Buffer.from('plain text').toString('base64')}],[{...pdf,data:Buffer.concat([Buffer.from('%PDF-'),Buffer.alloc(8*1024**2)]).toString('base64')}]])assert.throws(()=>cloud.buildRequest({...base,provider:'gemini',documents}),/PDF/);
 assert.throws(()=>cloud.buildRequest({...base,provider:'gemini',messages:[{role:'assistant',content:'no user'}]}),/user message/);
 const exact=Buffer.alloc(8*1024**2);exact.write('%PDF-1.7');assert.doesNotThrow(()=>cloud.buildRequest({...base,provider:'anthropic',images:[],documents:[{mimeType:'application/pdf',data:exact.toString('base64')}]}));
});
test('unsupported PDF providers and Ollama reject before any network call',async t=>{
 const original=global.fetch;let calls=0;global.fetch=async()=>{calls++;throw Error('unexpected fetch');};t.after(()=>global.fetch=original);
 for(const provider of Object.keys(cloud.PROVIDERS).filter(x=>!['gemini','anthropic'].includes(x)))await assert.rejects(cloud.chat({...base,provider}),/does not support PDF/);
 await assert.rejects(ai.chat({aiProvider:'ollama',aiEndpoint:'http://127.0.0.1:11434'},messages,'',{documents:[pdf]}),/does not support PDF/);
 assert.equal(calls,0);
});
