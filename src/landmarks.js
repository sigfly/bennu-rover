import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import catalog from '../landmark-manifest.json' with {type:'json'};

export const LANDMARKS=catalog.models;
const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const clamp=THREE.MathUtils.clamp;
const yellow=new THREE.MeshBasicMaterial({color:0xffff00,side:THREE.DoubleSide,toneMapped:false});
const green=new THREE.MeshStandardMaterial({color:0x3de763,emissive:0x126525,emissiveIntensity:.52,roughness:.8,side:THREE.DoubleSide});
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

export async function parseLandmark(bytes,info){
 const gltf=await loader.parseAsync(bytes,'');const model=gltf.scene;model.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(model,true),size=box.getSize(v()),center=box.getCenter(v());
 const expected=info.bounds.max.map((x,i)=>x-info.bounds.min[i]);
 if(Math.abs(size.y-expected[1])>Math.max(.25,expected[1]*.015)||[size.x,size.z].some((x,i)=>x>expected[i*2]*1.02+.25||x<expected[i*2]*.75))throw Error(info.name+' has unexpected metre dimensions');
 const group=new THREE.Group();group.name=info.name;group.add(model);model.position.add(v(-center.x,-box.min.y,-center.z));group.updateMatrixWorld(true);
 const list=[],footPoints=[],supportMap=new Map(),temp=v(),grayCache=new Map();
 const support=(x,z)=>{const key=Math.round(x/.85)+','+Math.round(z/.85);if(!supportMap.has(key))supportMap.set(key,[x,z]);};
 function gray(m){
  if(grayCache.has(m))return grayCache.get(m);
  const c=m.color||new THREE.Color(.6,.6,.6),lum=clamp(.2126*c.r+.7152*c.g+.0722*c.b,.035,.83);
  const out=new THREE.MeshStandardMaterial({color:new THREE.Color(lum,lum,lum),roughness:Math.max(.35,m.roughness??.85),metalness:Math.min(.45,m.metalness??0),side:m.side,transparent:m.transparent,opacity:m.opacity,depthWrite:m.depthWrite,vertexColors:m.vertexColors});
  grayCache.set(m,out);return out;
 }
 model.traverse(obj=>{if(!obj.isMesh)return;const geom=obj.geometry,p=geom.attributes.position;
  // The GLB data use real metres; preserve the mesh and full source transforms.
  const positions=[];
  for(let i=0;i<p.count;i++){temp.fromBufferAttribute(p,i).applyMatrix4(obj.matrixWorld);positions.push(temp.clone());if(temp.y<Math.max(1,size.y*.014))footPoints.push([temp.x,temp.z]);if(temp.y<.4)support(temp.x,temp.z);}
  // Sample actual low structural triangles, not the empty spaces between the
  // Eiffel Tower's four feet or the inside of an open arch.
  const count=geom.index?geom.index.count:p.count,at=i=>positions[geom.index?geom.index.getX(i):i];
  for(let i=0;i<count;i+=3){const a=at(i),b=at(i+1),c=at(i+2);
   for(const [p,q] of [[a,b],[b,c],[c,a]])if(Math.max(p.y,q.y)<.4){const n=Math.max(1,Math.ceil(p.distanceTo(q)/.85));for(let k=0;k<=n;k++)support(THREE.MathUtils.lerp(p.x,q.x,k/n),THREE.MathUtils.lerp(p.z,q.z,k/n));}
   if(Math.max(a.y,b.y,c.y)>.4)continue;
   const length=Math.max(a.distanceTo(b),a.distanceTo(c),b.distanceTo(c));
   const n=Math.min(100,Math.max(1,Math.ceil(length/1.25)));
   for(let j=0;j<=n;j++)for(let k=0;k<=n-j;k++){const f=j/n,g=k/n;support(a.x+(b.x-a.x)*f+(c.x-a.x)*g,a.z+(b.z-a.z)*f+(c.z-a.z)*g);}
  }
  if(geom.attributes.color){const col=geom.attributes.color;for(let i=0;i<col.count;i++){const l=.2126*col.getX(i)+.7152*col.getY(i)+.0722*col.getZ(i);col.setXYZ(i,l,l,l);}col.needsUpdate=true;}
  const normal=Array.isArray(obj.material)?obj.material.map(gray):gray(obj.material);obj.material=normal;obj.userData.landmarkId=info.id;obj.userData.normalMaterial=normal;obj.castShadow=true;obj.receiveShadow=true;list.push(obj);
 });
 // A convex envelope is used only for separation and rover obstacle checks; no pedestal is rendered.
 let footprint=hull(footPoints);if(footprint.length<3)footprint=[[-size.x/2,-size.z/2],[size.x/2,-size.z/2],[size.x/2,size.z/2],[-size.x/2,size.z/2]];
 // A small margin keeps the truck clear of the original building walls.
 footprint=footprint.map(([x,z])=>{const k=Math.hypot(x,z)||1;return [x+.5*x/k,z+.5*z/k]});
 const supportPoints=[...supportMap.values()];
 return {group,list,size,footprint,supportPoints:supportPoints.length>=4?supportPoints:footprint,info};
}
export function hull(points){
 const p=points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);if(p.length<3)return p;
 const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const lower=[],upper=[];for(const x of p){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),x)<=0)lower.pop();lower.push(x);}
 for(let i=p.length-1;i>=0;i--){const x=p[i];while(upper.length>1&&cross(upper.at(-2),upper.at(-1),x)<=0)upper.pop();upper.push(x);}
 lower.pop();upper.pop();return lower.concat(upper);
}
function inside(poly,x,z){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
export function siteDirection(i){
 const y=1-2*(i+.5)/LANDMARKS.length,a=i*Math.PI*(3-Math.sqrt(5)),r=Math.sqrt(1-y*y);
 const y0=1-1/LANDMARKS.length,rotation=new THREE.Quaternion().setFromUnitVectors(v(Math.sqrt(1-y0*y0),y0,0),v(1,.16,.04).normalize());
 return v(r*Math.cos(a),y,r*Math.sin(a)).applyQuaternion(rotation);
}
function frame(dir,yaw,groundAt,cast,tilt=null){
 const origin=groundAt(dir)?.point;if(!origin)throw Error('Missing terrain');
 const u=v(0,1,0).cross(dir);if(u.lengthSq()<.0001)u.set(1,0,0).cross(dir);u.normalize().applyAxisAngle(dir,yaw);
 let up=dir.clone(),w=u.clone().cross(up).normalize();
 if(tilt){up.addScaledVector(u,-tilt[0]).addScaledVector(w,-tilt[1]).normalize();u.addScaledVector(up,-u.dot(up)).normalize();w=u.clone().cross(up).normalize();}
 const sample=(x,z)=>{const point=origin.clone().addScaledVector(u,x).addScaledVector(w,z),hit=cast?cast(point,up):groundAt(point.clone().normalize());return hit?hit.point.clone().sub(origin).dot(up):0;};
 return {origin,u,w,up,dir,sample};
}
function samplePoints(poly){
 const a=Math.min(...poly.map(p=>p[0])),b=Math.max(...poly.map(p=>p[0])),c=Math.min(...poly.map(p=>p[1])),d=Math.max(...poly.map(p=>p[1]));
 const out=poly.slice();for(let i=0;i<=10;i++)for(let j=0;j<=10;j++){const x=a+(b-a)*i/10,z=c+(d-c)*j/10;if(inside(poly,x,z))out.push([x,z]);}return out;
}
function quantile(sorted,q){return sorted[Math.round((sorted.length-1)*q)];}
function fitTilt(points,heights){
 const n=points.length,mx=points.reduce((s,p)=>s+p[0],0)/n,mz=points.reduce((s,p)=>s+p[1],0)/n,mh=heights.reduce((s,h)=>s+h,0)/n;
 let xx=0,zz=0,xz=0,xh=0,zh=0;
 for(let i=0;i<n;i++){const x=points[i][0]-mx,z=points[i][1]-mz,h=heights[i]-mh;xx+=x*x;zz+=z*z;xz+=x*z;xh+=x*h;zh+=z*h;}
 const det=xx*zz-xz*xz;if(Math.abs(det)<1e-6)return [0,0];
 let a=(xh*zz-zh*xz)/det,b=(zh*xx-xh*xz)/det;const length=Math.hypot(a,b),limit=Math.tan(THREE.MathUtils.degToRad(16));
 if(length>limit){a*=limit/length;b*=limit/length;}return [a,b];
}
export function placeLandmark(asset,index,groundAt,occupied=[],cast=null){
 const base=siteDirection(index),tangent=v(0,1,0).cross(base);if(tangent.lengthSq()<.0001)tangent.set(1,0,0).cross(base);tangent.normalize();const other=base.clone().cross(tangent).normalize();
 const dense=asset.supportPoints?.length>=4?asset.supportPoints:samplePoints(asset.footprint),yaw=index*1.729+.36;let best;
 // Search a compact set of representative structural supports for the flattest
 // shallow-burial site. Retain all support points for the final grade check.
 const stride=Math.max(1,Math.ceil(dense.length/144)),points=dense.filter((_,i)=>i%stride===0);
 const radius=Math.max(...asset.footprint.map(([x,z])=>Math.hypot(x,z)));
 const candidates=[[0,0]];for(const r of [.026,.052,.078,.104])for(let j=0;j<8;j++){const a=j*Math.PI/4;candidates.push([r*Math.cos(a),r*Math.sin(a)]);}
 for(const [x,z] of candidates){
  const direction=base.clone().addScaledVector(tangent,x).addScaledVector(other,z).normalize();
  if((x||z)&&LANDMARKS.some((otherAsset,j)=>{if(j===index)return false;const placed=occupied[j],otherDir=placed?.dir||siteDirection(j),otherRadius=placed?Math.max(...placed.footprint.map(([a,b])=>Math.hypot(a,b))):Math.hypot(otherAsset.bounds.max[0]-otherAsset.bounds.min[0],otherAsset.bounds.max[2]-otherAsset.bounds.min[2])/2;return direction.angleTo(otherDir)*215<radius+otherRadius+10;}))continue;
  const radialFrame=frame(direction,yaw,groundAt,cast),radialHeights=points.map(([a,b])=>radialFrame.sample(a,b));
  const tilt=fitTilt(points,radialHeights),f=frame(direction,yaw,groundAt,cast,tilt);
  const heights=points.map(([a,b])=>f.sample(a,b)).sort((a,b)=>a-b),lo=heights[0],median=quantile(heights,.5),hi=heights.at(-1);
  const score=(median-lo)+.28*(hi-lo)+Math.hypot(x,z)*24+Math.max(0,(median-lo)-asset.size.y*.40)*3;
  if(!best||score<best.score)best={...f,score};
 }
 // The lowest actual footing determines grade. Every sampled support lies on
 // or below the measured ground (including all four tower legs). Deliberately
 // let real rock cover the lower walls instead of adding any synthetic base.
 const {origin,u,w,up,dir,sample}=best;
 const supportHeights=dense.map(([x,z])=>sample(x,z)),lo=Math.min(...supportHeights),grade=lo-.4;
 const group=asset.group;group.position.copy(origin).addScaledVector(up,grade);group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(u,up,w));group.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(group);return {...asset,dir,up,origin,grade,supportHeights,worldBounds:bounds};
}
export function createLandmarkHunt(scene,ground,groundAt,camera,canvas,ui,decode,onMode=()=>{}){
 const root=new THREE.Group();root.name='Architectural landmark expedition';root.visible=false;scene.add(root);
 const assets=[],meshes=[],found=new Set();let initialized=false,enabled=false,exposed=false,down=null,loading=null;
 const ray=new THREE.Raycaster();ray.firstHitOnly=true;
 const gradeRay=new THREE.Raycaster();gradeRay.firstHitOnly=true;
 const cast=(point,up)=>{gradeRay.set(point.clone().addScaledVector(up,850),up.clone().negate());return gradeRay.intersectObject(ground,false)[0]||null;};
 function update(){ui.counter.textContent=found.size+'/20 found';ui.progress.value=found.size;ui.expose.textContent=exposed?'Hide exposure':'Expose';ui.expose.setAttribute('aria-pressed',String(exposed));}
 function recolor(){for(const a of assets)for(const mesh of a.list)mesh.material=found.has(a.info.id)?green:exposed?yellow:mesh.userData.normalMaterial;update();}
 function discover(id){const a=assets.find(x=>x.info.id===id);if(!a||found.has(id))return false;found.add(id);recolor();const li=document.createElement('li');li.textContent=a.info.name+' — '+a.size.y.toFixed(1)+' m high';ui.list.append(li);ui.message.textContent=a.info.name+' • catalogued';if(found.size===20){ui.message.textContent='Case closed: all landmarks catalogued.';ui.finale.showModal();}return true;}
 async function build(){
  const pending=await Promise.all(LANDMARKS.map(info=>parseLandmark(decode('landmark-'+info.id),info)));
  for(let i=0;i<pending.length;i++){const a=placeLandmark(pending[i],i,groundAt,assets,cast);root.add(a.group);assets.push(a);meshes.push(...a.list);}
  initialized=true;root.updateMatrixWorld(true);
 }
 async function change(){
  enabled=ui.toggle.checked;ui.panel.hidden=!enabled;root.visible=enabled&&initialized;onMode(enabled);
  if(!enabled)return;
  if(!initialized){ui.message.textContent='Seating twenty scale models into the measured terrain…';ui.expose.disabled=true;ui.reset.disabled=true;try{loading??=build();await loading;}catch(error){ui.message.textContent='Unable to load landmarks: '+error.message;console.error(error);ui.toggle.checked=false;enabled=false;root.visible=false;onMode(false);return;}finally{ui.expose.disabled=false;ui.reset.disabled=false;}}
  root.visible=enabled;ui.message.textContent='Orbit or drive around Bennu. Click a building to catalogue it.';recolor();
 }
 function pick(e){if(!enabled||!initialized)return;const r=canvas.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),camera);
  const hit=ray.intersectObjects(meshes,false)[0],terrain=ray.intersectObject(ground,false)[0];if(hit&&(!terrain||hit.distance<terrain.distance+.15))discover(hit.object.userData.landmarkId);
 }
 // Terrain driving stays clear of building footprints where the model stands above rock.
 function obstructed(point){if(!enabled||!initialized)return false;for(const a of assets){const local=a.group.worldToLocal(point.clone());if(inside(a.footprint,local.x,local.z)&&local.y<a.size.y&&local.y>-.8)return true;}return false;}
 canvas.addEventListener('pointerdown',e=>{if(e.button===0)down={x:e.clientX,y:e.clientY,id:e.pointerId};});
 canvas.addEventListener('pointerup',e=>{if(down&&down.id===e.pointerId&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<6)pick(e);down=null;});
 canvas.addEventListener('pointercancel',()=>down=null);
 ui.toggle.addEventListener('change',change);ui.expose.addEventListener('click',()=>{exposed=!exposed;recolor();});
 ui.reset.addEventListener('click',()=>{found.clear();ui.list.replaceChildren();recolor();ui.message.textContent='Expedition reset. Click a building to catalogue it.';if(ui.finale.open)ui.finale.close();});
 ui.close.addEventListener('click',()=>ui.finale.close());update();
 return {root,assets,found,discover,obstructed,change,ready:()=>loading};
}
