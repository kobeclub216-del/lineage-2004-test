/* P05-D53 — scene movement controller. No art, map coordinates or walkability invented.
 * Requires a verified scene and explicit collision data before movement.
 */
(function(root){
'use strict';
class TalkingIslandMovementController {
 constructor(renderer,options={}){
  if(!renderer||typeof renderer.canWalk!=='function'||typeof renderer.project!=='function')throw new TypeError('Scene renderer required');
  if(options.maxNodes!==undefined&&(!Number.isInteger(options.maxNodes)||options.maxNodes<1||options.maxNodes>100000))throw new RangeError('Invalid path search limit');
  this.renderer=renderer;this.position=null;this.route=[];this.facing='S';this.moving=false;this.maxNodes=options.maxNodes??4096;
 }
 spawn(x,y){
  if(!this.renderer.scene||!this.renderer.canWalk(x,y))throw new RangeError('Spawn requires verified walkable scene cell');
  this.position={x,y};this.route=[];this.moving=false;return {...this.position};
 }
 moveTo(x,y){
  this.route=[];this.moving=false; // A new destination replaces the old route, even if invalid.
  if(!this.position||!this.renderer.scene||!this.renderer.canWalk(x,y))return false;
  const start=this.position, key=(x,y)=>x+','+y;
  const visited=new Set([key(start.x,start.y)]),queue=[start],parents=new Map();
  // Eight-direction movement; diagonals must not cut through blocked corners.
  const directions=[[0,-1],[-1,0],[1,0],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]];
  let found=false,head=0;
  while(head<queue.length&&head<this.maxNodes){
   const p=queue[head++];
   if(p.x===x&&p.y===y){found=true;break}
   for(const [dx,dy] of directions){
    const nx=p.x+dx,ny=p.y+dy,k=key(nx,ny);
    const diagonal=dx!==0&&dy!==0;
    if(diagonal&&(!this.renderer.canWalk(p.x+dx,p.y)||!this.renderer.canWalk(p.x,p.y+dy)))continue;
    if(queue.length<this.maxNodes&&!visited.has(k)&&this.renderer.canWalk(nx,ny)){
     visited.add(k);parents.set(k,p);queue.push({x:nx,y:ny});
    }
   }
  }
  if(!found)return false;
  const path=[];let p={x,y};
  while(p.x!==start.x||p.y!==start.y){path.push(p);p=parents.get(key(p.x,p.y));if(!p)return false}
  this.route=path.reverse();this.moving=this.route.length>0;return true;
 }
 step(){
  if(!this.position||!this.route.length){this.moving=false;return false;}
  const next=this.route.shift();
  if(!this.renderer.canWalk(next.x,next.y)){this.route=[];this.moving=false;return false}
  const dx=next.x-this.position.x,dy=next.y-this.position.y;
  // Facing names are world-grid directions, independent of screen orientation.
  this.facing=({'0,-1':'N','1,-1':'NE','1,0':'E','1,1':'SE','0,1':'S','-1,1':'SW','-1,0':'W','-1,-1':'NW'})[dx+','+dy]||this.facing;
  this.position={...next};this.moving=this.route.length>0;return true;
 }
 cancel(){this.route=[];this.moving=false}
 getAnimationState(){return {facing:this.facing,moving:this.moving,position:this.position?{...this.position}:null}}
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
