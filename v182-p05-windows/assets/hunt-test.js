'use strict';
const batch=document.getElementById('batch');
const field=document.getElementById('field');
const statusText=document.getElementById('status');
const ctx=field.getContext('2d');
const renderer=new TalkingIslandLayerRenderer(field);
let assets, player, hunt, camera, painted=[], last=0, hits=0;

async function json(path){
 const response=await fetch(path);
 if(!response.ok)throw Error('讀取失敗：'+path);
 return response.json();
}
async function picture(path){
 const image=new Image();
 image.src=path;
 await image.decode();
 return image;
}
function spawnCells(data){
 const search=new TalkingIslandMovementController(renderer);
 const cells=[];
 for(let y=data.bounds.maxY-2;y>data.bounds.minY&&cells.length<7;y--){
  for(let x=data.bounds.minX+1;x<data.bounds.maxX&&cells.length<7;x++){
   if(cells.some(cell=>Math.max(Math.abs(cell.x-x),Math.abs(cell.y-y))<4))continue;
   search.spawn(data.spawn.x,data.spawn.y);
   if(search.moveTo(x,y)&&search.route.length>=5)cells.push({x,y});
  }
 }
 return cells;
}
batch.onchange=async()=>{
 batch.disabled=true;
 statusText.textContent='讀取素材中…';
 let next;
 try{
  const files=Array.from(batch.files);
  const plan=files.find(file=>file.name==='sprite-batch-plan.json');
  if(!plan)throw Error('找不到 sprite-batch-plan.json');
  const [data,index]=await Promise.all([json('./assets/shop-scene.json'),json('./assets/scene-assets.json')]);
  const [ground,objects]=await Promise.all([picture(index['shop-ground.png']),picture(index['shop-objects.png'])]);
  next=await lineageLocalActors.load(JSON.parse(await plan.text()),files);
  renderer.tileWidth=data.tileSize.width;
  renderer.tileHeight=data.tileSize.height;
  renderer.setScene({bounds:data.bounds,layers:[
   {id:'ground',depth:0,images:[{...data.imagePlacement,image:ground}]},
   {id:'objects',depth:1,images:data.objects.map(item=>({...item,image:objects}))},
  ]});
  renderer.setCollision(data);
  const nextPlayer=new TalkingIslandMovementController(renderer);
  nextPlayer.spawn(data.spawn.x,data.spawn.y);
  const nextHunt=lineageLocalHunt.create(renderer,next.actors,spawnCells(data),actor=>{
   hits++;
   statusText.textContent=actor.name+' 命中｜本場受擊 '+hits+' 次';
  });
  if(!nextHunt.actors.length)throw Error('找不到可用的八方向怪物');
  assets?.close();
  assets=next;player=nextPlayer;hunt=nextHunt;hits=0;
  statusText.textContent='已生成 '+hunt.actors.length+' 種怪物。';
 }catch(error){
  next?.close();
  statusText.textContent=error.message;
 }finally{batch.disabled=false;}
};
field.onclick=event=>{
 if(!hunt||!camera)return;
 const rect=field.getBoundingClientRect();
 const x=(event.clientX-rect.left)*field.width/rect.width;
 const y=(event.clientY-rect.top)*field.height/rect.height;
 const hit=painted.find(({left,top,item})=>x>=left&&x<left+item.width&&y>=top&&y<top+item.height);
 if(hit){
  if(lineageLocalHunt.strike(hit.item.actor,player.position,performance.now())){
   statusText.textContent='攻擊 '+hit.item.actor.name;
  }else{
   statusText.textContent='請先走到怪物旁邊。';
  }
  return;
 }
 const cell=player.pick(x,y,camera.cameraX,camera.cameraY);
 if(cell)player.moveTo(cell.x,cell.y);
};
function draw(now){
 if(hunt){
  if(now-last>=lineageLocalHunt.interval){
   last=now;
   const next=player.route[0];
   if(next&&hunt.actors.some(actor=>actor.movement.position.x===next.x&&actor.movement.position.y===next.y))player.cancel();
   player.step();
   hunt.step(player.position,now);
  }
  camera=player.camera();
  painted=[];
  const actors=hunt.actors.flatMap(actor=>{
   const frame=lineageLocalHunt.frame(actor,now);
   if(!frame)return [];
   return [{...actor.movement.position,actor,image:frame.image,width:frame.width,height:frame.height,
    offsetX:frame.x+frame.width/2,offsetY:frame.y+frame.height}];
  });
  renderer.render({...camera,actors,onDraw(item,left,top){if(item.actor?.action!=='death'&&item.actor)painted.unshift({item,left,top});}});
  ctx.fillStyle='#7ad7ff';
  ctx.beginPath();ctx.arc(field.width/2,field.height/2,4,0,Math.PI*2);ctx.fill();
 }
 requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
