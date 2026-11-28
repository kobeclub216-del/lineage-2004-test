const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../v182-p05-windows/assets/local-actor-sprites.js');

test('local actor batch checks all directions and offsets and shares decoded frames',async()=>{
 const files=[];
 const names=Array.from({length:8},(_,direction)=>{
  const stem='42-'+direction;
  files.push({name:'frames/'+stem+'/info.txt',text:async()=> '  Frame 0: 12x24, offset=(-3,-5)\r\n'});
  files.push({name:'frames/'+stem+'/'+stem+'_frame0.png'});
  return stem+'.spr';
 });
 const actions=['idle','walk','attack','hit','death'].map(kind=>({
  kind,directions:8,countMatches:true,declaredFrames:1,
  frames:[{frameIndex:0,durationRaw:3,files:names}],
 }));
 const entry={candidate:'fixture',kind:'monster',status:'matched',spriteId:42,actions};
 let decoded=0,closed=0;
 const decode=async()=>{decoded++;return {width:12,height:24,close(){closed++;}};};
 const plan={schemaVersion:1,candidates:[entry]};
 const result=await lineageLocalActors.load(plan,files,decode);
 assert.equal(result.actors.length,1);
 assert.equal(decoded,8);
 const frame=lineageLocalActors.select(result.actors[0],'death',7,100);
 assert.deepEqual([frame.x,frame.y,frame.duration],[-3,-5,3]);
 result.close();
 assert.equal(closed,8);
 const incomplete=await lineageLocalActors.load(plan,files.slice(0,-1),decode);
 assert.equal(incomplete.actors.length,0);
 assert.match(incomplete.rejected[0].error,/Missing frame/);
 incomplete.close();
});

test('local village NPC replacement preserves coordinates, offsets and static fallback',async()=>{
 const files=[];
 const names=Array.from({length:8},(_,direction)=>{
  const stem='98-'+direction;
  files.push({name:'frames/'+stem+'/info.txt',text:async()=> 'Frame 0: 12x24, offset=(-3,-5)'});
  files.push({name:'frames/'+stem+'/'+stem+'_frame0.png'});
  return stem+'.spr';
 });
 const plan={schemaVersion:1,candidates:[{
  candidate:'pandora',kind:'npc',status:'matched',entryId:98,spriteId:98,sourceName:'pandora',
  actions:[{kind:'idle',directions:8,countMatches:true,declaredFrames:1,
   frames:[{frameIndex:0,durationRaw:3,files:names}]}],
 }]};
 const actor={x:2,y:4,width:30,height:50};
 assert.equal(await lineageLocalActors.loadVillageNpcs(plan,files,async()=>({width:12,height:24})),1);
 const frame=lineageLocalActors.villageNpc(actor,98,0);
 assert.equal(frame.interactionActor,actor);
 assert.deepEqual([frame.x,frame.y,frame.offsetX,frame.offsetY],[2,4,3,19]);
 assert.equal(lineageLocalActors.villageNpc(actor,237,0),actor);
 lineageLocalActors.clearVillageNpcs();
 assert.equal(lineageLocalActors.villageNpc(actor,98,0),actor);
});
