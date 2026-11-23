'use strict';

function createIslandResources({base,clock,readJson,readImage}){
 const images=new Map(),documents=new Map();
 const stats={imageHits:0,imageMisses:0,imageFailures:0,imageLoadMs:0,
  sceneLoads:0,sceneFailures:0,sceneLoadMs:0,lastSceneMs:0,draws:0,drawMs:0,maxDrawMs:0};
 function load(cache,path,read,onFailure){
  const url=new URL(path,base).href;
  if(cache.has(url))return cache.get(url);
  const task=Promise.resolve().then(()=>read(url)).catch(error=>{
   cache.delete(url);
   onFailure?.();
   throw error;
  });
  cache.set(url,task);
  return task;
 }
 return {
  json:path=>load(documents,path,readJson),
  image(path){
   const url=new URL(path,base).href;
   if(images.has(url))stats.imageHits++;
   else stats.imageMisses++;
   return load(images,url,async key=>{
    const start=clock();
    try{return await readImage(key);}
    finally{stats.imageLoadMs+=clock()-start;}
   },()=>stats.imageFailures++);
  },
  async measureScene(task){
   const start=clock();
   stats.sceneLoads++;
   try{return await task();}
   catch(error){stats.sceneFailures++;throw error;}
   finally{stats.lastSceneMs=clock()-start;stats.sceneLoadMs+=stats.lastSceneMs;}
  },
  recordDraw(ms){
   stats.draws++;stats.drawMs+=ms;stats.maxDrawMs=Math.max(stats.maxDrawMs,ms);
  },
  snapshot(){return {...stats,meanDrawMs:stats.draws?stats.drawMs/stats.draws:0};}
 };
}

const islandResources=createIslandResources({
 base:document.baseURI,
 clock:()=>performance.now(),
 async readJson(url){
  if(location.protocol==='file:')throw Error('場景資料需透過 HTTP 開啟，請使用 Windows 線上測試網址。');
  const response=await fetch(url);
  if(!response.ok)throw Error('無法讀取場景資料：'+url);
  return response.json();
 },
 async readImage(url){
  const image=new Image();
  await new Promise((resolve,reject)=>{
   image.onload=resolve;
   image.onerror=()=>reject(Error('無法讀取核實素材：'+url));
   image.src=url;
  });
  if(typeof image.decode==='function')await image.decode();
  return image;
 }
});
window.getLineagePerformance=()=>islandResources.snapshot();
