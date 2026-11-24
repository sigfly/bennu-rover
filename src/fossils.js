import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export const DINOSAURS = [
 ['Diplodocus',26,'sauropod','whip'],['Brachiosaurus',22,'sauropod','tall'],['Apatosaurus',21,'sauropod','heavy'],['Mamenchisaurus',22,'sauropod','neck'],['Camarasaurus',23,'sauropod','box'],
 ['Tyrannosaurus rex',12,'theropod','rex'],['Giganotosaurus',13,'theropod','giant'],['Spinosaurus',14,'theropod','sail'],['Allosaurus',9.7,'theropod','brow'],['Baryonyx',10,'theropod','fish'],['Carnotaurus',8,'theropod','bull'],['Ceratosaurus',7,'theropod','nose'],
 ['Triceratops',9,'horned','three'],['Styracosaurus',5.5,'horned','spikes'],['Pachyrhinosaurus',8,'horned','boss'],
 ['Stegosaurus',9,'armored','plates'],['Ankylosaurus',8,'armored','club'],['Edmontosaurus',13,'duck','plain'],['Corythosaurus',10,'duck','helmet'],['Parasaurolophus',9,'duck','crest']
].map(([name,length,family,variant])=>({name,length,family,variant}));
const vec=(x,y=0,z=0)=>new THREE.Vector3(x,y,z);
const mix=THREE.MathUtils.lerp;
function seeded(seed){return ()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
export function skeleton(d,index){
 const rand=seeded(941+index*847), bones=[];
 const sau=d.family==='sauropod', predator=d.family==='theropod', horn=d.family==='horned', armor=d.family==='armored', duck=d.family==='duck';
 const v=d.variant, hip=sau?-.12: -.03, shoulder=sau?.17:.23, skull=sau?(v==='neck'?.46:v==='whip'?.40:.44):.41;
 const tail=sau?-.50:-.50, neckBend=rand()*.055-.028, bodyWidth=sau?.092:horn?.15:armor?.13:duck?.105:.09;
 const tone=new THREE.Color();const base=new THREE.Color('#b5a18a');
 function paint(g,shade=1){const p=g.attributes.position,c=new Float32Array(p.count*3);const tint=.84+rand()*.28;for(let i=0;i<p.count;i++){const f=tint*shade*(.90+rand()*.20);tone.copy(base).multiplyScalar(f);c.set([tone.r,tone.g,tone.b],i*3);}g.setAttribute('color',new THREE.BufferAttribute(c,3));g.deleteAttribute('uv');const out=g.index?g.toNonIndexed():g;bones.push(out);if(out!==g)g.dispose();}
 // Sculpted bone shafts: flared epiphyses, irregular cross sections and tapered bony processes.
 function bone(a,b,r,tip=r,shape='joint'){
  a=vec(...a);b=vec(...b);const axis=b.clone().sub(a),length=axis.length();if(length<1e-6)return;
  const q=new THREE.Quaternion().setFromUnitVectors(vec(0,1,0),axis.normalize());
  const pts=[];const rings=7,segments=9,positions=[],indices=[];
  for(let j=0;j<=rings;j++){const t=j/rings;let w=mix(r,tip,t);if(shape==='joint')w*=.58+.63*Math.pow(Math.abs(2*t-1),2);else if(shape==='taper')w*=1-.82*t;else w*=.83+.17*Math.sin(t*Math.PI);
   if(j===0||j===rings)w*=.58;
   for(let k=0;k<segments;k++){const angle=k/segments*Math.PI*2,rr=w*(.84+.32*rand());const p=vec(Math.cos(angle)*rr,t*length,Math.sin(angle)*rr*.78).applyQuaternion(q).add(a);positions.push(p.x,p.y,p.z);}
  }
  for(let j=0;j<rings;j++)for(let k=0;k<segments;k++){let x=j*segments+k,y=j*segments+(k+1)%segments;indices.push(x,y,x+segments,y,y+segments,x+segments);}
  for(let k=1;k<segments-1;k++){indices.push(0,k+1,k);const o=rings*segments;indices.push(o,o+k,o+k+1);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();paint(g);
 }
 function pebble(x,y,z,a,b,c,shade=1){const g=new THREE.IcosahedronGeometry(1,1);const p=g.attributes.position;for(let i=0;i<p.count;i++){const f=1+.11*Math.sin(p.getX(i)*13+p.getY(i)*17+p.getZ(i)*19+index);p.setXYZ(i,p.getX(i)*f,p.getY(i)*f,p.getZ(i)*f);}g.scale(a,b,c);g.translate(x,y,z);g.computeVertexNormals();paint(g,shade);}
 function curve(points,r,end=r,steps=12){const c=new THREE.CatmullRomCurve3(points.map(p=>vec(...p)));for(let i=0;i<steps;i++){const a=c.getPoint(i/steps),b=c.getPoint((i+1)/steps);bone(a.toArray(),b.toArray(),mix(r,end,i/steps),mix(r,end,(i+1)/steps),'smooth');}}
 function chain(start,end,count,r0,r1,bend=0,spines=true){for(let i=0;i<count;i++){const t=i/(count-1),x=mix(start,end,t),z=Math.sin(t*Math.PI)*bend,y=.012,r=mix(r0,r1,t);pebble(x,y,z,r*1.2,r*.76,r*.82);if(spines&&i%2===0)bone([x,y,z],[x-.007,y+.009,z+r*1.5],r*.52,r*.16,'taper');}}
 // Vertebral column with distinct caudal, dorsal and cervical proportions.
 const tailN=sau?30:armor?17:24;chain(hip,tail,tailN,sau?.017:.024,.0025,v==='whip'?.07:-.045,true);
 chain(hip,shoulder,sau?12:14,.019,.020,neckBend,true);
 chain(shoulder,skull-.045,sau?(v==='neck'?21:15):8,sau?.014:.021,sau?.009:.020,neckBend*1.4,true);
 // Paired curved ribs, open intercostal spaces, pelvic & scapular blades.
 const ribs=sau?11:predator?10:12;
 for(let i=0;i<ribs;i++){const t=i/(ribs-1),x=mix(hip+.018,shoulder-.015,t),w=bodyWidth*Math.sin(Math.PI*(.16+.68*t));for(const s of [-1,1]){const z=s*w*(s===1?1:.86);curve([[x,.016,0],[x+.012,.026,z*.48],[x-.012,.014,z*.91],[x-.052,.005,z*.72]],sau?.0059:.0075,.0037,7);}}
 for(const s of [-1,1]){
  pebble(hip+.005,.025,s*.036,.055,.016,.025);
  bone([hip-.015,.022,s*.028],[hip-.063,.012,s*.09],.014,.010);
  bone([hip+.019,.015,s*.026],[hip+.050,.008,s*.087],.012,.008);
  bone([shoulder-.047,.014,s*.045],[shoulder+.037,.013,s*.065],.010,.019);
  const spread=predator?.20:sau?.12:armor?.12:.15, fore=predator?(v==='rex'||v==='bull'?.052:.085):sau?(v==='tall'?.19:.13):.12;
  const sx=s*(s===1?1:.87), jitter=(rand()-.5)*.03;
  const knee=[hip-.055,.012,sx*(spread*.55)],ankle=[hip+.018+jitter,.009,sx*spread],foot=[hip+.062,.007,sx*(spread+.025)];
  bone([hip,.025,s*.035],knee,predator?.022:.019,.017);bone(knee,ankle,.015,.012);bone([knee[0]+.012,knee[1],knee[2]], [ankle[0]+.012,ankle[1],ankle[2]],.006,.005);
  bone(ankle,foot,.010,.006);
  for(let k=-1;k<=1;k++)bone(foot,[foot[0]+.025-k*.004,.005,foot[2]+k*.012],.005,.0018,'taper');
  const elbow=[shoulder-.045,.011,sx*fore*.65],hand=[shoulder+.015,.008,sx*fore];
  bone([shoulder,.02,s*.035],elbow,predator?.009:.016,.010);bone(elbow,hand,.010,.006);bone([elbow[0]+.009,.009,elbow[2]],[hand[0]+.008,.007,hand[2]],.004,.003);
  const fingers=v==='rex'?2:3;for(let k=0;k<fingers;k++)bone(hand,[hand[0]+.018,.006,hand[2]+(k-(fingers-1)/2)*.012],.004,.0014,'taper');
 }
 // Open skull fenestrae with separate jaw, teeth and diagnostic crests / horns.
 const headSize=sau?.045:horn?.100:predator?(v==='fish'||v==='sail'?.125:v==='bull'?.075:.095):.075;
 const hx=skull-headSize*.35, nose=skull+headSize*.55, hw=horn?.052:predator?.037:.027;
 for(const s of [-1,1]){
  const z=s*hw;curve([[hx-.035,.012,0],[hx-.018,.045,z*.8],[hx+.018,.047,z],[nose,.026,z*.46],[nose,.012,z*.3]],horn?.014:.010,.007,9);
  curve([[hx-.035,.012,0],[hx-.008,.009,z],[hx+.028,.008,z*.8],[nose,.009,z*.28]],.010,.006,7);
  bone([hx-.015,.030,z*.82],[hx+.012,.011,z*.81],.009,.007);
  bone([hx+.019,.040,z*.82],[hx+.035,.012,z*.65],.007,.005);
  if(predator)for(let j=0;j<9;j++){const t=j/8,x=mix(hx+.013,nose-.003,t);bone([x,.025,z*(1-t*.55)],[x+.003,.012,z*(1-t*.55)],.0036,.0007,'taper');}
 }
 pebble(hx-.025,.022,0,.023,.019,hw*.78);
 if(horn){
  const fr=skull-.07;pebble(fr,.018,0,.060,.014,.105,.92);
  for(let i=0;i<11;i++){const a=(i/10-.5)*Math.PI*1.7;const x=fr-.04*Math.cos(a),z=.098*Math.sin(a);pebble(x,.026,z,.014,.008,.014);if(v==='spikes')bone([x,.023,z],[x-.06*Math.cos(a),.021,z+.047*Math.sin(a)],.014,.002,'taper');}
  if(v==='three')for(const s of [-1,1])bone([hx,.04,s*.025],[nose+.04,.055,s*.065],.024,.002,'taper');
  if(v==='boss')pebble(nose-.025,.038,0,.034,.026,.033);else bone([nose-.012,.025,0],[nose+.011,.066,0],.019,.001,'taper');
 }else if(duck){
  pebble(nose-.01,.018,0,.020,.012,.029);
  if(v==='crest')curve([[hx+.025,.04,0],[hx-.028,.056,0],[hx-.088,.029,0]],.018,.007,10);
  if(v==='helmet')pebble(hx-.018,.035,0,.055,.035,.018);
 }else if(predator){
  if(v==='bull'||v==='brow')for(const s of [-1,1])bone([hx,.042,s*.026],[hx-.018,.068,s*.045],.014,.002,'taper');
  if(v==='nose')bone([nose-.018,.034,0],[nose-.003,.059,0],.012,.001,'taper');
  if(v==='sail')for(let i=0;i<13;i++){const t=i/12,x=mix(hip-.055,shoulder,t);bone([x,.015,0],[x-.012,.019,.015+.14*Math.sin(Math.PI*t)],.009,.002,'taper');}
  if(v==='fish'||v==='sail')for(const s of [-1,1])bone([hx+.02,.029,s*.014],[nose+.026,.025,s*.011],.008,.005);
 }
 if(armor){
  if(v==='plates'){for(let i=0;i<13;i++){const t=i/12,x=mix(-.25,.28,t),z=(i%2?1:-1)*.045,w=.017+.026*Math.sin(Math.PI*t);const g=new THREE.IcosahedronGeometry(1,0);g.scale(w,.012,w*1.48);g.translate(x,.025,z);paint(g); }for(const s of [-1,1])for(let i=0;i<2;i++)bone([-.39-i*.035,.014,0],[-.39-i*.035,.012,s*.09],.014,.001,'taper');}
  else{for(let i=0;i<9;i++)for(let j=-2;j<=2;j++)pebble(mix(hip-.064,shoulder,i/8),.025,j*.041,.022,.013,.026,.88);pebble(-.47,.026,0,.047,.025,.053); }
 }
 // A few separated fragments and partial articulation, like an excavated quarry.
 for(let i=0;i<7;i++){const x=mix(hip,shoulder,rand()),z=(rand()>.5?1:-1)*(bodyWidth+.018+rand()*.033);bone([x,.008,z],[x+.008+rand()*.016,.007,z+.013*(rand()-.5)],.004,.0025);}
 const geometry=mergeGeometries(bones,false);for(const g of bones)g.dispose();geometry.computeBoundingBox();const box=geometry.boundingBox;const factor=d.length/(box.max.x-box.min.x);geometry.translate(-(box.min.x+box.max.x)/2,-box.min.y,0);geometry.scale(factor,factor,factor);geometry.computeBoundingBox();return geometry;
}
export function createFossilHunt(scene,ground,groundAt,camera,canvas,ui){
 const root=new THREE.Group();root.name='Fictional fossil excavation sites';root.visible=false;scene.add(root);
 const found=new Set(), objects=[], picker=new THREE.Raycaster();picker.firstHitOnly=true;
 const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.97,metalness:0,side:THREE.DoubleSide});
 const green=new THREE.MeshStandardMaterial({color:0x3de763,emissive:0x126525,emissiveIntensity:.52,roughness:.9,side:THREE.DoubleSide});
 const yellow=new THREE.MeshBasicMaterial({color:0xffff00,side:THREE.DoubleSide,toneMapped:false});
 let enabled=false, initialized=false, exposed=false, down=null;
 function appearance(){for(const obj of objects)obj.material=found.has(obj.userData.index)?green:exposed?yellow:mat;ui.expose.textContent=exposed?'Hide exposure':'Expose';ui.expose.setAttribute('aria-pressed',String(exposed));}
 function build(){
  // Fibonacci distribution, rotated so the first specimen is near the initial orbit center.
  const golden=Math.PI*(3-Math.sqrt(5)), y0=1-1/DINOSAURS.length;
  const rot=new THREE.Quaternion().setFromUnitVectors(vec(Math.sqrt(1-y0*y0),y0,0),vec(1,.16,0).normalize());
  DINOSAURS.forEach((d,i)=>{
   const y=1-2*(i+.5)/DINOSAURS.length,a=i*golden,r=Math.sqrt(1-y*y),dir=vec(r*Math.cos(a),y,r*Math.sin(a)).applyQuaternion(rot);
   const hit=groundAt(dir);if(!hit)throw Error('Missing fossil site terrain');
   const u=vec(0,1,0).cross(dir);if(u.lengthSq()<.0001)u.set(1,0,0).cross(dir);u.normalize().applyAxisAngle(dir,i*1.72+.4);const w=dir.clone().cross(u).normalize();
   const geo=skeleton(d,i),p=geo.attributes.position,cache=new Map(),step=.38;
   const sample=(x,z)=>{const key=x+','+z;if(!cache.has(key)){const v=hit.point.clone().addScaledVector(u,x*step).addScaledVector(w,z*step).normalize();const h=groundAt(v);cache.set(key,h?h.point:hit.point);}return cache.get(key);};
   const world=vec(),temp=vec(),local=vec();
   for(let j=0;j<p.count;j++){const x=p.getX(j)/step,z=p.getZ(j)/step,ix=Math.floor(x),iz=Math.floor(z),tx=x-ix,tz=z-iz;
    world.copy(sample(ix,iz)).lerp(sample(ix+1,iz),tx);temp.copy(sample(ix,iz+1)).lerp(sample(ix+1,iz+1),tx);world.lerp(temp,tz);
    // Follow the measured surface on a sub-metre grid; fossil relief protrudes just above rock.
    local.copy(world).normalize();world.addScaledVector(local,p.getY(j)*.72+.055);
    p.setXYZ(j,world.x,world.y,world.z);
   }
   p.needsUpdate=true;geo.computeVertexNormals();geo.computeBoundingBox();geo.computeBoundingSphere();
   const mesh=new THREE.Mesh(geo,mat);mesh.castShadow=true;mesh.receiveShadow=true;mesh.name=d.name;mesh.userData={...d,index:i};root.add(mesh);objects.push(mesh);
  });
  initialized=true;root.updateMatrixWorld(true);
 }
 function update(){ui.counter.textContent=found.size+'/20 found';ui.progress.value=found.size;ui.message.textContent=found.size===20?'Case closed. All twenty specimens catalogued.':'Orbit or drive around Bennu. Click exposed bones to catalogue them.';}
 function discover(mesh){const id=mesh.userData.index;if(found.has(id))return;found.add(id);mesh.material=green;ui.message.textContent=mesh.userData.name+' • '+mesh.userData.length+' m • catalogued';ui.counter.textContent=found.size+'/20 found';ui.progress.value=found.size;const li=document.createElement('li');li.textContent=mesh.userData.name+' — '+mesh.userData.length+' m';ui.list.append(li);if(found.size===20){ui.message.textContent='Case closed. All twenty specimens catalogued.';ui.finale.showModal();}}
 function pick(event){if(!enabled||!initialized)return;const rect=canvas.getBoundingClientRect();const ndc=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2);picker.setFromCamera(ndc,camera);
  const hit=picker.intersectObjects(objects,false)[0],terrain=picker.intersectObject(ground,false)[0];
  if(hit&&(!terrain||hit.distance<=terrain.distance+.11)){discover(hit.object);return;} // forgiving near-bone selection from orbit, only on the visible surface
  if(terrain){let closest=null,best=Infinity;for(const mesh of objects){const dist=terrain.point.distanceTo(mesh.geometry.boundingSphere.center);if(dist<Math.max(1.7,mesh.userData.length*.25)&&dist<best){closest=mesh;best=dist;}}if(closest)discover(closest);}
 }
 canvas.addEventListener('pointerdown',e=>{if(e.button===0)down={x:e.clientX,y:e.clientY,id:e.pointerId};});
 canvas.addEventListener('pointerup',e=>{if(down&&down.id===e.pointerId&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<6)pick(e);down=null;});
 canvas.addEventListener('pointercancel',()=>{down=null;});
 ui.toggle.addEventListener('change',()=>{enabled=ui.toggle.checked;if(enabled&&!initialized)build();root.visible=enabled;ui.panel.hidden=!enabled;appearance();update();});
 ui.expose.addEventListener('click',()=>{exposed=!exposed;appearance();});
 ui.reset.addEventListener('click',()=>{found.clear();appearance();ui.list.replaceChildren();update();if(ui.finale.open)ui.finale.close();});
 ui.close.addEventListener('click',()=>ui.finale.close());
 update();
 return {root,objects,found,pick,discover};
}
