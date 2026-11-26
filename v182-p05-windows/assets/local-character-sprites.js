/* Local-only character animation adapter. Manifest coordinates must be calibrated by importer. */
(function(root){
"use strict";
let roles=new Map(), epoch=0;
async function load(manifest,files){
 const token=++epoch, next=new Map(), byPath=new Map(Array.from(files,f=>[f.path||f.webkitRelativePath||f.name,f.file||f]));
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
 const img=await createImageBitmap(file);return {...f,img};
 }));
 }));
 }
 next.set(role.job+":"+role.gender,actions);
 }
 if(token!==epoch)return false;
 roles=next;return true;
}
function draw(ctx,p){
 const actions=roles.get(p.job+":"+p.gender), frames=actions?.[p.action]?.[p.facing];
 if(!frames?.length)return false;
 const total=frames.reduce((s,f)=>s+f.ms,0);let t=((p.now%total)+total)%total;
 let f=frames[0];for(const candidate of frames){f=candidate;if(t<f.ms)break;t-=f.ms;}
 ctx.save();ctx.imageSmoothingEnabled=false;
 ctx.drawImage(f.img,Math.round(p.x+f.x),Math.round(p.y+f.y));
 
 ctx.restore();return true;
}
root.lineageLocalSprites={load,draw,clear(){epoch++;roles=new Map();}};
})(window);
