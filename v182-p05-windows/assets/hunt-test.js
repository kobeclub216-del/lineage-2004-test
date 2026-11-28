'use strict';
const batch=document.getElementById('batch');
const field=document.getElementById('field');
const statusText=document.getElementById('status');
const ctx=field.getContext('2d');
const renderer=new TalkingIslandLayerRenderer(field);
let assets, player, hunt, camera, painted=[], last=0, hits=0, started=false;

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
function spawnCells(data, sprites, initialPlayer){
 const search=new TalkingIslandMovementController(renderer);
 search.spawn(data.spawn.x,data.spawn.y);
 const {cameraX,cameraY}=initialPlayer.camera();
 const rect=(item,x,y)=>({left:x,top:y,right:x+item.width,bottom:y+item.height});
 const overlaps=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
 const obstacles=data.objects.map(item=>{
  const p=renderer.project(item.x,item.y,cameraX,cameraY);
  return {...rect(item,p.x+(item.offsetX??0)-item.width/2,p.y+(item.offsetY??0)-item.height),
   depth:item.footY??item.x+item.y};
 });
 const candidates=[];
 for(let y=data.bounds.minY;y<data.bounds.maxY;y++){
  for(let x=data.bounds.minX;x<data.bounds.maxX;x++){
   const p=renderer.project(x,y,cameraX,cameraY);
   const distance=Math.hypot((p.x-field.width/2)/2,p.y-field.height/2);
   if(distance<45||p.x<35||p.x>field.width-35||p.y<80||p.y>field.height-32)continue;
   if(search.moveTo(x,y))candidates.push({x,y,p,distance});
  }
 }
 candidates.sort((a,b)=>a.distance-b.distance);
 const cells=[];
 const occupied=[];
 for(const sprite of sprites){
  const frames=sprite.clips.idle[6]; // The movement controller spawns facing screen SW.
  const cell=candidates.find(({x,y,p})=>frames.every(frame=>{
   const box=rect(frame,p.x+frame.x,p.y+frame.y);
   const center=(box.left+box.right)/2;
   const label={left:center-56,right:center+56,top:box.top-22,bottom:box.top};
   return box.left>=0&&box.right<=field.width&&label.top>=0&&box.bottom<=field.height&&
    !obstacles.some(object=>object.depth>x+y&&overlaps(box,object))&&
    !occupied.some(other=>overlaps(other,box)||overlaps(other,label));
  }));
  if(!cell)throw Error('初始視野內找不到無遮擋的怪物出生點');
  cells.push({x:cell.x,y:cell.y});
  for(const frame of frames){
   const box=rect(frame,cell.p.x+frame.x,cell.p.y+frame.y);
   const center=(box.left+box.right)/2;
   occupied.push(box,{left:center-56,right:center+56,top:box.top-22,bottom:box.top});
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
  const sprites=lineageLocalHunt.rosterSprites(next.actors);
  const nextHunt=lineageLocalHunt.create(renderer,sprites,spawnCells(data,sprites,nextPlayer),actor=>{
   hits++;
   statusText.textContent=actor.name+' 命中｜本場受擊 '+hits+' 次';
  });
  if(!nextHunt.actors.length)throw Error('找不到可用的八方向怪物');
  assets?.close();
  assets=next;player=nextPlayer;hunt=nextHunt;hits=0;last=performance.now();started=false;
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
   started=true;
   statusText.textContent='攻擊 '+hit.item.actor.name;
  }else{
   statusText.textContent='請先走到怪物旁邊。';
  }
  return;
 }
 const cell=player.pick(x,y,camera.cameraX,camera.cameraY);
 if(cell&&player.moveTo(cell.x,cell.y)&&player.moving)started=true;
};
function draw(now){
 if(hunt){
  if(started&&now-last>=lineageLocalHunt.interval){
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
  ctx.font='bold 15px sans-serif';
  ctx.textAlign='center';
  ctx.lineWidth=3;
  ctx.strokeStyle='#151515';
  ctx.fillStyle='#ffe6a4';
  for(const {item,left,top} of painted){
   const center=left+item.width/2;
   ctx.strokeText(item.actor.name,center,top-5,112);
   ctx.fillText(item.actor.name,center,top-5,112);
  }
  ctx.fillStyle='#7ad7ff';
  ctx.beginPath();ctx.arc(field.width/2,field.height/2,4,0,Math.PI*2);ctx.fill();
 }
 requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
