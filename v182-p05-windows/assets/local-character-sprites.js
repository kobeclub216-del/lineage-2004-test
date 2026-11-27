/* Local-only character animation adapter. Manifest coordinates must be calibrated by importer. */
(function(root){
"use strict";
let roles=new Map(), epoch=0, lastAction=null, started=0, bitmaps=new Set();
function release(set){for(const img of set)img.close?.();}
async function load(manifest,files){
 const token=++epoch, next=new Map(), byPath=new Map(Array.from(files,f=>[f.path||f.webkitRelativePath||f.name,f.file||f]));
 const cache=new Map(), owned=new Set();
 try {
 if(manifest.schemaVersion!==1||!Array.isArray(manifest.roles))throw Error("Invalid character manifest");
 for(const role of manifest.roles){
 const actions={};
 for(const [action,dirs] of Object.entries(role.actions)){
 if(!Array.isArray(dirs)||dirs.length!==8)throw Error("Eight directions required");
 actions[action]=await Promise.all(dirs.map(async frames=>{
 if(!frames.length)throw Error("Empty animation");
 return Promise.all(frames.map(async f=>{
 if(![f.x,f.y,f.ms].every(Number.isFinite)||f.ms<=0)throw Error("Invalid frame coordinates or timing");
 const file=byPath.get(f.path);if(!file)throw Error("Missing "+f.path);
 if(!cache.has(f.path))cache.set(f.path,Promise.resolve().then(()=>createImageBitmap(file)).then(img=>{owned.add(img);return img;}));
 const img=await cache.get(f.path);return {...f,img};
 }));
 }));
 }
 next.set(role.job+":"+role.gender,actions);
 }
 if(token!==epoch){release(owned);return false;}
 release(bitmaps);bitmaps=owned;roles=next;lastAction=null;return true;
 }catch(error){await Promise.allSettled(cache.values());release(owned);throw error;}
}
function resolveFrames(p){const actions=roles.get(p.job+':'+p.gender),dir=(p.facing+3)%8;return (p.weapon&&actions?.[p.weapon+'_'+p.action]?.[dir])||(p.weapon&&p.action==='hit'&&actions?.[p.weapon+'_damage']?.[dir])||actions?.[p.action]?.[dir]||(p.action==='hit'?actions?.damage?.[dir]:null);}
function duration(p){const frames=resolveFrames(p);return frames?.reduce((sum,f)=>sum+f.ms,0)||0;}
function frame(p){
 const frames=resolveFrames(p);
 if(!frames?.length){lastAction=null;return null;}
 const total=frames.reduce((s,f)=>s+f.ms,0);const key=p.job+':'+p.gender+':'+(p.weapon||'')+':'+p.action;if(key!==lastAction){lastAction=key;started=p.now;}const elapsed=Math.max(0,p.now-started);let t=['attack','hit','death','pickup','cast'].includes(p.action)?Math.min(total-0.001,elapsed):elapsed%total;
 let f=frames[0];for(const candidate of frames){f=candidate;if(t<f.ms)break;t-=f.ms;}
 return f;
}
function draw(ctx,p){
 const f=frame(p);if(!f)return false;
 ctx.save();ctx.imageSmoothingEnabled=false;
 ctx.drawImage(f.img,Math.round(p.x+f.x),Math.round(p.y+f.y));
 
 ctx.restore();return true;
}
root.lineageLocalSprites={load,draw,frame,duration,clear(){epoch++;release(bitmaps);bitmaps=new Set();roles=new Map();lastAction=null;}};
})(window);
