#!/usr/bin/env node
'use strict';
const http = require('node:http');
const path = require('node:path');
const os = require('node:os');
const readline = require('node:readline');
const fs = require('node:fs');

function socketPath(env = process.env) { return path.join(env.SCRIBBLE_DATA_DIR || path.join(os.homedir(), 'Library', 'Application Support', 'Scribble'), 'scribble.sock'); }
function request(action, args = {}, options = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ action, args });
    const req = http.request({ socketPath: options.socketPath || socketPath(), path: '/', method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } }, res => {
      let response = ''; res.setEncoding('utf8');
      res.on('data', data => { response += data; if (response.length > 20 * 1024 * 1024) req.destroy(new Error('Scribble response exceeds 20 MB')); });
      res.on('end', () => { try { const result = JSON.parse(response); if (res.statusCode<200||res.statusCode>=300||result.ok !== true) throw new Error(result.error || `Scribble request failed (${res.statusCode})`); resolve(result.value); } catch (error) { reject(error); } });
      res.on('error', reject);
    });
    req.setTimeout(options.timeout || 30 * 60 * 1000, () => req.destroy(new Error('Scribble request timed out')));
    req.on('error', error => reject(new Error(['ENOENT', 'ECONNREFUSED'].includes(error.code) ? 'Scribble is not running. Launch the Mac app first, or set SCRIBBLE_DATA_DIR to its data folder.' : error.message)));
    req.end(body);
  });
}
function parseArgs(argv) {
  const json = argv.includes('--json'); const mcp = argv.includes('--mcp');
  const args = argv.filter(x => !['--json', '--mcp'].includes(x)); const command = args.shift() || 'help';
  return { command, args, json, mcp };
}
function historyFilter(items, args) {
  const options={},query=[];
  for(let i=0;i<args.length;i++){const token=args[i];if(['--kind','--since','--until','--limit'].includes(token)){if(args[i+1]===undefined)throw Error('Missing value for '+token);options[token.slice(2)]=args[++i];}else if(token==='--original')options.original=true;else if(token==='--revisions')options.revisions=true;else if(token.startsWith('--'))throw Error('Unknown history option: '+token);else query.push(token);}
  for(const key of ['since','until'])if(options[key]!==undefined&&!Number.isFinite(Date.parse(options[key])))throw Error('Invalid '+key+' timestamp');
  if(options.limit!==undefined&&(!/^\d+$/.test(options.limit)||Number(options.limit)>10000))throw Error('History limit must be between 0 and 10000');
  const needle=query.join(' ').toLocaleLowerCase();let matches=items.filter(item=>(!options.kind||item.kind===options.kind)&&(!options.since||Date.parse(item.createdAt)>=Date.parse(options.since))&&(!options.until||Date.parse(item.createdAt)<=Date.parse(options.until))&&(!needle||[item.text,item.original,item.title,item.error,item.command,...(item.revisions||[]).flatMap(r=>[r.text,r.instruction,r.context])].some(v=>String(v||'').toLocaleLowerCase().includes(needle))));
  if(options.limit!==undefined)matches=matches.slice(0,Number(options.limit));
  return matches.map(item=>options.original?{...item,text:item.original??item.text}:options.revisions?{...item,revisions:item.revisions||[]}:item);
}
function required(value,usage){if(value===undefined||value==='')throw Error('Usage: scribble '+usage);return value;}
function historyText(item,args){if(args.includes('--original')&&args.includes('--revision'))throw Error('Choose original text or a revision, not both');if(args.includes('--original')){if(typeof item.original!=='string')throw Error('Original transcript was not retained');return item.original;}const index=args.indexOf('--revision');if(index>=0){const value=Number(required(args[index+1],'history copy ID --revision INDEX'));if(!Number.isInteger(value)||value<0||!item.revisions?.[value])throw Error('Revision not found');return item.revisions[value].text;}return item.text||'';}
async function execute(command, args, send = request) {
  if (command === 'status') { const s = await send('state'); return { version: s.version, platform: s.platform, nativeAvailable: s.nativeAvailable, speechStatus: s.speechStatus, dataDir: s.dataDir, recordings: s.history?.length || 0, notes: s.notes?.length || 0 }; }
  if (['history','search'].includes(command)) {
    if(command==='history'&&['get','original','revisions','copy','retry'].includes(args[0])){const action=args[0],id=required(args[1],'history '+action+' ID');if(action==='retry')return send('retry',{id});const item=(await send('state')).history?.find(x=>x.id===id);if(!item)throw Error('History entry not found');if(action==='get')return item;if(action==='original')return historyText(item,['--original']);if(action==='revisions')return item.revisions||[];const text=historyText(item,args.slice(2));await send('copy',{text});return{copied:true,id};}
    return historyFilter((await send('state')).history||[],args[0]==='list'?args.slice(1):args);
  }
  if(command==='notes'&&args[0]==='transcribe')return execute('transcribe',[required(args[1],'notes transcribe FILE'),'--note',...args.slice(2)],send);
  if (command === 'notes') { args=args[0]==='list'?[]:args[0]==='get'?[required(args[1],'notes get ID')]:args;const s = await send('state'); return args[0] ? (s.notes || []).find(n => n.id === args[0]) || (() => { throw Error('Note not found'); })() : s.notes || []; }
  if(['models','model'].includes(command)){if(!args.length||args[0]==='list')return send('models');const action=args[0],id=required(args[1],'models '+action+' ID');if(action==='select'){if(!(await send('models')).some(model=>model.id===id))throw Error('Speech model not found');return (await send('preferences',{modelId:id,speechProvider:'local'})).settings;}const route={download:'download-model',cancel:'cancel-download',delete:'delete-model'}[action];if(!route)throw Error('Unknown model action: '+action);return send(route,{id});}
  if(command==='memory'){const action=args[0]||'list';if(action==='reindex'){const result=await send('memory-reindex',{id:required(args[1],'memory reindex ID')});if(result?.status==='error')throw Error(result.error||'Memory indexing failed');return result;}if(!['list','status','get'].includes(action))throw Error('Unknown memory action: '+action);if(action==='get')required(args[1],'memory get ID');let items=(await send('state')).memory||[];if(args[1]){items=items.filter(x=>x.id===args[1]);if(!items.length)throw Error('Memory not found');}if(action==='status')return items.map(({id,name,status,error,indexedAt,enabled})=>({id,name,status,error,indexedAt,enabled}));return action==='get'?items[0]:items;}
  if(command==='tones'){const action=args[0]||'list';if(action==='auto'){await send('select-tone',{id:''});return{automatic:true};}if(action==='pin'){const id=required(args[1],'tones pin ID');await send('select-tone',{id});return{pinned:id};}if(action!=='list')throw Error('Unknown tone action: '+action);const state=await send('state');return{tones:state.tones||[],pinnedToneId:state.settings?.pinnedToneId||''};}
  if(command==='stop'){await send('stop-recording');return{requested:true};}
  if(command==='paste-last')return send('paste-last');
  if (command === 'settings') { if(args[0]==='get'){const settings=(await send('state')).settings;if(!args[1])return settings;if(!Object.hasOwn(settings,args[1]))throw Error('Unknown preference: '+args[1]);return settings[args[1]];}if(args[0]==='set'){args=args.length===2?[args[1]]:[JSON.stringify({[required(args[1],'settings set KEY JSON_VALUE')]:JSON.parse(required(args.slice(2).join(' '),'settings set KEY JSON_VALUE'))})];}if (!args.length) return (await send('state')).settings; const patch = JSON.parse(args.join(' ')); if (!patch || Array.isArray(patch) || typeof patch !== 'object') throw Error('Settings patch must be a JSON object'); return (await send('preferences', patch)).settings; }
  if (command === 'transcribe') { if (!args[0]) throw Error('Usage: scribble transcribe FILE [--note]'); const file = path.resolve(args[0]); const stat = fs.statSync(file); if (!stat.isFile()) throw Error('Transcription input must be a file'); const index=args.indexOf('--template');return send('transcribe-file', { file, kind: args.includes('--note') ? 'note' : 'file', ...(index>=0?{template:required(args[index+1],'transcribe FILE --template TEMPLATE')}:{}) }); }
  if (command === 'record') { if(args[0]==='stop')return execute('stop',[],send);if(args[0]==='cancel')return execute('cancel',[],send);if(args[0]==='start')args=args.slice(1);const mode = args[0] || 'dictation'; if (!['dictation', 'command', 'note'].includes(mode)) throw Error('Recording mode must be dictation, command, or note'); await send('start-recording', { mode }); return { requested: true, mode }; }
  if (command === 'cancel') { await send('cancel-recording'); return { cancelled: true }; }
  if (command === 'dictionary') { if (!args.length) return (await send('state')).dictionary || []; const item = { word: args[0], aliases: args.slice(1) }; return send('save-item', { kind: 'dictionary', item }); }
  if (command === 'command') { if (!args.length) throw Error('Usage: scribble command INSTRUCTION'); return send('command', { text: args.join(' ') }); }
  throw Error(`Unknown command: ${command}`);
}
const toolDefinitions = [
  ['scribble_status', 'Inspect the running Scribble app and speech engine.', {}],
  ['scribble_history', 'Read transcription history, optionally matching a text query.', { query: { type: 'string' } }],
  ['scribble_models', 'List available local speech models and installed state.', {}],
  ['scribble_transcribe', 'Transcribe an existing absolute audio/video file using current app settings. May send audio to a configured cloud provider.', { file: { type: 'string' }, note: { type: 'boolean' } }, ['file']],
  ['scribble_notes', 'List meeting notes or read one by its id.', { id: { type: 'string' } }],
  ['scribble_dictionary', 'List vocabulary or add a word with optional aliases.', { word: { type: 'string' }, aliases: { type: 'array', items: { type: 'string' } } }],
  ['scribble_settings', 'Read settings or update a JSON settings object.', { patch: { type: 'object' } }],
  ['scribble_record', 'Request live microphone recording. Requires an open and permissioned Scribble app.', { mode: { type: 'string', enum: ['dictation', 'command', 'note'] } }],
  ['scribble_cancel', 'Cancel the current recording or transcription.', {}],
  ['scribble_command', 'Run an instruction through Scribble; it may act on apps or send context to the configured AI provider.', { text: { type: 'string' } }, ['text']],
  ['scribble_stop','Stop and save the current microphone recording using configured speech/AI providers.',{}],
  ['scribble_paste_last','Request insertion of the latest dictation in the active application.',{}],
  ['scribble_history_entry','Inspect original text/revisions, copy a retained revision, or retry retained audio. Retry follows configured providers.',{id:{type:'string'},action:{type:'string',enum:['get','original','revisions','copy','retry']},original:{type:'boolean'},revision:{type:'number'}},['id','action']],
  ['scribble_history_filter','Search final/original/command revisions and filter by kind/time/limit.',{query:{type:'string'},kind:{type:'string'},since:{type:'string'},until:{type:'string'},limit:{type:'number'},original:{type:'boolean'},revisions:{type:'boolean'}}],
  ['scribble_model_manage','Select, explicitly download, cancel download, or remove a local speech model.',{action:{type:'string',enum:['select','download','cancel','delete']},id:{type:'string'}},['action','id']],
  ['scribble_memory','Inspect memory/index status or explicitly reindex using configured providers.',{action:{type:'string',enum:['list','get','status','reindex']},id:{type:'string'}}],
  ['scribble_tones','List tones, pin a tone, or restore automatic tone routing.',{action:{type:'string',enum:['list','pin','auto']},id:{type:'string'}}]

].map(([name, description, properties, required = []]) => ({ name, description, inputSchema: { type: 'object', properties, required, additionalProperties: false }, annotations: { readOnlyHint: ['scribble_status', 'scribble_history', 'scribble_history_filter', 'scribble_models', 'scribble_notes'].includes(name), openWorldHint: ['scribble_transcribe', 'scribble_command', 'scribble_stop', 'scribble_history_entry', 'scribble_memory', 'scribble_model_manage'].includes(name) } }));
function validateTool(name, value = {}) {
  const tool = toolDefinitions.find(t => t.name === name); if (!tool) throw Error(`Unknown tool: ${name}`);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Tool arguments must be an object');
  for (const key of tool.inputSchema.required) if (!Object.hasOwn(value,key)) throw Error(`Missing required argument: ${key}`);
  for (const [key, v] of Object.entries(value)) { const schema = tool.inputSchema.properties[key]; if (!schema) throw Error(`Unknown argument: ${key}`); if (schema.type === 'array' ? !Array.isArray(v) || v.some(x => typeof x !== 'string') : schema.type === 'object' ? !v || typeof v !== 'object' || Array.isArray(v) : typeof v !== schema.type) throw Error(`Invalid argument: ${key}`); if (schema.enum && !schema.enum.includes(v)) throw Error(`Invalid argument: ${key}`); }
  return value;
}
async function invokeTool(name, value, send) {
  const args = validateTool(name, value);
  const commands = { scribble_status: ['status', []], scribble_history: ['history', args.query ? [args.query] : []], scribble_models: ['models', []], scribble_transcribe: ['transcribe', [args.file, ...(args.note ? ['--note'] : [])]], scribble_notes: ['notes', args.id ? [args.id] : []], scribble_dictionary: ['dictionary', args.word ? [args.word, ...(args.aliases || [])] : []], scribble_settings: ['settings', args.patch ? [JSON.stringify(args.patch)] : []], scribble_record: ['record', args.mode ? [args.mode] : []], scribble_cancel: ['cancel', []], scribble_command: ['command', [args.text]] };
  const routed={
   scribble_stop:['stop',[]],scribble_paste_last:['paste-last',[]],
   scribble_history_entry:['history',[args.action,args.id,...(args.original?['--original']:[]),...(args.revision!==undefined?['--revision',String(args.revision)]:[])]],
   scribble_history_filter:['history',[args.query||'',...['kind','since','until','limit'].flatMap(key=>args[key]===undefined?[]:['--'+key,String(args[key])]),...(args.original?['--original']:[]),...(args.revisions?['--revisions']:[])]],
   scribble_model_manage:['models',[args.action,args.id]],scribble_memory:['memory',[args.action||'list',...(args.id?[args.id]:[])]],scribble_tones:['tones',[args.action||'list',...(args.id?[args.id]:[])]]
  };Object.assign(commands,routed);
  const [command, commandArgs] = commands[name]; return execute(command, commandArgs, send);
}
async function rpc(message, send = request) {
  if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') return { jsonrpc: '2.0', id: message?.id ?? null, error: { code: -32600, message: 'Invalid JSON-RPC request' } };
  if (message.id === undefined) return null;
  let result;
  try {
    if (message.method === 'initialize') result = { protocolVersion: ['2024-11-05', '2025-03-26', '2025-06-18'].includes(message.params?.protocolVersion) ? message.params.protocolVersion : '2024-11-05', capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'scribble', version: '0.1.0' } };
    else if (message.method === 'ping') result = {};
    else if (message.method === 'tools/list') result = { tools: toolDefinitions };
    else if (message.method === 'tools/call') { try { const value = await invokeTool(message.params?.name, message.params?.arguments === undefined ? {} : message.params.arguments, send); result = { content: [{ type: 'text', text: JSON.stringify(value ?? null, null, 2) }], isError: false }; } catch (error) { result = { content: [{ type: 'text', text: error.message }], isError: true }; } }
    else return { jsonrpc: '2.0', id: message.id, error: { code: -32601, message: `Method not found: ${message.method}` } };
    return { jsonrpc: '2.0', id: message.id, result };
  } catch (error) { return { jsonrpc: '2.0', id: message.id, error: { code: -32603, message: error.message } }; }
}
function startMCP(input = process.stdin, output = process.stdout, send = request) {
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  lines.on('line', async line => { if (!line.trim()) return; let result; try { result = await rpc(JSON.parse(line), send); } catch { result = { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }; } if (result) output.write(JSON.stringify(result) + '\n'); });
  return lines;
}
const help = `Scribble CLI (requires running Mac app)
Usage: scribble COMMAND [ARGS] [--json]
  status | history [QUERY] | search QUERY
  history get|original|revisions|copy|retry ID [--original|--revision INDEX]
  history [QUERY] [--kind KIND] [--since ISO] [--until ISO] [--limit N]
  notes [ID] | notes get ID | notes transcribe FILE [--template TEMPLATE]
  models [list|select|download|cancel|delete ID]
  settings [JSON_PATCH] | settings get [KEY] | settings set KEY JSON_VALUE
  dictionary [WORD [ALIAS...]] | memory list|status|get|reindex [ID]
  tones list|pin ID|auto | paste-last
  transcribe FILE [--note] | record [start] [dictation|command|note]
  stop | record stop | cancel | record cancel | command INSTRUCTION
  --mcp    Run the stdio MCP server
Environment: SCRIBBLE_DATA_DIR selects the app data/socket directory.
`;

async function main(argv = process.argv.slice(2)) { const parsed = parseArgs(argv); if (parsed.mcp) return startMCP(); if (['help', '--help', '-h'].includes(parsed.command)) { process.stdout.write(help); return; } try { const result = await execute(parsed.command, parsed.args); process.stdout.write(parsed.json ? JSON.stringify(result ?? null) + '\n' : typeof result === 'string' ? result + '\n' : JSON.stringify(result ?? null, null, 2) + '\n'); } catch (error) { process.stderr.write(`Scribble: ${error.message}\n`); process.exitCode = 1; } }
if (require.main === module) main();
module.exports = { historyFilter, socketPath, request, parseArgs, execute, toolDefinitions, validateTool, invokeTool, rpc, startMCP, main };
