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
   this.collision=null;
  }
  setScene(scene){
   if(!scene||!scene.bounds||!Array.isArray(scene.layers))throw new TypeError('Invalid scene');
   const b=scene.bounds;
   if(![b.minX,b.minY,b.maxX,b.maxY].every(Number.isFinite)||b.maxX<=b.minX||b.maxY<=b.minY)throw new RangeError('Invalid bounds');
   for(const layer of scene.layers){
    if(!Number.isFinite(layer.depth)||!Array.isArray(layer.images))throw new TypeError('Invalid layer');
    for(const item of layer.images){
     if(item.sourceRect&&(!['x','y','width','height'].every(k=>Number.isInteger(item.sourceRect[k]))||item.sourceRect.x<0||item.sourceRect.y<0||item.sourceRect.width<=0||item.sourceRect.height<=0))throw new TypeError('Invalid sprite source rectangle');
     if(!item.image||!Number.isFinite(item.x)||!Number.isFinite(item.y)||!Number.isFinite(item.width)||!Number.isFinite(item.height)||item.width<=0||item.height<=0)throw new TypeError('Invalid image placement');
    }
   }
   this.scene=scene;
  }
  project(x,y,cameraX=0,cameraY=0){
   return {x:(x-y)*this.tileWidth/2+this.canvas.width/2-cameraX,
           y:(x+y)*this.tileHeight/2-cameraY};
  }
  // P05-D38: data-driven collision; missing collision data is NOT treated as walkable.
  setCollision({bounds,blockedCells}){
   if(!bounds||![bounds.minX,bounds.minY,bounds.maxX,bounds.maxY].every(Number.isInteger))throw new TypeError('Integer collision bounds required');
   if(bounds.minX>=bounds.maxX||bounds.minY>=bounds.maxY)throw new RangeError('Invalid collision bounds');
   if(!Array.isArray(blockedCells))throw new TypeError('Blocked cell list required');
   const blocked=new Set();
   for(const cell of blockedCells){
    if(!Array.isArray(cell)||cell.length!==2||!cell.every(Number.isInteger))throw new TypeError('Invalid blocked cell');
    if(cell[0]<bounds.minX||cell[0]>=bounds.maxX||cell[1]<bounds.minY||cell[1]>=bounds.maxY)throw new RangeError('Blocked cell outside bounds');
    blocked.add(cell[0]+','+cell[1]);
   }
   this.collision={bounds,blocked};
  }
  canWalk(x,y){
   if(!this.collision||!Number.isInteger(x)||!Number.isInteger(y))return false;
   const {bounds:b,blocked}=this.collision;
   return x>=b.minX&&x<b.maxX&&y>=b.minY&&y<b.maxY&&!blocked.has(x+','+y);
  }
  // P05-D40: a reference photograph/map is a screen-space image, not a world tile.
  // Keep its original aspect ratio and never fabricate world coordinates for it.
  renderReferenceImage(image){
   if(!image||!image.complete||!image.naturalWidth||!image.naturalHeight)return false;
   const ctx=this.ctx,w=this.canvas.width,h=this.canvas.height;
   ctx.clearRect(0,0,w,h);ctx.fillStyle='#141414';ctx.fillRect(0,0,w,h);
   const scale=Math.min(w/image.naturalWidth,h/image.naturalHeight);
   const dw=image.naturalWidth*scale,dh=image.naturalHeight*scale;
   ctx.drawImage(image,(w-dw)/2,(h-dh)/2,dw,dh);
   return true;
  }
  // P05-D42: turn verified scene descriptors into image objects without
  // inventing artwork, geometry, or historical coordinates.
  static async loadSceneDescriptor(descriptor,loadImage){
   if(!descriptor||descriptor.verified!==true||!descriptor.bounds||!Array.isArray(descriptor.layers))throw new TypeError('Verified scene descriptor required');
   if(typeof loadImage!=='function')throw new TypeError('Image loader required');
   const layers=[];
   for(const layer of descriptor.layers){
    if(layer.verified!==true||!Number.isFinite(layer.depth)||!Array.isArray(layer.images))throw new TypeError('Unverified or invalid scene layer');
    const images=[];
    for(const item of layer.images){
     if(item.verified!==true||item.licenseVerified!==true||typeof item.path!=='string'||!/^\.\/assets\/maps\/[a-zA-Z0-9_/-]+\.(?:png|webp|jpg|jpeg)$/.test(item.path)||item.path.split('/').some(part=>part==='..'))throw new TypeError('Unverified or unsafe scene image path');
     const image=await loadImage(item.path);
     if(!image||!image.complete||!image.naturalWidth||!image.naturalHeight)throw new Error('Scene image failed: '+item.path);
     if(![item.x,item.y,item.width,item.height].every(Number.isFinite)||item.width<=0||item.height<=0||(item.footY!==undefined&&!Number.isFinite(item.footY)))throw new TypeError('Invalid scene image placement');
     if(item.sourceRect){
      const sr=item.sourceRect;
      if(!['x','y','width','height'].every(k=>Number.isInteger(sr[k]))||
       sr.x<0||sr.y<0||sr.width<=0||sr.height<=0||
       sr.x+sr.width>image.naturalWidth||sr.y+sr.height>image.naturalHeight)
       throw new TypeError('Scene sprite crop outside image bounds');
     }
     images.push({image,x:item.x,y:item.y,width:item.width,height:item.height,
      footY:item.footY,...(item.sourceRect?{sourceRect:{...item.sourceRect}}:{})});
    }
    layers.push({id:layer.id,depth:layer.depth,images});
   }
   if(![descriptor.bounds.minX,descriptor.bounds.minY,descriptor.bounds.maxX,descriptor.bounds.maxY].every(Number.isFinite)||descriptor.bounds.minX>=descriptor.bounds.maxX||descriptor.bounds.minY>=descriptor.bounds.maxY)throw new TypeError('Invalid verified scene bounds');
   return {bounds:descriptor.bounds,layers};
  }
  render({cameraX=0,cameraY=0,player=null}={}){
   const ctx=this.ctx;
   ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
   ctx.fillStyle='#141414';ctx.fillRect(0,0,this.canvas.width,this.canvas.height);
   if(!this.scene)return false;
   if(!Number.isFinite(cameraX)||!Number.isFinite(cameraY))throw new TypeError('Invalid camera coordinates');
   const entries=[];
   for(const layer of this.scene.layers){
    for(const item of layer.images)entries.push({depth:layer.depth,footY:item.footY??item.y,item});
   }
   if(player&&player.image)entries.push({depth:player.depth??1,footY:player.footY??player.y,item:player});
   // Ground is below actors; world objects at the SAME depth sort by
   // foot position, so a character can pass in front of or behind buildings.
   // Foreground overlays can use a higher explicit depth.
   entries.sort((a,b)=>a.depth-b.depth||a.footY-b.footY);
   for(const {item} of entries){
    if(!item.image.complete||!item.image.naturalWidth)continue;
    const p=this.project(item.x,item.y,cameraX,cameraY);
    const left=p.x-item.width/2,top=p.y-item.height;
    if(left>this.canvas.width||left+item.width<0||top>this.canvas.height||top+item.height<0)continue;
    if(item.sourceRect){const src=item.sourceRect;if(src.x+src.width>item.image.naturalWidth||src.y+src.height>item.image.naturalHeight)continue;ctx.drawImage(item.image,src.x,src.y,src.width,src.height,left,top,item.width,item.height)}
    else ctx.drawImage(item.image,left,top,item.width,item.height);
   }
   return true;
  }
 }
 root.TalkingIslandLayerRenderer=TalkingIslandLayerRenderer;
})(typeof window!=='undefined'?window:globalThis);
