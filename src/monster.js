import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const clamp=THREE.MathUtils.clamp;
export const TRUCK={length:5.18,width:3.81,height:3.20,tireDiameter:1.6764,tireWidth:1.0922,travel:.762,track:1.359,front:1.64,rear:-1.64};
const radius=TRUCK.tireDiameter/2,halfTravel=TRUCK.travel/2;

export function dampedStep(state,target,dt,frequency=7,damping=1){
 // Stable substepped spring-damper, expressed in metres and seconds.
 const steps=Math.max(1,Math.ceil(dt/.008)),h=dt/steps,w=2*Math.PI*frequency;
 for(let i=0;i<steps;i++){state.v+=(w*w*(target-state.x)-2*damping*w*state.v)*h;state.x+=state.v*h;}
 return state.x;
}
export function wheelTargets(heights,track=TRUCK.track,front=TRUCK.front,rear=TRUCK.rear){
 const left=(heights[0]+heights[2])/2,right=(heights[1]+heights[3])/2,frontMean=(heights[0]+heights[1])/2,rearMean=(heights[2]+heights[3])/2;
 const roll=clamp((left-right)/(2*track),-.78,.78),pitch=clamp((frontMean-rearMean)/(front-rear),-.78,.78);
 const offsets=[roll*track+pitch*front,-roll*track+pitch*front,roll*track+pitch*rear,-roll*track+pitch*rear];
 const mean=heights.reduce((a,b)=>a+b,0)/4;
 // Preserve underbody clearance and allow the chassis to rise when a wheel
 // reaches the compression stop, instead of letting a tire disappear in rock.
 const body=Math.max(-.65,mean, ...heights.map((h,i)=>h-offsets[i]-halfTravel+.04));
 return {roll,pitch,body,offsets};
}
// The source asset contains fixed shocks and axles baked into one mesh.
// Remove whole welded connected components below the chassis, so new articulated
// running gear can move without a duplicate static suspension.
export function removeStaticRunningGear(geometry){
 const p=geometry.attributes.position,ix=geometry.index;if(!ix)throw Error('Expected indexed truck body');
 const packed=new Map(),parent=[],ids=new Int32Array(p.count);
 function root(i){while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;}
 for(let i=0;i<p.count;i++){const k=[p.getX(i),p.getY(i),p.getZ(i)].map(x=>Math.round(x*1e5)).join(',');let id=packed.get(k);if(id===undefined){id=parent.length;parent.push(id);packed.set(k,id);}ids[i]=id;}
 for(let i=0;i<ix.count;i+=3){const a=root(ids[ix.getX(i)]);parent[root(ids[ix.getX(i+1)])]=a;parent[root(ids[ix.getX(i+2)])]=a;}
 const stats=new Map();for(let i=0;i<p.count;i++){const id=root(ids[i]),y=p.getY(i);const s=stats.get(id)||[Infinity,-Infinity];s[0]=Math.min(s[0],y);s[1]=Math.max(s[1],y);stats.set(id,s);}
 const keep=[];for(let i=0;i<ix.count;i+=3){const a=ix.getX(i),s=stats.get(root(ids[a]));if(s[0]<1.10&&s[1]<=1.281)continue;keep.push(a,ix.getX(i+1),ix.getX(i+2));}
 const result=geometry.clone();result.setIndex(keep);result.computeBoundingBox();result.computeBoundingSphere();return result;
}
function grayscaleTexture(original,paint){
 if(!original?.image)return original;
 const canvas=document.createElement('canvas');canvas.width=original.image.width;canvas.height=original.image.height;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(original.image,0,0);
 const im=ctx.getImageData(0,0,canvas.width,canvas.height),d=im.data;
 for(let i=0;i<d.length;i+=4){const r=d[i],g=d[i+1],b=d[i+2];let l=.2126*r+.7152*g+.0722*b;
  // Brighter neutral paint for the lavender body, charcoal for the rubber;
  // baked shading, weathering, normal and roughness maps remain intact.
  if(paint&&b>g+8&&r>g+5&&b>85)l=Math.min(248,105+.83*l);
  d[i]=d[i+1]=d[i+2]=Math.round(l);
 }
 ctx.putImageData(im,0,0);const t=new THREE.CanvasTexture(canvas);
 t.colorSpace=original.colorSpace;t.flipY=original.flipY;t.wrapS=original.wrapS;t.wrapT=original.wrapT;t.magFilter=original.magFilter;t.minFilter=original.minFilter;t.generateMipmaps=original.generateMipmaps;t.anisotropy=original.anisotropy;t.offset.copy(original.offset);t.repeat.copy(original.repeat);t.rotation=original.rotation;t.center.copy(original.center);return t;
}
function monoMaterial(m,cache){
 const out=m.clone(),name=m.name.toLowerCase();
 if(out.color){const l=.2126*out.color.r+.7152*out.color.g+.0722*out.color.b;out.color.setRGB(l,l,l);}
 if(name.includes('hubcap'))out.color.setHex(0xd6d6d6);
 if(out.map){const key=out.map.uuid;if(!cache.has(key))cache.set(key,grayscaleTexture(out.map,name.includes('body')));out.map=cache.get(key);}
 if(out.emissive){const l=.2126*out.emissive.r+.7152*out.emissive.g+.0722*out.emissive.b;out.emissive.setRGB(l,l,l);}
 return out;
}
const steel=new THREE.MeshStandardMaterial({color:0xbfc0c1,metalness:.70,roughness:.35}),black=new THREE.MeshStandardMaterial({color:0x272727,roughness:.75,metalness:.27}),white=new THREE.MeshStandardMaterial({color:0xf1f1f1,metalness:.35,roughness:.37});
function addMesh(group,geometry,material){const m=new THREE.Mesh(geometry,material);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;}
function link(group,r,material){return addMesh(group,new THREE.CylinderGeometry(r,r,1,14),material);}
function orientLink(mesh,a,b){const d=b.clone().sub(a);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(V(0,1,0),d.clone().normalize());mesh.scale.set(1,d.length(),1);}
class Helix extends THREE.Curve{getPoint(t,target=new THREE.Vector3()){const a=t*Math.PI*2*8;return target.set(.112*Math.cos(a),t-.5,.112*Math.sin(a));}}
function makeDamper(group,sign,z){
 const shock=link(group,.074,black),shaft=link(group,.041,steel);
 const spring=addMesh(group,new THREE.TubeGeometry(new Helix(),100,.024,7,false),white);
 const arm=link(group,.043,black),arm2=link(group,.033,steel);
 const upper=V(sign*.53,1.57,z),lower=V();
 return y=>{lower.set(sign*.98,y,z);const delta=upper.clone().sub(lower),mid=lower.clone().addScaledVector(delta,.52);
  orientLink(shock,lower,mid);orientLink(shaft,mid,upper);orientLink(spring,lower.clone().addScaledVector(delta,.12),upper.clone().addScaledVector(delta,-.12));
  orientLink(arm,V(sign*.46,1.35,z-(z>0?.43:-.43)),lower);orientLink(arm2,V(sign*.43,1.46,z+(z>0?.35:-.35)),lower);
 };
}
export async function createMonsterTruck(bytes){
 const gltf=await new GLTFLoader().parseAsync(bytes,''),model=gltf.scene;model.updateMatrixWorld(true);
 const root=new THREE.Group();root.name='Full-scale monochrome monster truck';root.userData.poseRevision=0;
 const sourceBody=model.getObjectByName('monster-truck_body'),windows=model.getObjectByName('monster-truck_windows');
 if(!sourceBody?.isMesh||!windows?.isMesh)throw Error('Monster truck body missing');
 const mapCache=new Map();const materials=new Map();
 function recolor(o){o.traverse(m=>{if(!m.isMesh)return;m.material=Array.isArray(m.material)?m.material.map(x=>monoMaterial(x,mapCache)):monoMaterial(m.material,mapCache);m.castShadow=true;m.receiveShadow=true;});}
 sourceBody.geometry=removeStaticRunningGear(sourceBody.geometry);root.add(sourceBody,windows);
 const sY=TRUCK.height/2.635,sZ=TRUCK.length/4.57989025;
 for(const b of [sourceBody,windows]){b.position.set(0,0,-.03997254*sZ);b.scale.set(1,sY,sZ);recolor(b);}
 const wheelNames=['fl','fr','rl','rr'],wheels=[];
 for(let i=0;i<4;i++){
  const sign=i%2===0?1:-1,z=i<2?TRUCK.front:TRUCK.rear;const node=model.getObjectByName('monster-truck_wheel_'+wheelNames[i]);if(!node)throw Error('Missing independent wheel '+wheelNames[i]);
  const mount=new THREE.Group(),steering=new THREE.Group(),spin=new THREE.Group();root.add(mount);mount.add(steering);steering.add(spin);spin.add(node);
  mount.position.set(sign*TRUCK.track,radius,z);node.position.set(0,0,0);node.scale.set(TRUCK.tireWidth/.599654615,radius/.8,radius/.8);recolor(node);
  const articulation=makeDamper(root,sign,z);wheels.push({mount,steering,spin,node,sign,z,state:{x:radius,v:0},articulation});
 }
 const axles=[0,2].map(i=>({i,axle:link(root,.085,black),diff:addMesh(root,new THREE.SphereGeometry(.19,16,12),black)}));
 root.traverse(m=>{if(m.isMesh)for(const mat of Array.isArray(m.material)?m.material:[m.material])materials.set(mat,{colorWrite:mat.colorWrite,depthWrite:mat.depthWrite});});
 function cockpit(hidden){for(const [mat,original] of materials){mat.colorWrite=hidden?false:original.colorWrite;mat.depthWrite=hidden?false:original.depthWrite;}}
 const heave={x:0,v:0},pitchState={x:0,v:0},rollState={x:0,v:0},steerState={x:0,v:0};
 let contacts=[],lastSurface=V(1e8,0,0),lastHeading=V(),lastSpin=0,initialized=false;
 const basis=new THREE.Matrix4(),radial=V(),right=V(),forward=V(),up=V(),world=V(),local=V();let wheelSpin=0,lastRevisionPose=0;
 function update({surface,heading,groundAt,dt,velocity,steer,reset=false}){
  radial.copy(surface).normalize();forward.copy(heading).addScaledVector(radial,-heading.dot(radial)).normalize();right.crossVectors(radial,forward).normalize();
  if(reset||surface.distanceToSquared(lastSurface)>1e-6||forward.distanceToSquared(lastHeading)>1e-6||!contacts.length){contacts=wheels.map(w=>groundAt(surface.clone().addScaledVector(right,w.sign*TRUCK.track).addScaledVector(forward,w.z).normalize())?.point||surface.clone());lastSurface.copy(surface);lastHeading.copy(forward);}
  const heights=contacts.map(p=>p.clone().sub(surface).dot(radial)),targets=wheelTargets(heights);
  if(!initialized||reset){heave.x=targets.body;heave.v=0;pitchState.x=targets.pitch;pitchState.v=0;rollState.x=targets.roll;rollState.v=0;steerState.x=0;steerState.v=0;}
  else{dampedStep(heave,targets.body,dt,2.3,.86);dampedStep(pitchState,targets.pitch,dt,2.9,.93);dampedStep(rollState,targets.roll,dt,2.9,.91);}
  up.copy(radial).addScaledVector(right,-rollState.x).addScaledVector(forward,-pitchState.x).normalize();
  forward.addScaledVector(up,-forward.dot(up)).normalize();right.crossVectors(up,forward).normalize();forward.crossVectors(right,up).normalize();
  basis.makeBasis(right,up,forward);root.quaternion.setFromRotationMatrix(basis);root.position.copy(surface).addScaledVector(radial,heave.x+.035);root.updateMatrixWorld(true);
  dampedStep(steerState,steer*.46,dt,5,1);wheelSpin=(wheelSpin+velocity*dt/radius)%(Math.PI*2);
  let poseChanged=Math.abs(wheelSpin-lastSpin)>1e-5;lastSpin=wheelSpin;
  for(const [i,w] of wheels.entries()){
   local.copy(contacts[i]);root.worldToLocal(local);const target=clamp(local.y+radius,radius-halfTravel,radius+halfTravel);
   const old=w.state.x,oldSteer=w.steering.rotation.y;
   if(!initialized||reset){w.state.x=target;w.state.v=0;}
   else{dampedStep(w.state,target,dt,7,.93);if(w.state.x<target-.075){w.state.x=target-.075;w.state.v=Math.max(0,w.state.v);}}
   w.state.x=clamp(w.state.x,radius-halfTravel,radius+halfTravel);w.mount.position.y=w.state.x;w.steering.rotation.y=steerState.x*(i<2?1:-.4);w.spin.rotation.x=wheelSpin;w.articulation(w.state.x);
   if(Math.abs(old-w.state.x)>1e-4||Math.abs(oldSteer-w.steering.rotation.y)>1e-4)poseChanged=true;
  }
  for(const a of axles){const l=wheels[a.i].mount.position,r=wheels[a.i+1].mount.position;orientLink(a.axle,l,r);a.diff.position.copy(l).add(r).multiplyScalar(.5);}
  initialized=true;if(poseChanged||reset)root.userData.poseRevision++;
  return {up:up.clone(),forward:forward.clone(),suspension:wheels.map(w=>100*(w.state.x-radius+halfTravel)/TRUCK.travel)};
 }
 return {root,wheels,update,cockpit};
}
