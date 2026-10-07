'use strict';
const sharp=require('sharp'),path=require('node:path'),fs=require('node:fs');
const root=path.resolve(__dirname,'..');const dir=path.join(root,'assets');
const tray=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44"><rect x="16" y="4" width="12" height="22" rx="6"/><path d="M11 20v2a11 11 0 0 0 22 0v-2M22 33v7M16 40h12" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round"/></svg>');
(async()=>{fs.mkdirSync(dir,{recursive:true});await Promise.all([sharp(path.join(dir,'icon.svg')).resize(1024,1024).png().toFile(path.join(dir,'icon.png')),sharp(tray).resize(22,22).png().toFile(path.join(dir,'tray.png')),sharp(tray).png().toFile(path.join(dir,'tray@2x.png'))]);console.log('Created Scribble icon and tray assets.');})().catch(e=>{console.error(e.message);process.exit(1);});
