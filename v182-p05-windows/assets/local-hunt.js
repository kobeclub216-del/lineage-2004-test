(function(root){
 'use strict';
 const directions=['NW','N','NE','E','SE','S','SW','W'];
 const interval=220;
 const range=(a,b)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));
 const roster=new Map([
  [56,'妖魔'],[1096,'骷髏弓箭手'],[52,'殭屍'],[1020,'食人妖精'],
  [1477,'豺狼人'],[1152,'小惡魔'],[54,'矮人'],
 ]);
 function create(renderer, sprites, cells, onAttack){
  const actors=sprites.filter(sprite=>sprite.kind==='monster'&&roster.has(sprite.spriteId)&&sprite.name!=='ghoul')
   .slice(0,cells.length).map((sprite,index)=>{
    const movement=new root.TalkingIslandMovementController(renderer), home=cells[index];
    movement.spawn(home.x,home.y);
    return {sprite,home,movement,name:roster.get(sprite.spriteId),reach:sprite.spriteId===1096?4:1,
     action:'idle',started:0,until:0,hits:0,hostile:false,respawnAt:0};
   });
  function animate(actor,action,now,until=0){
   if(actor.action!==action||action==='hit'||action==='attack') actor.started=now;
   actor.action=action;
   actor.until=until;
  }
  function clearShot(from,to){
   const distance=range(from,to);
   if(!distance) return false;
   let x=from.x,y=from.y;
   for(let i=1;i<=distance;i++){
    const nx=Math.round(from.x+(to.x-from.x)*i/distance);
    const ny=Math.round(from.y+(to.y-from.y)*i/distance);
    if(!renderer.canStep(x,y,nx,ny))return false;
    x=nx;y=ny;
   }
   return true;
  }
  function strike(actor,player,now){
   if(!actors.includes(actor)||actor.action==='death'||range(actor.movement.position,player)!==1||
      !clearShot(player,actor.movement.position))return false;
   actor.movement.face(player.x,player.y);
   actor.hostile=true;
   actor.hits++;
   if(actor.hits===2){
    animate(actor,'death',now);
    actor.respawnAt=now+4500;
   }else animate(actor,'hit',now,now+interval);
   return true;
  }
  function step(player,now){
   for(const actor of actors){
    const movement=actor.movement;
    const position=movement.position;
    if(actor.action==='death'){
     if(now<actor.respawnAt||range(player,actor.home)<2||
        actors.some(other=>other!==actor&&range(other.movement.position,actor.home)===0))continue;
     movement.spawn(actor.home.x,actor.home.y);
     actor.hits=0;actor.hostile=false;
     animate(actor,'idle',now);
     continue;
    }
    if(now<actor.until) continue;
    const distance=range(position,player);
    const canAttack=distance<=actor.reach&&clearShot(position,player);
    if(actor.action==='attack'&&canAttack)onAttack(actor);
    if(!actor.hostile&&distance>6){animate(actor,'idle',now);continue;}
    if(canAttack){
     movement.face(player.x,player.y);
     animate(actor,'attack',now,now+750);
     continue;
    }
    if(movement.moveTo(player.x,player.y)){
     const next=movement.route[0];
     if(next&&range(next,player)>0&&actors.every(other=>other===actor||range(next,other.movement.position)>0)){
      movement.step();
      animate(actor,'walk',now);
      continue;
     }
    }
    animate(actor,'idle',now);
   }
  }
  return {actors,strike,step};
 }
 function frame(actor,now){
  const direction=directions.indexOf(actor.movement.getScreenFacing());
  return root.lineageLocalActors.select(actor.sprite,actor.action,direction,(now-actor.started)/40);
 }
 root.lineageLocalHunt={create,frame,interval};
})(globalThis);
