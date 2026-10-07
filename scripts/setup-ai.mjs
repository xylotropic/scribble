#!/usr/bin/env node
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';

export const release = Object.freeze({ version: '0.40.0', url: 'https://github.com/ollama/ollama/releases/download/v0.40.0/ollama-darwin.tgz', sha256: 'b490b4925a95c5f3dfcd889e566cf3dcd727848d59057fb00b03f1d6630326dc' });
export function validateModel(model) { if (!/^qwen3:(?:0\.6b|4b)$/.test(model)) throw Error('Choose the explicitly local model qwen3:0.6b or qwen3:4b'); return model; }
export function validateEndpoint(value) { const url = new URL(value); if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw Error('AI setup accepts only an http://127.0.0.1:PORT endpoint'); return url.origin; }
async function run(binary, args, options = {}) { await new Promise((resolve, reject) => { const child = spawn(binary, args, { stdio: 'inherit', ...options }); child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(Error(`${path.basename(binary)} exited with ${code}`))); }); }
export async function api(endpoint, pathname, body, fetcher = fetch) { const result = await fetcher(endpoint + pathname, { ...(body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30 * 60 * 1000) }); if (!result.ok) throw Error(`Ollama ${pathname}: ${result.status} ${await result.text()}`); const value = await result.json(); if (value.error) throw Error(value.error); return value; }
export async function setup(options = {}) {
  const model = validateModel(options.model || 'qwen3:0.6b'); const endpoint = validateEndpoint(options.endpoint || 'http://127.0.0.1:11434');
  const root = path.resolve(options.root || path.join(os.homedir(), '.local/share/scribble-tools/ollama'));
  let binary = options.binary || [path.join(root, release.version, 'bin/ollama'), path.join(root, release.version, 'ollama'), path.join(root, release.version, 'Ollama.app/Contents/Resources/ollama')].find(file => fs.existsSync(file)) || path.join(root, release.version, 'bin/ollama');
  if (!fs.existsSync(binary)) {
    if (process.platform !== 'darwin') throw Error('Automatic runtime installation currently supports Mac. Install official Ollama for your OS and pass --binary PATH.');
    await fsp.mkdir(root, { recursive: true });
    const archive = path.join(root, `ollama-${release.version}-darwin.tgz`);
    if (!fs.existsSync(archive)) { console.log(`Downloading official Ollama ${release.version}…`); const response = await fetch(release.url); if (!response.ok) throw Error(`Download failed: ${response.status}`); await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(archive + '.partial')); await fsp.rename(archive + '.partial', archive); }
    const hash = crypto.createHash('sha256'); for await (const chunk of fs.createReadStream(archive)) hash.update(chunk); if (hash.digest('hex') !== release.sha256) throw Error('Runtime SHA-256 mismatch; refusing extraction');
    const destination = path.join(root, release.version); await fsp.mkdir(destination, { recursive: true });
    await run('/usr/bin/tar', ['-xzf', archive, '-C', destination]);
    if (!fs.existsSync(binary)) { const alternatives = [path.join(destination, 'ollama'), path.join(destination, 'Ollama.app/Contents/Resources/ollama')]; binary = alternatives.find(file => fs.existsSync(file)); if (!binary) throw Error('Official archive lacks expected Ollama binary'); }
    await fsp.writeFile(path.join(root, 'provenance.json'), JSON.stringify({ ...release, binary, archive, installedAt: new Date().toISOString() }, null, 2));
  }
  await fsp.mkdir(root, { recursive: true });
  let existing = false; try { await api(endpoint, '/api/version'); existing = true; } catch {}
  let serverPid;
  if (!existing) {
    const logPath = path.join(root, 'server.log'); const fd = fs.openSync(logPath, 'a', 0o600);
    const child = spawn(binary, ['serve'], { detached: true, stdio: ['ignore', fd, fd], env: { ...process.env, OLLAMA_HOST: new URL(endpoint).host, OLLAMA_NO_CLOUD: '1', OLLAMA_MODELS: path.join(root, 'models') } });
    await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); }); serverPid = child.pid; child.unref(); fs.closeSync(fd);
    await fsp.writeFile(path.join(root, 'server.pid'), String(serverPid));
    let ready = false; for (let i = 0; i < 60; i++) { try { await api(endpoint, '/api/version'); ready = true; break; } catch { await new Promise(resolve => setTimeout(resolve, 500)); } } if (!ready) throw Error(`Local Ollama did not start; inspect ${logPath}`);
  } else console.log('Reusing the existing local Ollama endpoint without changing its service configuration.');
  console.log(`Pulling local ${model} (model download only)…`); await api(endpoint, '/api/pull', { model, stream: false });
  const version = await api(endpoint, '/api/version'); const models = await api(endpoint, '/api/tags');
  const generated = await api(endpoint, '/api/chat', { model, stream: false, think: false, messages: [{ role: 'user', content: 'Reply with only the word ready.' }], options: { temperature: 0, num_predict: 24 } });
  if (!generated.message?.content?.trim()) throw Error('Local model returned no generated content');
  const evidence = { verifiedAt: new Date().toISOString(), endpoint, model, version, serverPid, reusedExistingService: existing, modelInfo: models.models?.find(x => x.name === model), request: 'Reply with only the word ready.', response: generated.message.content.trim(), done: generated.done, evalCount: generated.eval_count, totalDuration: generated.total_duration };
  await fsp.writeFile(path.join(root, 'verification.json'), JSON.stringify(evidence, null, 2)); console.log(JSON.stringify(evidence, null, 2)); return evidence;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) { const args = process.argv.slice(2); const value = flag => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : undefined; }; setup({ model: value('--model'), endpoint: value('--endpoint'), binary: value('--binary'), root: value('--root') }).catch(error => { console.error(error.message); process.exitCode = 1; }); }
