"use strict";
const fs=require('node:fs/promises'),path=require('node:path');
const EDITORS=Object.freeze({'vs code':'Visual Studio Code',vscode:'Visual Studio Code',code:'Visual Studio Code','visual studio code':'Visual Studio Code',cursor:'Cursor',sublime:'Sublime Text','sublime text':'Sublime Text',atom:'Atom',webstorm:'WebStorm',phpstorm:'PhpStorm',intellij:'IntelliJ IDEA','intellij idea':'IntelliJ IDEA',pycharm:'PyCharm'});
const APP_ALIASES=Object.freeze({...EDITORS,chrome:'Google Chrome','google chrome':'Google Chrome',word:'Microsoft Word','microsoft word':'Microsoft Word',excel:'Microsoft Excel','microsoft excel':'Microsoft Excel',powerpoint:'Microsoft PowerPoint','power point':'Microsoft PowerPoint','microsoft powerpoint':'Microsoft PowerPoint',outlook:'Microsoft Outlook','microsoft outlook':'Microsoft Outlook',teams:'Microsoft Teams','microsoft teams':'Microsoft Teams',photoshop:'Adobe Photoshop','adobe photoshop':'Adobe Photoshop',vlc:'VLC'});
// Apple installed ExtensionKit metadata declares these x-apple scheme handlers.
// Privacy anchors also occur in the installed SecurityPrivacy extension.
const SETTINGS=Object.freeze({
 privacy:'x-apple.systempreferences:com.apple.preference.security?Privacy',
 security:'x-apple.systempreferences:com.apple.preference.security',
 microphone:'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
 camera:'x-apple.systempreferences:com.apple.preference.security?Privacy_Camera',
 'screen recording':'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
 accessibility:'x-apple.systempreferences:com.apple.preference.universalaccess',
 location:'x-apple.systempreferences:com.apple.preference.security?Privacy_LocationServices',
 sound:'x-apple.systempreferences:com.apple.preference.sound',
 displays:'x-apple.systempreferences:com.apple.preference.displays',
 network:'x-apple.systempreferences:com.apple.preference.network',
 wifi:'x-apple.systempreferences:com.apple.wifi-settings-extension',
 bluetooth:'x-apple.systempreferences:com.apple.preferences.Bluetooth',
 keyboard:'x-apple.systempreferences:com.apple.preference.keyboard',
 shortcuts:'x-apple.systempreferences:com.apple.preference.keyboard',
 notifications:'x-apple.systempreferences:com.apple.preference.notifications',
 battery:'x-apple.systempreferences:com.apple.preference.battery',
 sharing:'x-apple.systempreferences:com.apple.preferences.sharing',
});
const PANE_ALIASES=Object.freeze({'privacy and security':'privacy','privacy & security':'privacy','mic':'microphone','screen capture':'screen recording','screen-recording':'screen recording','location services':'location',audio:'sound',display:'displays','wi-fi':'wifi','wi fi':'wifi','wireless':'wifi','keyboard shortcuts':'shortcuts',notification:'notifications','energy saver':'battery'});
function appName(value) {
 if(typeof value!=='string'||!value.trim()||value.length>200||/[\x00-\x1f\x7f/:\\?#]/.test(value)||value.trim().startsWith('-'))throw Error('Invalid application name');
 const trimmed=value.trim();return APP_ALIASES[trimmed.toLowerCase()] || trimmed;
}
function parseSystemCommand(text) {
 if(typeof text!=='string'||text.length>300||/[\x00-\x1f\x7f;]/.test(text))return null;
 const command=text.trim().replace(/[.!]$/,'').replace(/\s+/g,' ').toLowerCase();
 const editor=command.match(/^(?:open|launch) (?:this|these|the selected|selected) (file|files|folder|folders|items?) (?:in|with) (.+)$/) || command.match(/^open (?:this|these|the selected|selected) (?:in|with) (.+)$/);
 if(editor){const name=editor[2] || editor[1],application=EDITORS[name];if(!application)throw Error('Choose one of the supported eight editors');return {type:'editor',application,kind:editor[2] ? editor[1] : 'items'};}
 const pane=command.match(/^(?:open|show|go to) (?:the )?(.+?) (?:settings|preferences|pane)$/);
 if(pane){const key=PANE_ALIASES[pane[1]] || pane[1];if(!Object.hasOwn(SETTINGS,key))throw Error('Unknown System Settings pane');return {type:'settings',pane:key,uri:SETTINGS[key],instruction:key==='shortcuts'?'Choose Keyboard Shortcuts.':''};}
 if(/^(?:open|show|go to) .*\b(?:settings|preferences)\b/.test(command)&&/[?:&#]/.test(command))throw Error('Invalid System Settings command');
 return null;
}
async function capturedPaths(captured,{kind='items'}={}) {
 const files=captured?.files;
 if(!Array.isArray(files)||!files.length||files.length>32)throw Error('Select between one and 32 files or folders in Finder before opening them in an editor');
 const result=[],seen=new Set();
 for(const file of files){
  if(!file||typeof file.path!=='string'||!path.isAbsolute(file.path)||file.path.length>4096||/[\x00-\x1f\x7f]/.test(file.path))throw Error('Selected editor paths must be bounded absolute paths');
  const stat=await fs.lstat(file.path).catch(()=>null);
  if(!stat||stat.isSymbolicLink()||(!stat.isFile()&&!stat.isDirectory())||['dev','ino','size','mtimeMs','ctimeMs'].some(key=>stat[key]!==file[key])||stat.isDirectory()!==file.directory)throw Error('Selected file changed after command activation');
  if((/^files?$/.test(kind)&&!stat.isFile())||(/^folders?$/.test(kind)&&!stat.isDirectory()))throw Error('The selected item does not match the requested file or folder');
  const identity=stat.dev+':'+stat.ino;if(seen.has(identity))throw Error('Duplicate selected editor paths');seen.add(identity);result.push(file.path);
 }
 // Revalidate all identities once the whole selection has been inspected.
 for(let i=0;i<files.length;i++){const stat=await fs.lstat(result[i]).catch(()=>null);if(!stat||stat.isSymbolicLink()||['dev','ino','size','mtimeMs','ctimeMs'].some(key=>stat[key]!==files[i][key]))throw Error('Selected file changed after command activation');}
 return result;
}
module.exports={EDITORS,APP_ALIASES,SETTINGS,appName,parseSystemCommand,capturedPaths};
