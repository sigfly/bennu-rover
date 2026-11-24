import * as THREE from 'three';

// Native directional shadow mapping, cached in light space. Terrain stays a real
// measured triangle mesh; no fake projected ovals or image-space dark patches.
export function shadowProfile(mode,landmarks,quality,maxTextureSize=4096){
 if(quality==='off')return {enabled:false};
 const local=mode!=='orbit',resolution=Math.min(maxTextureSize,quality==='high'?4096:2048);
 return {enabled:true,local,resolution,half:local?42:landmarks?650:315,near:1,far:2000,bias:local?-.000012:-.000075,normalBias:local?.035:landmarks?.20:.10};
}
export function createSunShadows(renderer,light,scene,qualityEl,statsEl,terrainMaterial){
 renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.shadowMap.autoUpdate=false;
 light.shadow.autoUpdate=false;light.shadow.intensity=1;
 scene.add(light.target);
 const lastPos=new THREE.Vector3(1e9,1e9,1e9),lastRot=new THREE.Quaternion(),lastSun=new THREE.Vector3();
 let lastTruckPose=-1,profileKey='',lastRefresh=-Infinity,revision=0,previousVisibility='',lastMode='';
 const target=new THREE.Vector3();
 function configure(p){
  renderer.shadowMap.enabled=p.enabled;light.castShadow=p.enabled;
  // A single depth comparison is much cheaper on integrated/mobile graphics.
  renderer.shadowMap.type=p.resolution>2048?THREE.PCFSoftShadowMap:THREE.BasicShadowMap;
  terrainMaterial.needsUpdate=true;
  if(!p.enabled){if(light.shadow.map){light.shadow.map.dispose();light.shadow.map=null;}statsEl.textContent='Cast shadows off';return;}
  const s=light.shadow;
  if(s.mapSize.x!==p.resolution||s.mapSize.y!==p.resolution){if(s.map){s.map.dispose();s.map=null;}s.mapSize.set(p.resolution,p.resolution);}
  Object.assign(s.camera,{left:-p.half,right:p.half,top:p.half,bottom:-p.half,near:p.near,far:p.far});
  s.camera.updateProjectionMatrix();s.bias=p.bias;s.normalBias=p.normalBias;s.radius=1;
  statsEl.textContent=(p.local?'Local':'Global')+' • '+p.resolution.toLocaleString()+' px • '+(2*p.half/p.resolution).toFixed(2)+' m/texel';
 }
 function update({now,mode,sun,rover,landmarks,fossils,edition}){
  const quality=qualityEl.value, p=shadowProfile(mode,landmarks,quality,renderer.capabilities.maxTextureSize);
  const key=p.enabled?[p.local,p.resolution,p.half].join(':'):'off';
  const visibility=String(landmarks)+String(fossils),structural=key!==profileKey||visibility!==previousVisibility||mode!==lastMode;
  if(key!==profileKey){configure(p);profileKey=key;}
  previousVisibility=visibility;lastMode=mode;
  if(!p.enabled){light.target.position.set(0,0,0);light.position.copy(sun).multiplyScalar(1000);return;}
  const minimumInterval=edition==='ultra'?(p.local?200:350):(p.local?85:170);
  const moved=lastPos.distanceToSquared(rover.position)>(p.local?.10:.25)**2||lastRot.angleTo(rover.quaternion)>.08||(rover.userData.poseRevision??0)!==lastTruckPose;
  const sunChanged=lastSun.distanceToSquared(sun)>1e-8;
  const refresh=structural||((moved||sunChanged)&&now-lastRefresh>=minimumInterval);
  if(refresh){
   // An 84 m local shadow frustum greatly improves metre-scale rover detail.
   // The 2 km depth range still includes distant intervening boulders and structures.
   target.copy(p.local?rover.position:new THREE.Vector3());
   light.target.position.copy(target);light.position.copy(target).addScaledVector(sun,1000);
   light.shadow.needsUpdate=true;renderer.shadowMap.needsUpdate=true;
   lastSun.copy(sun);lastPos.copy(rover.position);lastRot.copy(rover.quaternion);lastTruckPose=rover.userData.poseRevision??0;lastRefresh=now;
   renderer.domElement.dataset.shadowRevision=String(++revision);
  }else{
   // Keep direct illumination synchronized as sliders move; the cached shadow
   // projection refreshes on the next bounded update.
   light.position.copy(light.target.position).addScaledVector(sun,1000);
  }
 }
 return {update};
}
