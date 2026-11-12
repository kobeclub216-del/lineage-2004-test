/* P05-D53 — scene movement controller. No art, map coordinates or walkability invented.
 * Requires a verified scene and explicit collision data before movement.
 */
(function(root){
'use strict';
class TalkingIslandMovementController {
 constructor(renderer,options={}){
  if(!renderer||typeof renderer.canWalk!=='function'||typeof renderer.project!=='function')throw new TypeError('Scene renderer required');
  this.renderer=renderer;this.position=null;this.route=[];this.maxNodes=options.maxNodes||4096;
 }
 spawn(x,y){
  if(!this.renderer.scene||!this.renderer.canWalk(x,y))throw new RangeError('Spawn requires verified walkable scene cell');
  this.position={x,y};this.route=[];return {...this.position};
 }
 moveTo(x,y){
  if(!this.position||!this.renderer.scene||!this.renderer.canWalk(x,y))return false;
  const start=this.position, key=(x,y)=>x+','+y;
  const visited=new Set([key(start.x,start.y)]),queue=[start],parents=new Map();
  const directions=[[0,-1],[-1,0],[1,0],[0,1]];
  let found=false,head=0;
  while(head<queue.length&&queue.length<=this.maxNodes){
   const p=queue[head++];
   if(p.x===x&&p.y===y){found=true;break}
   for(const [dx,dy] of directions){
    const nx=p.x+dx,ny=p.y+dy,k=key(nx,ny);
    if(!visited.has(k)&&this.renderer.canWalk(nx,ny)){
     visited.add(k);parents.set(k,p);queue.push({x:nx,y:ny});
    }
   }
  }
  if(!found)return false;
  const path=[];let p={x,y};
  while(p.x!==start.x||p.y!==start.y){path.push(p);p=parents.get(key(p.x,p.y));if(!p)return false}
  this.route=path.reverse();return true;
 }
 step(){
  if(!this.position||!this.route.length)return false;
  const next=this.route.shift();
  if(!this.renderer.canWalk(next.x,next.y)){this.route=[];return false}
  this.position={...next};return true;
 }
 cancel(){this.route=[]}
 camera(){if(!this.position)throw new Error('Spawn required');const p=this.renderer.project(this.position.x,this.position.y,0,0);return {cameraX:p.x-this.renderer.canvas.width/2,cameraY:p.y-this.renderer.canvas.height/2}}
 // Pixel click to isometric cell; returns null if outside verified walkable bounds.
 pick(screenX,screenY,cameraX,cameraY){
  if(!this.renderer.scene||!this.renderer.collision||![screenX,screenY,cameraX,cameraY].every(Number.isFinite))return null;
  const tw=this.renderer.tileWidth,th=this.renderer.tileHeight;
  const a=(screenX-this.renderer.canvas.width/2+cameraX)/(tw/2),b=(screenY+cameraY)/(th/2);
  const x=Math.round((a+b)/2),y=Math.round((b-a)/2);
  return this.renderer.canWalk(x,y)?{x,y}:null;
 }
}
root.TalkingIslandMovementController=TalkingIslandMovementController;
})(typeof window!=='undefined'?window:globalThis);
