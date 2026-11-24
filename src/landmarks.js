import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import catalog from '../landmark-manifest.json' with {type:'json'};

export const LANDMARKS=catalog.models;
const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const clamp=THREE.MathUtils.clamp;
const lightGray=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,side:THREE.DoubleSide});
const yellow=new THREE.MeshBasicMaterial({color:0xffff00,side:THREE.DoubleSide,toneMapped:false});
const green=new THREE.MeshStandardMaterial({color:0x3de763,emissive:0x126525,emissiveIntensity:.52,roughness:.8,side:THREE.DoubleSide});
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

export async function parseLandmark(bytes,info){
 const gltf=await loader.parseAsync(bytes,'');const model=gltf.scene;model.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(model,true),size=box.getSize(v()),center=box.getCenter(v());
 const expected=info.bounds.max.map((x,i)=>x-info.bounds.min[i]);
 if(Math.abs(size.y-expected[1])>Math.max(.25,expected[1]*.015)||[size.x,size.z].some((x,i)=>x>expected[i*2]*1.02+.25||x<expected[i*2]*.75))throw Error(info.name+' has unexpected metre dimensions');
 const group=new THREE.Group();group.name=info.name;group.add(model);model.position.add(v(-center.x,-box.min.y,-center.z));group.updateMatrixWorld(true);
 const list=[],footPoints=[],temp=v(),grayCache=new Map();
 function gray(m){
  if(grayCache.has(m))return grayCache.get(m);
  const c=m.color||new THREE.Color(.6,.6,.6),lum=clamp(.2126*c.r+.7152*c.g+.0722*c.b,.035,.83);
  const out=new THREE.MeshStandardMaterial({color:new THREE.Color(lum,lum,lum),roughness:Math.max(.35,m.roughness??.85),metalness:Math.min(.45,m.metalness??0),side:m.side,transparent:m.transparent,opacity:m.opacity,depthWrite:m.depthWrite,vertexColors:m.vertexColors});
  grayCache.set(m,out);return out;
 }
 model.traverse(obj=>{if(!obj.isMesh)return;const geom=obj.geometry,p=geom.attributes.position;
  // The GLB data use real metres; preserve the mesh and full source transforms.
  for(let i=0;i<p.count;i++){temp.fromBufferAttribute(p,i).applyMatrix4(obj.matrixWorld);if(temp.y<Math.max(1,size.y*.014))footPoints.push([temp.x,temp.z]);}
  if(geom.attributes.color){const col=geom.attributes.color;for(let i=0;i<col.count;i++){const l=.2126*col.getX(i)+.7152*col.getY(i)+.0722*col.getZ(i);col.setXYZ(i,l,l,l);}col.needsUpdate=true;}
  const normal=Array.isArray(obj.material)?obj.material.map(gray):gray(obj.material);obj.material=normal;obj.userData.landmarkId=info.id;obj.userData.normalMaterial=normal;list.push(obj);
 });
 // Convex ground envelope avoids a giant square pedestal under a rotated or rounded building.
 let footprint=hull(footPoints);if(footprint.length<3)footprint=[[-size.x/2,-size.z/2],[size.x/2,-size.z/2],[size.x/2,size.z/2],[-size.x/2,size.z/2]];
 // Expand by 0.5 m to support the outermost footing and avoid wall/rock seams.
 footprint=footprint.map(([x,z])=>{const k=Math.hypot(x,z)||1;return [x+.5*x/k,z+.5*z/k]});
 return {group,list,size,footprint,info};
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
function frame(dir,yaw,groundAt){
 const origin=groundAt(dir)?.point;if(!origin)throw Error('Missing terrain');
 const u=v(0,1,0).cross(dir);if(u.lengthSq()<.0001)u.set(1,0,0).cross(dir);u.normalize().applyAxisAngle(dir,yaw);const w=u.clone().cross(dir).normalize();
 const sample=(x,z)=>{const hit=groundAt(origin.clone().addScaledVector(u,x).addScaledVector(w,z).normalize());return hit?hit.point.clone().sub(origin).dot(dir):0;};
 return {origin,u,w,dir,sample};
}
function samplePoints(poly){
 const a=Math.min(...poly.map(p=>p[0])),b=Math.max(...poly.map(p=>p[0])),c=Math.min(...poly.map(p=>p[1])),d=Math.max(...poly.map(p=>p[1]));
 const out=poly.slice();for(let i=0;i<=10;i++)for(let j=0;j<=10;j++){const x=a+(b-a)*i/10,z=c+(d-c)*j/10;if(inside(poly,x,z))out.push([x,z]);}return out;
}
export function placeLandmark(asset,index,groundAt,occupied=[]){
 const base=siteDirection(index),tangent=v(0,1,0).cross(base);if(tangent.lengthSq()<.0001)tangent.set(1,0,0).cross(base);tangent.normalize();const other=base.clone().cross(tangent).normalize();
 const points=samplePoints(asset.footprint),yaw=index*1.729+.36;let best;
 // Choose a locally smoother patch within ~7 metres of each separated site.
 const radius=Math.max(...asset.footprint.map(([x,z])=>Math.hypot(x,z)));
 const candidates=[[0,0]];for(const r of [.026,.052,.078])for(let j=0;j<8;j++){const a=j*Math.PI/4;candidates.push([r*Math.cos(a),r*Math.sin(a)]);}
 for(const [x,z] of candidates){
  const direction=base.clone().addScaledVector(tangent,x).addScaledVector(other,z).normalize();
  if((x||z)&&LANDMARKS.some((otherAsset,j)=>{if(j===index)return false;const placed=occupied[j],otherDir=placed?.dir||siteDirection(j),otherRadius=placed?Math.max(...placed.footprint.map(([a,b])=>Math.hypot(a,b))):Math.hypot(otherAsset.bounds.max[0]-otherAsset.bounds.min[0],otherAsset.bounds.max[2]-otherAsset.bounds.min[2])/2;return direction.angleTo(otherDir)*215<radius+otherRadius+10;}))continue;
  const f=frame(direction,yaw,groundAt);const heights=points.map(([a,b])=>f.sample(a,b)),lo=Math.min(...heights),hi=Math.max(...heights),score=hi-lo+Math.hypot(x,z)*30;if(!best||score<best.score)best={...f,lo,hi,score};
 }
 const {origin,u,w,dir,sample}=best;
 // Keep the architecture rigid and level relative to local gravity; fit a terrain-connected stone foundation to its actual ground envelope.
 const perimeter=[];const polygon=asset.footprint;for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],n=Math.max(1,Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])/2));for(let j=0;j<n;j++)perimeter.push([THREE.MathUtils.lerp(a[0],b[0],j/n),THREE.MathUtils.lerp(a[1],b[1],j/n)]);}
 const edgeHeights=perimeter.map(([x,z])=>sample(x,z));
 const top=Math.max(best.hi,...edgeHeights)+.18;
 const group=asset.group;group.position.copy(origin).addScaledVector(dir,top);group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(u,dir,w));
 const verts=[],colors=[];
 // A narrow, irregular berm feathers the footing into the surrounding regolith.
 const outer=perimeter.map(([x,z],i)=>{const k=Math.hypot(x,z)||1,spread=clamp((top-edgeHeights[i])*.32,1.4,7);return [x+x/k*spread,z+z/k*spread];});
 const outerHeights=outer.map(([x,z])=>sample(x,z));
 function vertex(x,y,z,t){verts.push(x,y,z);const k=t*(.86+.14*Math.sin(x*.71+z*.39)+.045*Math.sin(x*2.71-z*1.49));colors.push(k,k,k);}
 const cx=perimeter.reduce((s,p)=>s+p[0],0)/perimeter.length,cz=perimeter.reduce((s,p)=>s+p[1],0)/perimeter.length;
 for(let i=0;i<perimeter.length;i++){const j=(i+1)%perimeter.length,a=perimeter[i],b=perimeter[j],aa=outer[i],bb=outer[j],ya=outerHeights[i]-top-1.7,yb=outerHeights[j]-top-1.7;
  // Top, side triangles to well below the measured ground — no open floating bottom edge.
  vertex(cx,-.06,cz,.25);vertex(a[0],-.06,a[1],.25);vertex(b[0],-.06,b[1],.25);
  vertex(a[0],-.06,a[1],.20);vertex(aa[0],ya,aa[1],.13);vertex(bb[0],yb,bb[1],.13);
  vertex(a[0],-.06,a[1],.20);vertex(bb[0],yb,bb[1],.13);vertex(b[0],-.06,b[1],.20);
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
 const foundation=new THREE.Mesh(geo,lightGray);foundation.name='Terrain-connected stone foundation';group.add(foundation);group.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(group);return {...asset,foundation,dir,origin,top,perimeter,edgeHeights,worldBounds:bounds};
}
export function createLandmarkHunt(scene,ground,groundAt,camera,canvas,ui,decode,onMode=()=>{}){
 const root=new THREE.Group();root.name='Architectural landmark expedition';root.visible=false;scene.add(root);
 const assets=[],meshes=[],found=new Set();let initialized=false,enabled=false,exposed=false,down=null,loading=null;
 const ray=new THREE.Raycaster();ray.firstHitOnly=true;
 function update(){ui.counter.textContent=found.size+'/20 found';ui.progress.value=found.size;ui.expose.textContent=exposed?'Hide exposure':'Expose';ui.expose.setAttribute('aria-pressed',String(exposed));}
 function recolor(){for(const a of assets)for(const mesh of a.list)mesh.material=found.has(a.info.id)?green:exposed?yellow:mesh.userData.normalMaterial;update();}
 function discover(id){const a=assets.find(x=>x.info.id===id);if(!a||found.has(id))return false;found.add(id);recolor();const li=document.createElement('li');li.textContent=a.info.name+' — '+a.size.y.toFixed(1)+' m high';ui.list.append(li);ui.message.textContent=a.info.name+' • catalogued';if(found.size===20){ui.message.textContent='Case closed: all landmarks catalogued.';ui.finale.showModal();}return true;}
 async function build(){
  const pending=await Promise.all(LANDMARKS.map(info=>parseLandmark(decode('landmark-'+info.id),info)));
  for(let i=0;i<pending.length;i++){const a=placeLandmark(pending[i],i,groundAt,assets);root.add(a.group);assets.push(a);meshes.push(...a.list);}
  initialized=true;root.updateMatrixWorld(true);
 }
 async function change(){
  enabled=ui.toggle.checked;ui.panel.hidden=!enabled;root.visible=enabled&&initialized;onMode(enabled);
  if(!enabled)return;
  if(!initialized){ui.message.textContent='Preparing twenty scale models and terrain foundations…';ui.expose.disabled=true;ui.reset.disabled=true;try{loading??=build();await loading;}catch(error){ui.message.textContent='Unable to load landmarks: '+error.message;console.error(error);ui.toggle.checked=false;enabled=false;root.visible=false;onMode(false);return;}finally{ui.expose.disabled=false;ui.reset.disabled=false;}}
  root.visible=enabled;ui.message.textContent='Orbit or drive around Bennu. Click a building to catalogue it.';recolor();
 }
 function pick(e){if(!enabled||!initialized)return;const r=canvas.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),camera);
  const hit=ray.intersectObjects(meshes,false)[0],terrain=ray.intersectObject(ground,false)[0];if(hit&&(!terrain||hit.distance<terrain.distance+.15))discover(hit.object.userData.landmarkId);
 }
 // Terrain driving stays clear of building footprints and their stone foundations.
 function obstructed(point){if(!enabled||!initialized)return false;for(const a of assets){const local=a.group.worldToLocal(point.clone());if(inside(a.footprint,local.x,local.z)&&local.y<.8)return true;}return false;}
 canvas.addEventListener('pointerdown',e=>{if(e.button===0)down={x:e.clientX,y:e.clientY,id:e.pointerId};});
 canvas.addEventListener('pointerup',e=>{if(down&&down.id===e.pointerId&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<6)pick(e);down=null;});
 canvas.addEventListener('pointercancel',()=>down=null);
 ui.toggle.addEventListener('change',change);ui.expose.addEventListener('click',()=>{exposed=!exposed;recolor();});
 ui.reset.addEventListener('click',()=>{found.clear();ui.list.replaceChildren();recolor();ui.message.textContent='Expedition reset. Click a building to catalogue it.';if(ui.finale.open)ui.finale.close();});
 ui.close.addEventListener('click',()=>ui.finale.close());update();
 return {root,assets,found,discover,obstructed,change,ready:()=>loading};
}
