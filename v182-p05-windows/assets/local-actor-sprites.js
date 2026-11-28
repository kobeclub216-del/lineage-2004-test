(function (root) {
 'use strict';
 const actions = ['idle', 'walk', 'attack', 'hit', 'death'];
 const offsets = /^\s*Frame (\d+): (\d+)x(\d+), offset=\((-?\d+),(-?\d+)\)\s*$/gm;

 async function load(plan, files, decode = createImageBitmap) {
  if (plan.schemaVersion !== 1 || !Array.isArray(plan.candidates)) throw Error('Invalid batch plan');
  const paths = new Map();
  for (const file of files) {
   const path = (file.webkitRelativePath || file.name).split('/').slice(-3).join('/');
   if (paths.has(path)) throw Error('Duplicate file: ' + path);
   paths.set(path, file);
  }
  const groups = new Map(), images = new Map(), actors = [], rejected = [];
  async function frame(name, index, duration) {
   if (!/^\d+-\d+\.spr$/.test(name) || !Number.isSafeInteger(index) || index < 0 ||
       !Number.isSafeInteger(duration) || duration <= 0) throw Error('Invalid frame reference');
   const stem = name.slice(0, -4);
   const base = 'frames/' + stem + '/';
   if (!groups.has(stem)) {
    const info = paths.get(base + 'info.txt');
    if (!info) throw Error('Missing metadata for ' + stem);
    const rows = Array.from((await info.text()).matchAll(offsets), match => match.slice(1).map(Number));
    groups.set(stem, new Map(rows.map(([i, width, height, x, y]) => [i, {width, height, x, y}])));
   }
   const geometry = groups.get(stem).get(index);
   const path = base + stem + '_frame' + index + '.png';
   const file = paths.get(path);
   if (!file || !geometry) throw Error('Missing frame or offset: ' + path);
   if (!images.has(path)) images.set(path, await decode(file));
   const image = images.get(path);
   if (image.width !== geometry.width || image.height !== geometry.height)
    throw Error('PNG dimensions differ from metadata: ' + path);
   return {...geometry, image, duration};
  }
  for (const candidate of plan.candidates) {
   if (candidate.status !== 'matched' || !['npc', 'monster'].includes(candidate.kind)) continue;
   try {
    const clips = {};
    for (const action of candidate.kind === 'npc' ? ['idle'] : actions) {
     const clip = candidate.actions.find(item => item.kind === action && item.directions === 8 &&
      item.countMatches && item.frames.length === item.declaredFrames &&
      item.frames.length && item.frames.every(f => f.files?.length === 8));
     if (!clip) throw Error('Missing eight-direction ' + action);
     clips[action] = [];
     for (let d = 0; d < 8; d++) {
      const frames = [];
      for (const f of clip.frames) frames.push(await frame(f.files[d], f.frameIndex, f.durationRaw));
      clips[action].push(frames);
     }
    }
    actors.push({name: candidate.candidate, kind: candidate.kind, spriteId: candidate.spriteId,
     entryId:candidate.entryId, sourceName:candidate.sourceName, clips});
   } catch (error) {
    rejected.push({name: candidate.candidate, error: error.message});
   }
  }
  return {actors, rejected, close() { for (const image of images.values()) image.close?.(); }};
 }

 function select(actor, action, direction, elapsed) {
  const frames = actor.clips[action]?.[direction];
  if (!frames?.length || !Number.isFinite(elapsed)) return null;
  const total = frames.reduce((sum, frame) => sum + frame.duration, 0);
  let time = Math.max(0, elapsed);
  if (action === 'idle' || action === 'walk') time %= total;
  for (const frame of frames) {
   if (time < frame.duration) return frame;
   time -= frame.duration;
  }
  return frames.at(-1);
 }

 let villageNpcs=new Map();
 const villageNpcIds=new Map([[98,'pandora'],[237,'gereng']]);
 async function loadVillageNpcs(plan,files,decode){
  const candidates=plan.candidates.filter(row=>row.kind==='npc'&&row.entryId===row.spriteId&&
   villageNpcIds.get(row.entryId)===row.sourceName?.trim().toLowerCase()&&villageNpcIds.has(row.entryId));
  const loaded=await load({...plan,candidates},files,decode);
  if(!loaded.actors.length){loaded.close();throw Error('找不到可用的潘朵拉或吉倫影格');}
  villageNpcs.close?.();
  villageNpcs=new Map(loaded.actors.map(actor=>[actor.entryId,actor]));
  villageNpcs.close=loaded.close;
  return villageNpcs.size;
 }

 function villageNpc(base,id,now){
  const actor=villageNpcs.get(id);
  const frame=actor&&select(actor,'idle',6,now/40);
  if(!frame)return base;
  return {...base,image:frame.image,width:frame.width,height:frame.height,
   offsetX:frame.x+frame.width/2,offsetY:frame.y+frame.height,interactionActor:base};
 }

 root.lineageLocalActors = {load, select, loadVillageNpcs, villageNpc, clearVillageNpcs(){
  villageNpcs.close?.();
  villageNpcs=new Map();
 }};
})(globalThis);
