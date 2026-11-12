/* P05-D36 — image-backed isometric scene renderer.
 * No map art is generated or bundled. Input coordinates and assets must be verified.
 * Usage: const renderer = new TalkingIslandLayerRenderer(canvas, {tileWidth:56,tileHeight:28});
 * renderer.setScene({bounds:{minX,minY,maxX,maxY},layers:[{id,depth,images:[{image,x,y,width,height,footY}]}]});
 * renderer.render({cameraX,cameraY,player:{image,x,y,footY,width,height}});
 * This is a renderer, NOT a historical map reconstruction.
 */
(function(root){
 'use strict';
 class TalkingIslandLayerRenderer {
  constructor(canvas,options={}){
   if(!canvas||!canvas.getContext)throw new TypeError('Canvas required');
   this.canvas=canvas;this.ctx=canvas.getContext('2d');
   this.tileWidth=options.tileWidth||56;this.tileHeight=options.tileHeight||28;
   this.scene=null;
  }
  setScene(scene){
   if(!scene||!scene.bounds||!Array.isArray(scene.layers))throw new TypeError('Invalid scene');
   const b=scene.bounds;
   if(![b.minX,b.minY,b.maxX,b.maxY].every(Number.isFinite)||b.maxX<=b.minX||b.maxY<=b.minY)throw new RangeError('Invalid bounds');
   for(const layer of scene.layers){
    if(!Number.isFinite(layer.depth)||!Array.isArray(layer.images))throw new TypeError('Invalid layer');
    for(const item of layer.images){
     if(!item.image||!Number.isFinite(item.x)||!Number.isFinite(item.y)||!Number.isFinite(item.width)||!Number.isFinite(item.height)||item.width<=0||item.height<=0)throw new TypeError('Invalid image placement');
    }
   }
   this.scene=scene;
  }
  project(x,y,cameraX=0,cameraY=0){
   return {x:(x-y)*this.tileWidth/2+this.canvas.width/2-cameraX,
           y:(x+y)*this.tileHeight/2-cameraY};
  }
  render({cameraX=0,cameraY=0,player=null}={}){
   const ctx=this.ctx;
   ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
   ctx.fillStyle='#141414';ctx.fillRect(0,0,this.canvas.width,this.canvas.height);
   if(!this.scene)return false;
   const entries=[];
   for(const layer of this.scene.layers){
    for(const item of layer.images)entries.push({depth:layer.depth,footY:item.footY??item.y,item});
   }
   if(player&&player.image)entries.push({depth:player.depth??1,footY:player.footY??player.y,item:player});
   entries.sort((a,b)=>a.depth-b.depth||a.footY-b.footY);
   for(const {item} of entries){
    if(!item.image.complete||!item.image.naturalWidth)continue;
    const p=this.project(item.x,item.y,cameraX,cameraY);
    const left=p.x-item.width/2,top=p.y-item.height;
    if(left>this.canvas.width||left+item.width<0||top>this.canvas.height||top+item.height<0)continue;
    ctx.drawImage(item.image,left,top,item.width,item.height);
   }
   return true;
  }
 }
 root.TalkingIslandLayerRenderer=TalkingIslandLayerRenderer;
})(typeof window!=='undefined'?window:globalThis);
