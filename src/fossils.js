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
 const v=d.variant, hip=sau?(v==='neck'?-.19:v==='whip'?-.12:-.15):-.03, shoulder=sau?(v==='neck'?.015:v==='whip'?.12:.14):.23, skull=sau?(v==='neck'?.48:v==='whip'?.42:.46):.41;
 const tail=sau?-.50:-.50, neckBend=rand()*.055-.028, bodyWidth=sau?.092:horn?.15:armor?.13:duck?.105:.09;
 const tone=new THREE.Color();const base=new THREE.Color('#d2c5ac');
 function paint(g,shade=1){const p=g.attributes.position,c=new Float32Array(p.count*3);const tint=.90+rand()*.20;for(let i=0;i<p.count;i++){const f=tint*shade*(.90+rand()*.20);tone.copy(base).multiplyScalar(f);c.set([tone.r,tone.g,tone.b],i*3);}g.setAttribute('color',new THREE.BufferAttribute(c,3));g.deleteAttribute('uv');const out=g.index?g.toNonIndexed():g;bones.push(out);if(out!==g)g.dispose();}
 // Sculpted bone shafts: flared epiphyses, irregular cross sections and tapered bony processes.
 function bone(a,b,r,tip=r,shape='joint'){
  a=vec(...a);b=vec(...b);const axis=b.clone().sub(a),length=axis.length();if(length<1e-6)return;
  const q=new THREE.Quaternion().setFromUnitVectors(vec(0,1,0),axis.normalize());
  const pts=[];const rings=7,segments=9,positions=[],indices=[];
  for(let j=0;j<=rings;j++){const t=j/rings;let w=mix(r,tip,t);if(shape==='joint')w*=.58+.63*Math.pow(Math.abs(2*t-1),2);else if(shape==='taper')w*=1-.82*t;else w*=.83+.17*Math.sin(t*Math.PI);
   if(j===0||j===rings)w*=.58;
   for(let k=0;k<segments;k++){const angle=k/segments*Math.PI*2,rr=w*(.84+.32*rand());const p=vec(Math.cos(angle)*rr,t*length,Math.sin(angle)*rr*.78).applyQuaternion(q).add(a);positions.push(p.x,p.y,p.z);}
  }
  for(let j=0;j<rings;j++)for(let k=0;k<segments;k++){let x=j*segments+k,y=j*segments+(k+1)%segments;indices.push(x,x+segments,y,y,x+segments,y+segments);}
  for(let k=1;k<segments-1;k++){indices.push(0,k,k+1);const o=rings*segments;indices.push(o,o+k+1,o+k);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();paint(g);
 }
 function pebble(x,y,z,a,b,c,shade=1){const g=new THREE.IcosahedronGeometry(1,1);const p=g.attributes.position;for(let i=0;i<p.count;i++){const f=1+.11*Math.sin(p.getX(i)*13+p.getY(i)*17+p.getZ(i)*19+index);p.setXYZ(i,p.getX(i)*f,p.getY(i)*f,p.getZ(i)*f);}g.scale(a,b,c);g.translate(x,y,z);g.computeVertexNormals();paint(g,shade);}
 function curve(points,r,end=r,steps=12){
  const c=new THREE.CatmullRomCurve3(points.map(p=>vec(...p))),frames=c.computeFrenetFrames(steps,false),positions=[],indices=[],segments=9;
  for(let i=0;i<=steps;i++){const t=i/steps,p=c.getPointAt(t),width=mix(r,end,t)*(i===0||i===steps?.72:1);for(let j=0;j<segments;j++){const a=j*2*Math.PI/segments,q=p.clone().addScaledVector(frames.normals[i],Math.cos(a)*width).addScaledVector(frames.binormals[i],Math.sin(a)*width*.84);positions.push(q.x,q.y,q.z);}}
  for(let i=0;i<steps;i++)for(let j=0;j<segments;j++){const a=i*segments+j,b=i*segments+(j+1)%segments;indices.push(a,b,a+segments,b,b+segments,a+segments);}
  for(let j=1;j<segments-1;j++){indices.push(0,j+1,j);const k=steps*segments;indices.push(k,k+j,k+j+1);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();paint(g);
 }
 function chain(start,end,count,r0,r1,bend=0,spines=true){for(let i=0;i<count;i++){const t=i/(count-1),x=mix(start,end,t),z=Math.sin(t*Math.PI)*bend,y=.012,r=mix(r0,r1,t);pebble(x,y,z,r*1.2,r*.76,r*.82);if(spines&&i%2===0)bone([x,y,z],[x-.007,y+.009,z+r*1.5],r*.52,r*.16,'taper');}}
 // Vertebral column with distinct caudal, dorsal and cervical proportions.
 const tailN=sau?(v==='whip'?44:32):armor?19:28;chain(hip,tail,tailN,sau?.017:.024,.0025,v==='whip'?.07:-.045,true);
 chain(hip,shoulder,sau?12:14,.019,.020,neckBend,true);
 chain(shoulder,skull-(sau?.027:predator?.07:.058),sau?(v==='neck'?23:15):8,sau?.014:.021,sau?.009:.020,neckBend*1.4,true);
 // Paired curved ribs, open intercostal spaces, pelvic & scapular blades.
 const ribs=sau?12:predator?12:13;
 for(let i=0;i<ribs;i++){const t=i/(ribs-1),x=mix(hip+.018,shoulder-.015,t),w=bodyWidth*Math.sin(Math.PI*(.16+.68*t));for(const s of [-1,1]){const z=s*w*(s===1?1:.86);curve([[x,.016,0],[x+.012,.026,z*.48],[x-.012,.014,z*.91],[x-.052,.005,z*.72]],sau?.0059:.0075,.0037,7);}}
 for(const s of [-1,1]){
  pebble(hip+.005,.025,s*.036,.055,.016,.025);
  bone([hip-.015,.022,s*.028],[hip-.063,.012,s*.09],.014,.010);
  bone([hip+.019,.015,s*.026],[hip+.050,.008,s*.087],.012,.008);
  bone([shoulder-.047,.014,s*.045],[shoulder+.037,.013,s*.065],.010,.019);
  const spread=predator?(v==='sail'?.12:.20):sau?.14:armor?.12:.15, fore=predator?(v==='rex'||v==='bull'?.042:.085):sau?(v==='tall'?.21:.15):.12;
  const sx=s*(s===1?1:.87), jitter=(rand()-.5)*.03;
  const knee=[hip-.055,.012,sx*(spread*.55)],ankle=[hip+.018+jitter,.009,sx*spread],foot=[hip+.062,.007,sx*(spread+.025)];
  bone([hip,.025,s*.035],knee,predator?.022:.019,.017);bone(knee,ankle,.015,.012);bone([knee[0]+.012,knee[1],knee[2]], [ankle[0]+.012,ankle[1],ankle[2]],.006,.005);
  bone(ankle,foot,.010,.006);
  for(let k=-1;k<=1;k++)bone(foot,[foot[0]+.025-k*.004,.005,foot[2]+k*.012],.005,.0018,'taper');
  const elbow=[shoulder-.045,.011,sx*fore*.65],hand=[shoulder+.015,.008,sx*fore];
  bone([shoulder,.02,s*.035],elbow,predator?.009:.016,.010);bone(elbow,hand,.010,.006);bone([elbow[0]+.009,.009,elbow[2]],[hand[0]+.008,.007,hand[2]],.004,.003);
  const fingers=v==='rex'?2:v==='bull'?4:sau?5:3;for(let k=0;k<fingers;k++)bone(hand,[hand[0]+.018,.006,hand[2]+(k-(fingers-1)/2)*.012],.004,.0014,'taper');
 }
 // Lateral cranial profiles, laid on their sides as in an articulated fossil bed.
 // A continuous cranium, real through-holes, robust maxilla and dentary replace
 // the old paired rod outlines. Profiles are normalized to head length/depth.
 const profiles={
  rex:{l:.146,h:.083,outline:[[0,.30],[.05,.68],[.24,.94],[.48,.87],[.70,.78],[.93,.69],[1,.45],[.94,.22],[.55,.20],[.26,.14],[.08,.12]],holes:[[.23,.62,.095,.17],[.54,.57,.16,.13],[.83,.54,.072,.07]]},
  giant:{l:.158,h:.073,outline:[[0,.23],[.08,.73],[.28,.91],[.57,.79],[.86,.64],[1,.43],[.94,.19],[.49,.16],[.17,.11]],holes:[[.21,.61,.10,.15],[.49,.56,.18,.16],[.83,.47,.08,.07]]},
  sail:{l:.164,h:.046,outline:[[0,.22],[.10,.82],[.28,.88],[.39,.55],[.80,.40],[.93,.48],[1,.31],[.94,.16],[.65,.19],[.29,.10]],holes:[[.18,.6,.08,.15],[.40,.40,.11,.09],[.80,.32,.07,.05]]},
  fish:{l:.149,h:.051,outline:[[0,.22],[.08,.76],[.24,.91],[.40,.59],[.77,.43],[.94,.53],[1,.32],[.93,.16],[.57,.18],[.20,.11]],holes:[[.18,.62,.09,.16],[.43,.42,.12,.105],[.82,.36,.06,.055]]},
  bull:{l:.103,h:.074,outline:[[0,.23],[.07,.69],[.24,.92],[.48,.93],[.78,.69],[1,.50],[.95,.21],[.53,.16],[.18,.12]],holes:[[.23,.66,.105,.17],[.58,.56,.13,.15]]},
  brow:{l:.129,h:.065,outline:[[0,.21],[.07,.77],[.27,.94],[.53,.79],[.90,.67],[1,.41],[.93,.18],[.38,.15],[.16,.10]],holes:[[.23,.64,.095,.16],[.55,.54,.15,.14],[.85,.46,.062,.07]]},
  nose:{l:.123,h:.063,outline:[[0,.20],[.08,.74],[.31,.91],[.63,.68],[.91,.72],[1,.43],[.94,.18],[.45,.15],[.17,.10]],holes:[[.23,.59,.095,.14],[.56,.48,.15,.12]]},
  sau:{l:.047,h:.026,outline:[[0,.24],[.08,.70],[.30,.91],[.49,.71],[.93,.45],[1,.23],[.88,.12],[.45,.15],[.17,.13]],holes:[[.22,.58,.10,.17],[.54,.44,.14,.10]]},
  box:{l:.058,h:.043,outline:[[0,.21],[.06,.72],[.27,.95],[.58,.94],[.89,.72],[1,.39],[.94,.20],[.52,.16],[.13,.12]],holes:[[.23,.62,.10,.17],[.59,.61,.16,.17]]},
  horn:{l:.127,h:.067,outline:[[0,.22],[.05,.73],[.26,.90],[.50,.84],[.77,.64],[.97,.39],[1,.22],[.84,.13],[.43,.16],[.16,.12]],holes:[[.26,.61,.09,.14],[.66,.45,.115,.11]]},
  duck:{l:.109,h:.054,outline:[[0,.20],[.06,.76],[.28,.9],[.49,.75],[.73,.48],[.97,.42],[1,.23],[.86,.13],[.48,.15],[.14,.10]],holes:[[.23,.61,.10,.15],[.55,.45,.115,.11]]},
  armor:{l:.084,h:.043,outline:[[0,.24],[.06,.71],[.28,.91],[.53,.83],[.82,.57],[1,.33],[.92,.14],[.35,.16],[.12,.12]],holes:[[.26,.6,.11,.14],[.65,.48,.12,.10]]}
 };
 const profile=predator?profiles[v]||profiles.brow:sau?(v==='box'?profiles.box:profiles.sau):horn?profiles.horn:duck?profiles.duck:profiles.armor;
 const {l,h}=profile,back=skull-l*.58,side=neckBend*.65;
 function skullPoint(x,z,y=.026){return [back+x*l,y,side+(z-.42)*h];}
 function plate(outline,holes=[],depth=.014,shade=1){
  const shape=new THREE.Shape();outline.forEach(([x,z],i)=>{const px=back+x*l,pz=side+(z-.42)*h;if(i)shape.lineTo(px,pz);else shape.moveTo(px,pz);});shape.closePath();
  for(const [x,z,rx,rz] of holes){const p=new THREE.Path();p.absellipse(back+x*l,side+(z-.42)*h,rx*l,rz*h,0,Math.PI*2,true);shape.holes.push(p);}
  const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:Math.min(.0016,h*.04),bevelThickness:.0018,bevelSegments:2,steps:1,curveSegments:16});
  // Map the drawing into the excavation plane, so eye sockets remain visible from orbit.
  g.rotateX(Math.PI/2);g.translate(0,.022+depth,0);g.computeVertexNormals();paint(g,shade);
 }
 plate(profile.outline,profile.holes,Math.max(.006,h*.24),1.04);
 // Robust lower jaw, recognizable even when the small teeth are below a pixel.
 plate([[.05,.12],[.16,-.10],[.45,-.15],[.83,-.08],[.98,.10],[.91,.13],[.48,.03],[.23,.04]],[],Math.max(.005,h*.15),.97);
 if(predator||sau){const teeth=predator?(v==='fish'||v==='sail'?14:11):8;for(let i=0;i<teeth;i++){
  const t=i/(teeth-1),x=mix(.35,.94,t),z=.20,sz=predator?(v==='fish'||v==='sail'?.12:.17):.10;
  plate([[x-.016,z],[x+.018,z],[x+.009,z-sz*(.65+.35*Math.sin(Math.PI*t))]],[],Math.max(.0025,h*.06),1.1);
 }}
 if(horn){
  // Expanded cranial shield and distinct brow/nasal horn configurations.
  plate([[-.68,.40],[-.51,1.05],[-.23,1.48],[.12,1.42],[.35,1.0],[.27,.50],[.10,.23],[-.40,.15]],v==='three'?[]:[[-.28,.91,.18,.22]],.018,.93);
  if(v==='three')for(const z of [.53,.91])plate([[.25,z],[.42,z+.05],[.83,z+.47],[.40,z+.20]],[],.009,1.1);
  if(v==='spikes')for(let i=0;i<5;i++){const t=i/4,x=mix(-.58,.06,t),z=1.15+.24*Math.sin(t*Math.PI);plate([[x-.065,z-.10],[x+.075,z-.08],[x-.28*(1-t),z+.48]],[],.008);}
  if(v==='boss')pebble(back+.78*l,.046,side+.17*h,.024,.022,.023);else plate([[.76,.54],[.91,.43],[.92,.93],[.80,.72]],[],.009);
 }else if(duck){
  if(v==='crest')plate([[.25,.78],[.12,1.14],[-.20,1.52],[-.53,1.58],[-.31,1.25],[.03,.86]],[],.009);
  if(v==='helmet')plate([[.10,.69],[.14,1.18],[.36,1.47],[.55,1.25],[.57,.72]],[[.34,1.10,.085,.12]],.010);
 }else if(predator){
  if(v==='bull'||v==='brow')plate([[.19,.8],[.25,1.26],[.41,.97],[.45,.79]],[],.009);
  if(v==='nose')plate([[.77,.61],[.83,1.05],[.92,.69]],[],.007);
  if(v==='sail')for(let i=0;i<13;i++){const t=i/12,x=mix(hip-.055,shoulder,t);bone([x,.015,0],[x-.012,.019,.015+.14*Math.sin(Math.PI*t)],.009,.002,'taper');}
 }
 if(armor){
  if(v==='plates'){
   // Alternating shed dermal plates with irregular polygonal edges, laid beside the spine.
   for(let i=0;i<13;i++){const t=i/12,x=mix(-.25,.28,t),s=i%2?1:-1,z=s*.048,w=.015+.024*Math.sin(Math.PI*t),height=w*(1.25+rand()*.35);
    const shape=new THREE.Shape();shape.moveTo(x-w,z);shape.lineTo(x-w*.85,z+s*height*.65);shape.lineTo(x-w*.22,z+s*height);shape.lineTo(x+w*.6,z+s*height*.82);shape.lineTo(x+w,z+s*height*.25);shape.lineTo(x+w*.55,z);shape.closePath();
    const g=new THREE.ExtrudeGeometry(shape,{depth:.008,bevelEnabled:true,bevelSize:.0016,bevelThickness:.0016,bevelSegments:1,steps:1});g.rotateX(Math.PI/2);g.translate(0,.032,0);paint(g);
   }
   for(const s of [-1,1])for(let i=0;i<2;i++)bone([-.39-i*.035,.014,0],[-.39-i*.035-.027,.012,s*.082],.014,.001,'taper');
  }else{
   // Broken, staggered osteoderms, retaining exposed vertebrae and ribs rather than a solid square grid.
   for(let i=0;i<9;i++)for(let j=-2;j<=2;j++){if((i+j)%4===0||rand()<.14)continue;const x=mix(hip-.064,shoulder,i/8)+(rand()-.5)*.013,z=j*.043+(i%2?.012:-.012);pebble(x,.024,z,.013+rand()*.006,.009+rand()*.004,.015+rand()*.006,.89);}
   pebble(-.47,.026,-.021,.037,.023,.035);pebble(-.47,.026,.021,.037,.023,.035);
  }
 }
 // A few separated fragments and partial articulation, like an excavated quarry.
 for(let i=0;i<7;i++){const x=mix(hip,shoulder,rand()),z=(rand()>.5?1:-1)*(bodyWidth+.018+rand()*.033);bone([x,.008,z],[x+.008+rand()*.016,.007,z+.013*(rand()-.5)],.004,.0025);}
 const geometry=mergeGeometries(bones,false);for(const g of bones)g.dispose();geometry.computeBoundingBox();const box=geometry.boundingBox;const factor=d.length/(box.max.x-box.min.x);geometry.translate(-(box.min.x+box.max.x)/2,-box.min.y,0);geometry.scale(factor,factor,factor);geometry.computeBoundingBox();return geometry;
}
export function createFossilHunt(scene,ground,groundAt,camera,canvas,ui){
 const root=new THREE.Group();root.name='Fictional fossil excavation sites';root.visible=false;scene.add(root);
 const found=new Set(), objects=[], picker=new THREE.Raycaster();picker.firstHitOnly=true;
 const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.96,metalness:0,side:THREE.DoubleSide,emissive:0xb8ae95,emissiveIntensity:.20});
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
    local.copy(world).normalize();world.addScaledVector(local,p.getY(j)*.78+.10);
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
