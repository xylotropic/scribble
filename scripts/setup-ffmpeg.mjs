#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootArg = process.argv.indexOf('--package-root');
if(rootArg >= 0 && !process.argv[rootArg + 1]) throw Error('--package-root requires a directory');
const repo = path.resolve(rootArg >= 0 ? process.argv[rootArg + 1] : path.join(scriptDir, '..'));
let manifestPath = path.join(repo,'docs/licenses/ffmpeg-sources.json');
try { await fs.access(manifestPath); } catch { manifestPath = path.join(path.dirname(fileURLToPath(import.meta.url)),'ffmpeg-sources.json'); }
const manifest = JSON.parse(await fs.readFile(manifestPath,'utf8'));
const root = process.env.SCRIBBLE_FFMPEG_BUILD_DIR || path.join(os.homedir(),'.local/share/scribble-tools/ffmpeg-build');
if (/\s/.test(root)) throw Error('Build directory must have no spaces for upstream makefiles');
const prefix = path.join(root,'prefix'); const downloads = path.join(root,'downloads'); const sources = path.join(root,'sources');
const compatibleSDK = '/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk';
let compatibleExists = true; try { await fs.access(compatibleSDK); } catch { compatibleExists = false; }
const sdk = process.env.SCRIBBLE_MACOS_SDK || (compatibleExists ? compatibleSDK : spawnSync('/usr/bin/xcrun',['--show-sdk-path'],{encoding:'utf8'}).stdout?.trim());
if (!sdk) throw Error('macOS SDK unavailable; set SCRIBBLE_MACOS_SDK');
await fs.access(sdk);
const requestedArch = process.env.SCRIBBLE_TARGET_ARCH || process.arch;
const architecture = requestedArch === 'x86_64' ? 'x64' : requestedArch;
if (!['arm64','x64'].includes(architecture)) throw Error(`Unsupported FFmpeg architecture: ${requestedArch}`);
const cross = architecture !== process.arch;
if (cross && (!process.env.SCRIBBLE_FFMPEG_BUILD_DIR || !(process.env.SCRIBBLE_FFMPEG_STAGE_DIR || process.env.SCRIBBLE_FFMPEG_OUTPUT_DIR))) throw Error('Cross-target FFmpeg builds require isolated build and stage directories');
const target = architecture === 'x64' ? 'x86_64' : 'arm64';
if (cross && path.resolve(root) === path.join(os.homedir(),'.local/share/scribble-tools/ffmpeg-build')) throw Error('Cross-target FFmpeg builds cannot reuse the installed build directory');
try { if (cross && await fs.realpath(root) === await fs.realpath(path.join(os.homedir(),'.local/share/scribble-tools/ffmpeg-build'))) throw Error('Cross-target FFmpeg directory resolves to installed build'); } catch (error) { if(error.code!=='ENOENT') throw error; }
const hasNasm = spawnSync('/usr/bin/which',['nasm'],{encoding:'utf8'}).status === 0;
const env = {...process.env,SDKROOT:sdk,CC:'/usr/bin/clang',CXX:'/usr/bin/clang++',PATH:`${prefix}/bin:${process.env.PATH}`,PKG_CONFIG_PATH:`${prefix}/lib/pkgconfig`,MACOSX_DEPLOYMENT_TARGET:'13.0',CFLAGS:`-O2 -arch ${target} -isysroot ${sdk} -mmacosx-version-min=13.0`,CXXFLAGS:`-O2 -arch ${target} -isysroot ${sdk} -mmacosx-version-min=13.0`,LDFLAGS:`-arch ${target} -isysroot ${sdk} -mmacosx-version-min=13.0`};
const recipes = {
 pkgconf:['./configure',`--prefix=${prefix}`,'--disable-shared','--enable-static'],
 x264:['./configure',`--prefix=${prefix}`,'--enable-static','--disable-cli','--disable-opencl','--disable-asm','--enable-pic',`--host=${target}-apple-darwin`],
 vpx:['./configure',`--prefix=${prefix}`,`--target=${architecture === 'x64' && !hasNasm ? 'generic-gnu' : `${target}-darwin25-gcc`}`,'--disable-shared','--enable-static','--disable-examples','--disable-tools','--disable-docs','--disable-unit-tests','--disable-vp8','--enable-vp9','--enable-pic'],
 opus:['./configure',`--prefix=${prefix}`,'--disable-shared','--enable-static','--disable-doc','--disable-extra-programs',`--host=${target}-apple-darwin`],
 lame:['./configure',`--prefix=${prefix}`,'--disable-shared','--enable-static','--disable-frontend',`--host=${target}-apple-darwin`],
 ffmpeg:['./configure',`--arch=${target}`, '--target-os=darwin', ...(cross ? ['--enable-cross-compile'] : []),`--prefix=${prefix}`,'--enable-gpl','--enable-zlib','--disable-nonfree','--disable-autodetect','--disable-shared','--enable-static','--disable-doc','--disable-debug','--disable-ffplay','--disable-ffprobe','--enable-libx264','--enable-libvpx','--enable-libopus','--enable-libmp3lame',`--extra-cflags=-I${prefix}/include`,`--extra-ldflags=-L${prefix}/lib`,'--pkg-config-flags=--static',...(architecture === 'x64' && !hasNasm ? ['--disable-x86asm'] : [])]
};
async function run(command,args,cwd){await new Promise((resolve,reject)=>{const child=spawn(command,args,{cwd,env:cwd === path.join(sources,'pkgconf') ? {...env,CFLAGS:`-O2 -isysroot ${sdk}`,CXXFLAGS:`-O2 -isysroot ${sdk}`,LDFLAGS:`-isysroot ${sdk}`} : env,stdio:'inherit'});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error(`${command} failed (${code})`)));});}
if(process.argv.includes('--plan')){console.log(JSON.stringify({root,sdk,architecture,hasNasm,manifest,recipes},null,2));process.exit(0);}
if(process.platform!=='darwin'||!['arm64','x64'].includes(process.arch))throw Error('This pinned recipe currently supports macOS arm64 and x64 only (x64 unverified)');
await fs.mkdir(root,{recursive:true});
const archMarker=path.join(root,'build-architecture.json');
try { if(JSON.parse(await fs.readFile(archMarker,'utf8')).arch!==architecture) throw Error('FFmpeg build directory belongs to another architecture; choose a fresh build directory'); } catch(error) { if(error.code!=='ENOENT') throw error; }
for(const artifact of ['bin/ffmpeg','lib/libx264.a','lib/libvpx.a','lib/libopus.a','lib/libmp3lame.a']) {
 const file=path.join(prefix,artifact); try { await fs.access(file); } catch(error) { if(error.code==='ENOENT') continue; throw error; }
 const inspection=spawnSync('/usr/bin/lipo',['-archs',file],{encoding:'utf8'});
 if(inspection.status!==0 || inspection.stdout.trim()!==target) throw Error(`Existing FFmpeg cache architecture mismatch: ${artifact}`);
}
await fs.writeFile(archMarker,JSON.stringify({arch:architecture}));
await fs.mkdir(downloads,{recursive:true});await fs.mkdir(sources,{recursive:true});await fs.mkdir(prefix,{recursive:true});
for(const item of manifest){const target=path.join(downloads,item.filename);let bytes;try{bytes=await fs.readFile(target);}catch{const response=await fetch(item.url);if(!response.ok)throw Error(`Download failed: ${item.name}`);bytes=Buffer.from(await response.arrayBuffer());await fs.writeFile(target,bytes);}if(crypto.createHash('sha256').update(bytes).digest('hex')!==item.sha256)throw Error(`Source SHA256 mismatch: ${item.name}`);const source=path.join(sources,item.name);try{await fs.access(path.join(source,'configure'));}catch{await fs.mkdir(source,{recursive:true});await run('/usr/bin/tar',['-xf',target,'--strip-components=1','-C',source],root);}}
await fs.mkdir(path.join(prefix,'bin'),{recursive:true});
// libvpx hard-codes xcrun SDK discovery. This wrapper affects only this private build PATH.
await fs.writeFile(path.join(prefix,'bin/xcrun'),`#!/bin/sh
if [ "$1" = "--sdk" ] && [ "$2" = "macosx" ] && [ "$3" = "--show-sdk-path" ]; then
  printf '%s\\n' "$SDKROOT"
else
  exec /usr/bin/xcrun "$@"
fi
`,{mode:0o755});
for(const name of (process.argv.includes('--ffmpeg-only') ? ['ffmpeg'] : ['pkgconf','x264','vpx','opus','lame','ffmpeg'])){const cwd=path.join(sources,name);console.log(`Building ${name}`);await run(recipes[name][0],recipes[name].slice(1),cwd);await run('/usr/bin/make',['-j',String(Math.min(os.availableParallelism(),8))],cwd);await run('/usr/bin/make',['install'],cwd);if(name==='pkgconf'){try{await fs.symlink('pkgconf',path.join(prefix,'bin/pkg-config'));}catch(e){if(e.code!=='EEXIST')throw e;}}}
const stage=process.env.SCRIBBLE_FFMPEG_STAGE_DIR || process.env.SCRIBBLE_FFMPEG_OUTPUT_DIR || path.join(rootArg >= 0 || manifestPath.includes('/docs/licenses/') ? repo : root,'release/runtime');await fs.mkdir(stage,{recursive:true});await fs.copyFile(path.join(prefix,'bin/ffmpeg'),path.join(stage,'ffmpeg'));await fs.chmod(path.join(stage,'ffmpeg'),0o755);
const licenseDir=path.join(stage,'licenses/ffmpeg');await fs.mkdir(licenseDir,{recursive:true});await fs.mkdir(path.join(licenseDir,'sources'),{recursive:true});for(const item of manifest)await fs.copyFile(path.join(downloads,item.filename),path.join(licenseDir,'sources',item.filename));
for(const [name,files] of Object.entries({ffmpeg:['COPYING.GPLv2','COPYING.LGPLv2.1','LICENSE.md'],x264:['COPYING'],vpx:['LICENSE','PATENTS'],opus:['COPYING'],lame:['COPYING'],pkgconf:['COPYING']})){for(const file of files){try{await fs.copyFile(path.join(sources,name,file),path.join(licenseDir,`${name}-${file}`));}catch(e){if(e.code!=='ENOENT')throw e;}}}
await fs.copyFile(fileURLToPath(import.meta.url),path.join(licenseDir,'setup-ffmpeg.mjs'));await fs.copyFile(manifestPath,path.join(licenseDir,'ffmpeg-sources.json'));await fs.writeFile(path.join(licenseDir,'build-recipe.json'),JSON.stringify({manifest,recipes,environment:{MACOSX_DEPLOYMENT_TARGET:env.MACOSX_DEPLOYMENT_TARGET,SDKROOT:sdk,CC:env.CC,CXX:env.CXX,CFLAGS:env.CFLAGS,CXXFLAGS:env.CXXFLAGS,LDFLAGS:env.LDFLAGS},buildTools:{xcrun:'Private wrapper returns SDKROOT only for --sdk macosx --show-sdk-path; delegates all other calls to /usr/bin/xcrun'},builtAt:new Date().toISOString()},null,2));
const actual = spawnSync('/usr/bin/lipo',['-archs',path.join(stage,'ffmpeg')],{encoding:'utf8'}); if(actual.status!==0 || actual.stdout.trim()!==target) throw Error(`FFmpeg architecture mismatch: ${actual.stdout?.trim()}`);
if(!cross) await run(path.join(stage,'ffmpeg'),['-hide_banner','-version'],repo);await run('/usr/bin/otool',['-L',path.join(stage,'ffmpeg')],repo);
const recipeBytes=await fs.readFile(fileURLToPath(import.meta.url));
const binaryBytes=await fs.readFile(path.join(stage,'ffmpeg'));
const buildRecipeBytes=await fs.readFile(path.join(licenseDir,'build-recipe.json'));
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
await fs.writeFile(path.join(stage,'ffmpeg-build.json'),JSON.stringify({schemaVersion:1,arch:architecture,platform:process.platform,recipeSHA256:hash(recipeBytes),binarySHA256:hash(binaryBytes),buildRecipeSHA256:hash(buildRecipeBytes),sources:manifest.map(({name,filename,sha256})=>({name,filename,sha256})),builtAt:new Date().toISOString()},null,2));
console.log(`Staged ${path.join(stage,'ffmpeg')} with corresponding source and recipe`);
