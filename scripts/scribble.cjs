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
      res.on('end', () => { try { const result = JSON.parse(response); if (result.ok !== true) throw new Error(result.error || `Scribble request failed (${res.statusCode})`); resolve(result.value); } catch (error) { reject(error); } });
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
async function execute(command, args, send = request) {
  if (command === 'status') { const s = await send('state'); return { version: s.version, platform: s.platform, nativeAvailable: s.nativeAvailable, speechStatus: s.speechStatus, dataDir: s.dataDir, recordings: s.history?.length || 0, notes: s.notes?.length || 0 }; }
  if (['history', 'search'].includes(command)) { const s = await send('state'); const query = args.join(' ').toLocaleLowerCase(); return (s.history || []).filter(item => !query || [item.text, item.original, item.title, item.error].some(v => String(v || '').toLocaleLowerCase().includes(query))); }
  if (command === 'notes') { const s = await send('state'); return args[0] ? (s.notes || []).find(n => n.id === args[0]) || (() => { throw Error('Note not found'); })() : s.notes || []; }
  if (command === 'models') return send('models');
  if (command === 'settings') { if (!args.length) return (await send('state')).settings; const patch = JSON.parse(args.join(' ')); if (!patch || Array.isArray(patch) || typeof patch !== 'object') throw Error('Settings patch must be a JSON object'); return (await send('preferences', patch)).settings; }
  if (command === 'transcribe') { if (!args[0]) throw Error('Usage: scribble transcribe FILE [--note]'); const file = path.resolve(args[0]); const stat = fs.statSync(file); if (!stat.isFile()) throw Error('Transcription input must be a file'); return send('transcribe-file', { file, kind: args.includes('--note') ? 'note' : 'file' }); }
  if (command === 'record') { const mode = args[0] || 'dictation'; if (!['dictation', 'command', 'note'].includes(mode)) throw Error('Recording mode must be dictation, command, or note'); await send('start-recording', { mode }); return { requested: true, mode }; }
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
  ['scribble_command', 'Run an instruction through Scribble; it may act on apps or send context to the configured AI provider.', { text: { type: 'string' } }, ['text']]
].map(([name, description, properties, required = []]) => ({ name, description, inputSchema: { type: 'object', properties, required, additionalProperties: false }, annotations: { readOnlyHint: ['scribble_status', 'scribble_history', 'scribble_models', 'scribble_notes'].includes(name), openWorldHint: ['scribble_transcribe', 'scribble_command'].includes(name) } }));
function validateTool(name, value = {}) {
  const tool = toolDefinitions.find(t => t.name === name); if (!tool) throw Error(`Unknown tool: ${name}`);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Tool arguments must be an object');
  for (const key of tool.inputSchema.required) if (!(key in value)) throw Error(`Missing required argument: ${key}`);
  for (const [key, v] of Object.entries(value)) { const schema = tool.inputSchema.properties[key]; if (!schema) throw Error(`Unknown argument: ${key}`); if (schema.type === 'array' ? !Array.isArray(v) || v.some(x => typeof x !== 'string') : schema.type === 'object' ? !v || typeof v !== 'object' || Array.isArray(v) : typeof v !== schema.type) throw Error(`Invalid argument: ${key}`); if (schema.enum && !schema.enum.includes(v)) throw Error(`Invalid argument: ${key}`); }
  return value;
}
async function invokeTool(name, value, send) {
  const args = validateTool(name, value);
  const commands = { scribble_status: ['status', []], scribble_history: ['history', args.query ? [args.query] : []], scribble_models: ['models', []], scribble_transcribe: ['transcribe', [args.file, ...(args.note ? ['--note'] : [])]], scribble_notes: ['notes', args.id ? [args.id] : []], scribble_dictionary: ['dictionary', args.word ? [args.word, ...(args.aliases || [])] : []], scribble_settings: ['settings', args.patch ? [JSON.stringify(args.patch)] : []], scribble_record: ['record', args.mode ? [args.mode] : []], scribble_cancel: ['cancel', []], scribble_command: ['command', [args.text]] };
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
    else if (message.method === 'tools/call') { try { const value = await invokeTool(message.params?.name, message.params?.arguments || {}, send); result = { content: [{ type: 'text', text: JSON.stringify(value ?? null, null, 2) }], isError: false }; } catch (error) { result = { content: [{ type: 'text', text: error.message }], isError: true }; } }
    else return { jsonrpc: '2.0', id: message.id, error: { code: -32601, message: `Method not found: ${message.method}` } };
    return { jsonrpc: '2.0', id: message.id, result };
  } catch (error) { return { jsonrpc: '2.0', id: message.id, error: { code: -32603, message: error.message } }; }
}
function startMCP(input = process.stdin, output = process.stdout, send = request) {
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  lines.on('line', async line => { if (!line.trim()) return; let result; try { result = await rpc(JSON.parse(line), send); } catch { result = { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }; } if (result) output.write(JSON.stringify(result) + '\n'); });
  return lines;
}
const help = `Scribble CLI (requires running Mac app)\nUsage: scribble COMMAND [ARGS] [--json]\n  status | history [QUERY] | search QUERY | models | notes [ID]\n  settings [JSON_PATCH] | dictionary [WORD [ALIAS...]]\n  transcribe FILE [--note] | record [dictation|command|note] | cancel\n  command INSTRUCTION\n  --mcp    Run the stdio MCP server\nEnvironment: SCRIBBLE_DATA_DIR selects the app data/socket directory.\n`;
async function main(argv = process.argv.slice(2)) { const parsed = parseArgs(argv); if (parsed.mcp) return startMCP(); if (['help', '--help', '-h'].includes(parsed.command)) { process.stdout.write(help); return; } try { const result = await execute(parsed.command, parsed.args); process.stdout.write(parsed.json ? JSON.stringify(result ?? null) + '\n' : typeof result === 'string' ? result + '\n' : JSON.stringify(result ?? null, null, 2) + '\n'); } catch (error) { process.stderr.write(`Scribble: ${error.message}\n`); process.exitCode = 1; } }
if (require.main === module) main();
module.exports = { socketPath, request, parseArgs, execute, toolDefinitions, validateTool, invokeTool, rpc, startMCP, main };
