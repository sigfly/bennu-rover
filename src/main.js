import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {MeshBVH, acceleratedRaycast} from 'three-mesh-bvh';
import {geoToVector, vectorToGeo, clamp} from './terrain.js';
import {createFossilHunt} from './fossils.js';
import {createLandmarkHunt} from './landmarks.js';
import {createSunShadows} from './shadows.js';

const $=id=>document.getElementById(id), V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const pause=()=>new Promise(r=>setTimeout(r,40));
const stage=async text=>{$('loading').textContent=text;await pause();};
function decode(id){const node=$(id);const chunks=node.textContent.trim().split(/\s+/);const size=chunks.reduce((n,c)=>n+c.length,0)*3/4;const out=new Uint8Array(Math.ceil(size));let offset=0;for(const chunk of chunks){const bytes=atob(chunk);for(let i=0;i<bytes.length;i++)out[offset++]=bytes.charCodeAt(i);}node.remove();return out.buffer.slice(0,offset);}
async function textureFrom(bytes,renderer){const blob=new Blob([bytes],{type:'image/jpeg'}), url=URL.createObjectURL(blob);try{const image=await new Promise((resolve,reject)=>{const el=new Image();el.onload=()=>resolve(el);el.onerror=reject;el.src=url;});const max=renderer.capabilities.maxTextureSize;const width=Math.min(max,image.width);let source=image;if(width<image.width){source=document.createElement('canvas');source.width=width;source.height=width/2;source.getContext('2d').drawImage(image,0,0,width,width/2);}const map=new THREE.Texture(source);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=THREE.RepeatWrapping;map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());map.needsUpdate=true;return {map,width};}finally{URL.revokeObjectURL(url);}}

async function start(){
 const renderer=new THREE.WebGLRenderer({antialias:true, powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(2,devicePixelRatio));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(0x05080d);renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','Bennu terrain and rover');renderer.domElement.addEventListener('pointerdown',()=>renderer.domElement.focus());document.body.prepend(renderer.domElement);
 const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(66,innerWidth/innerHeight,.12,5000);const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enabled=false;controls.minDistance=320;controls.maxDistance=1800;
 await stage('Decoding NASA OLA terrain geometry…');const modelBytes=decode('bennu-model');const gltf=await new GLTFLoader().parseAsync(modelBytes,'');gltf.scene.updateMatrixWorld(true);
 const meshes=[];gltf.scene.traverse(m=>{if(m.isMesh)meshes.push(m);});if(meshes.length!==1)throw Error('Unexpected NASA mesh structure');const original=meshes[0];const geom=original.geometry;geom.applyMatrix4(original.matrixWorld);/* SVS v21 is Z-up without a node transform; v20 supplies the Z-up to Y-up rotation in its glTF node. */if(window.BENNU_CONFIG.edition==='ultra')geom.rotateX(-Math.PI/2);geom.computeBoundingBox();const box=geom.boundingBox;const span=box.getSize(V());if(span.length()<2)geom.scale(1000,1000,1000);else if(span.length()>1500)throw Error('Unexpected NASA terrain scale');geom.computeBoundingSphere();geom.computeVertexNormals();
 await stage('Indexing millions of measured triangles for terrain collision…');geom.boundsTree=new MeshBVH(geom,{maxLeafSize:12});
 await stage('Decoding the OSIRIS-REx photographic mosaic…');const {map,width}=await textureFrom(decode('bennu-texture'),renderer);
 const sunlight=V(1,.7,.4).normalize();
 // Preserve the original calibrated image/slope look and sample the renderer's native directional shadow map.
 const terrainMaterial=new THREE.ShaderMaterial({
  side:THREE.DoubleSide,lights:true,
  uniforms:{...THREE.UniformsUtils.clone(THREE.UniformsLib.lights),photo:{value:map},showPhoto:{value:1},offset:{value:0},sun:{value:sunlight}},
  vertexShader:`
   #include <common>
   #include <shadowmap_pars_vertex>
   varying vec3 p; varying vec3 n;
   void main(){
    p=position; n=normal;
    vec3 transformedNormal=normalMatrix*normal;
    vec4 worldPosition=modelMatrix*vec4(position,1.0);
    #include <shadowmap_vertex>
    gl_Position=projectionMatrix*viewMatrix*worldPosition;
   }`,
  fragmentShader:`
   #include <common>
   #include <packing>
   uniform bool receiveShadow;
   #include <shadowmap_pars_fragment>
   #include <shadowmask_pars_fragment>
   varying vec3 p; varying vec3 n;
   uniform sampler2D photo; uniform float showPhoto; uniform float offset; uniform vec3 sun;
   void main(){
    vec3 d=normalize(p);
    float u=fract(atan(-d.z,d.x)/6.28318530718+offset);
    float v=asin(clamp(d.y,-1.0,1.0))/3.14159265359+0.5;
    vec3 tex=texture2D(photo,vec2(u,v)).rgb;
    vec3 base=mix(vec3(0.28,0.29,0.30),max(tex*1.7,vec3(.035)),showPhoto);
    float direct=max(dot(normalize(n),sun),0.0);
    float light=.22+.78*direct*getShadowMask();
    gl_FragColor=vec4(base*light,1.0);
    #include <colorspace_fragment>
   }`
 });
 const ground=new THREE.Mesh(geom,terrainMaterial);ground.raycast=acceleratedRaycast;ground.castShadow=true;ground.receiveShadow=true;scene.add(ground);ground.updateMatrixWorld(true);
 const dirLight=new THREE.DirectionalLight(0xfff0dc,3.5);const ambient=new THREE.HemisphereLight(0xb9d5ff,0x34312d,1.3);scene.add(dirLight,ambient);
 const quality=$('shadowQuality');if(matchMedia('(pointer:coarse)').matches||(navigator.deviceMemory&&navigator.deviceMemory<4))quality.value='standard';
 const sunShadows=createSunShadows(renderer,dirLight,scene,quality,$('shadowStats'),terrainMaterial);
 // A fixed star sphere provides orientation without pretending to map the actual sky.
 const points=[];let seed=431;const rand=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);for(let i=0;i<2400;i++){const y=rand()*2-1,a=rand()*Math.PI*2,r=Math.sqrt(1-y*y);points.push(1900*r*Math.cos(a),1900*y,1900*r*Math.sin(a));}const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));scene.add(new THREE.Points(starGeo,new THREE.PointsMaterial({color:0xa9bdd8,size:1.0,sizeAttenuation:false,transparent:true,opacity:.65})));
 const rover=new THREE.Group();scene.add(rover);const frame=new THREE.MeshStandardMaterial({color:0xd3b88d,metalness:.55,roughness:.45}),dark=new THREE.MeshStandardMaterial({color:0x16191d,roughness:.95}),silver=new THREE.MeshStandardMaterial({color:0xa2a9b1,metalness:.7,roughness:.45}),blue=new THREE.MeshStandardMaterial({color:0x162e43,metalness:.6,roughness:.3});
 function boxMesh(w,h,d,x,y,z,mat){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);rover.add(m);return m;}
 boxMesh(1.24,.38,1.65,0,.69,0,frame);boxMesh(1.02,.16,1.28,0,.95,.02,silver);boxMesh(.9,.07,.88,0,1.06,-.15,blue);boxMesh(.12,.7,.12,0,1.29,.45,silver);boxMesh(.48,.23,.28,0,1.7,.45,frame);boxMesh(.22,.15,.12,0,1.7,.63,dark);const wheels=[];
 for(const x of [-.77,.77])for(const z of [-.65,0,.65]){boxMesh(.36,.11,.12,x*.82,.58,z,silver);const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.32,.32,.24,24),dark);wheel.rotation.z=Math.PI/2;wheel.position.set(x,.32,z);rover.add(wheel);wheels.push(wheel);for(let i=0;i<12;i++){const a=i*Math.PI/6;const tread=new THREE.Mesh(new THREE.BoxGeometry(.25,.06,.06),silver);tread.position.set(x,.32+.32*Math.cos(a),z+.32*Math.sin(a));tread.rotation.x=a;rover.add(tread);}}
 rover.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
 const roverMaterials=[frame,dark,silver,blue];
 const ray=new THREE.Raycaster();ray.firstHitOnly=true;const radial=V(1,0,0),heading=V(0,0,-1);let surface=V(),normal=V(),velocity=0,distance=0,slope=0,mode='orbit',status='Ready · measured terrain',photo=true;
 function groundAt(direction){ray.set(direction.clone().multiplyScalar(700),direction.clone().negate());const h=ray.intersectObject(ground,false)[0];if(!h)return null;const n=h.face.normal.clone().normalize();if(n.dot(direction)<0)n.negate();return {point:h.point,normal:n};}
 function teleport(lat,lon){radial.fromArray(geoToVector(clamp(lat,-90,90),clamp(lon,-180,180))).normalize();const hit=groundAt(radial);if(!hit)throw Error('No terrain at coordinate');surface.copy(hit.point);normal.copy(hit.normal);heading.set(0,1,0).cross(radial);if(heading.lengthSq()<.01)heading.set(1,0,0).cross(radial);heading.normalize();velocity=0;distance=0;status='Rover repositioned';}
 function setMode(value){mode=value;controls.enabled=mode==='orbit';/* Hide cockpit geometry from the colour pass, but retain its real shadow. */for(const mat of roverMaterials){mat.colorWrite=mode!=='cockpit';mat.depthWrite=mode!=='cockpit';}document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===value));if(mode==='orbit'){camera.position.copy(radial).multiplyScalar(620).add(V(0,110,0));controls.target.set(0,0,0);camera.up.set(0,1,0);controls.update();}}
 const keys=new Set();const normalizeKey=k=>({ArrowUp:'w',ArrowDown:'s',ArrowLeft:'a',ArrowRight:'d'}[k]??k.toLowerCase());window.addEventListener('keydown',e=>{if(e.target.matches('input,select,button'))return;const k=normalizeKey(e.key);if(['w','a','s','d',' '].includes(k)){e.preventDefault();keys.add(k);}if(k==='c'&&!e.repeat)setMode(({chase:'cockpit',cockpit:'orbit',orbit:'chase'})[mode]);});window.addEventListener('keyup',e=>keys.delete(normalizeKey(e.key)));window.addEventListener('blur',()=>keys.clear());
 document.querySelectorAll('[data-key]').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(b.dataset.key);});for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>keys.delete(b.dataset.key));});
 document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));$('go').onclick=()=>{const a=Number($('targetLat').value),b=Number($('targetLon').value);if(Number.isFinite(a)&&Number.isFinite(b))teleport(a,b);};$('reset').onclick=()=>teleport(0,0);$('nightingale').onclick=()=>teleport(56,42.2);$('osprey').onclick=()=>teleport(11.3,88.8);$('texture').onclick=()=>{photo=!photo;terrainMaterial.uniforms.showPhoto.value=Number(photo);$('texture').textContent=`Photo: ${photo?'on':'off'}`;};$('offset').oninput=e=>terrainMaterial.uniforms.offset.value=Number(e.target.value)/360;$('toggle').onclick=()=>{$('panel').hidden=!$('panel').hidden;};
 $('data').textContent=`${window.BENNU_CONFIG.edition.toUpperCase()} · ${window.BENNU_CONFIG.triangles.toLocaleString()} measured-model triangles · ${width.toLocaleString()} × ${width/2} photographic pixels · offline. NASA / University of Arizona / CSA / York University / MDA.`;
 const fossilToggle=$('fossilToggle'),landmarkToggle=$('landmarkToggle');
 // Expeditions are exclusive, but retain independent discovery progress.
 fossilToggle.addEventListener('change',()=>{if(fossilToggle.checked&&landmarkToggle.checked){landmarkToggle.checked=false;landmarkToggle.dispatchEvent(new Event('change'));}});
 landmarkToggle.addEventListener('change',()=>{if(landmarkToggle.checked&&fossilToggle.checked){fossilToggle.checked=false;fossilToggle.dispatchEvent(new Event('change'));}});
 const fossilHunt=createFossilHunt(scene,ground,groundAt,camera,renderer.domElement,{toggle:$('fossilToggle'),panel:$('fossilPanel'),counter:$('fossilCounter'),progress:$('fossilProgress'),message:$('fossilMessage'),list:$('fossilList'),reset:$('fossilReset'),expose:$('fossilExpose'),finale:$('fossilFinale'),close:$('fossilClose')});
 const hemisphere=scene.children.find(o=>o.isHemisphereLight);
 const landmarkHunt=createLandmarkHunt(scene,ground,groundAt,camera,renderer.domElement,{toggle:landmarkToggle,panel:$('landmarkPanel'),counter:$('landmarkCounter'),progress:$('landmarkProgress'),message:$('landmarkMessage'),list:$('landmarkList'),reset:$('landmarkReset'),expose:$('landmarkExpose'),finale:$('landmarkFinale'),close:$('landmarkClose')},decode,enabled=>{
  dirLight.color.setHex(enabled?0xffffff:0xfff0dc);hemisphere.color.setHex(enabled?0xffffff:0xb9d5ff);hemisphere.groundColor.setHex(enabled?0x373737:0x34312d);
  if(enabled&&mode==='orbit'){camera.position.setLength(Math.max(camera.position.length(),980));controls.update();}
 });
 teleport(0,0);setMode('orbit');$('loader').remove();window.addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();});
 // Avoid drawing millions of unchanged triangles continuously while parked.
 let renderRequested=true,lastWorld='',lastCamera=V(1e8,0,0),lastRover=V(1e8,0,0),lastCameraRot=new THREE.Quaternion(),lastRoverRot=new THREE.Quaternion();
 const requestRender=()=>{renderRequested=true;};
 for(const event of ['input','change','click'])document.addEventListener(event,requestRender);
 renderer.domElement.addEventListener('pointerup',requestRender);window.addEventListener('resize',requestRender);
 let prev=performance.now();const basis=new THREE.Matrix4(),right=V(),forward=V(),up=V();
 function tick(now){const dt=Math.min(.045,(now-prev)/1000);prev=now;const steer=Number(keys.has('a'))-Number(keys.has('d'));heading.applyAxisAngle(radial,steer*1.05*dt).addScaledVector(radial,-heading.dot(radial)).normalize();const throttle=Number(keys.has('w'))-Number(keys.has('s'));const limit=Number($('speedlimit').value);const target=keys.has(' ')?0:throttle*limit;velocity+=(target-velocity)*(1-Math.exp(-dt*(keys.has(' ')?14:4)));
  if(Math.abs(velocity)>.005){const candidate=radial.clone().addScaledVector(heading,velocity*dt/surface.length()).normalize();const hit=groundAt(candidate);if(hit){const travel=hit.point.distanceTo(surface);const climb=hit.normal.angleTo(candidate)*180/Math.PI;if(travel<Math.max(.35,Math.abs(velocity*dt)*4)&&climb<76&&(!landmarkHunt.obstructed(hit.point)||landmarkHunt.obstructed(surface))){surface.copy(hit.point);normal.lerp(hit.normal,.3).normalize();radial.copy(candidate);distance+=travel;status='Driving · surface adhesion';}else{velocity=0;status='Obstacle / steep slope · turn or reverse';}}else{velocity=0;status='Terrain gap · choose another direction';}}else if(!throttle)status='Stationary · measured terrain';
  up.copy(normal);forward.copy(heading).addScaledVector(up,-heading.dot(up));if(forward.lengthSq()<.00001)forward.copy(heading);forward.normalize();right.crossVectors(up,forward).normalize();forward.crossVectors(right,up).normalize();basis.makeBasis(right,up,forward);rover.quaternion.setFromRotationMatrix(basis);rover.position.copy(surface).addScaledVector(up,.035);slope=normal.angleTo(radial)*180/Math.PI;
  const angle=Number($('lights').value)*Math.PI/180,elevation=Number($('sunAltitude').value)*Math.PI/180;sunlight.set(Math.cos(angle)*Math.cos(elevation),Math.sin(elevation),Math.sin(angle)*Math.cos(elevation)).normalize();
  ambient.intensity=quality.value==='off'?1.3:.65;
  sunShadows.update({now,mode,sun:sunlight,rover,landmarks:landmarkHunt.root.visible,fossils:fossilHunt.root.visible,edition:window.BENNU_CONFIG.edition});
  if(mode==='orbit'){controls.update();}else{const eye=surface.clone().addScaledVector(up,mode==='cockpit'?1.6:3.1).addScaledVector(forward,mode==='cockpit'?.38:-5.4);const look=surface.clone().addScaledVector(up,mode==='cockpit'?1.3:.65).addScaledVector(forward,mode==='cockpit'?12:2);camera.position.copy(eye);camera.up.copy(up);camera.lookAt(look);}
  const g=vectorToGeo(radial);$('lat').textContent=g.lat.toFixed(4)+'°';$('lon').textContent=g.lon.toFixed(4)+'°';$('speed').textContent=Math.abs(velocity).toFixed(2)+' m/s';$('distance').textContent=distance.toFixed(1)+' m';$('radius').textContent=surface.length().toFixed(1)+' m';$('slope').textContent=slope.toFixed(1)+'°';$('status').textContent=status;const world=String(landmarkHunt.root.visible)+String(fossilHunt.root.visible);
  if(renderRequested||world!==lastWorld||(renderer.shadowMap.enabled&&renderer.shadowMap.needsUpdate)||camera.position.distanceToSquared(lastCamera)>1e-9||camera.quaternion.angleTo(lastCameraRot)>1e-6||rover.position.distanceToSquared(lastRover)>1e-9||rover.quaternion.angleTo(lastRoverRot)>1e-6){
   renderer.render(scene,camera);renderRequested=false;lastWorld=world;lastCamera.copy(camera.position);lastCameraRot.copy(camera.quaternion);lastRover.copy(rover.position);lastRoverRot.copy(rover.quaternion);
  }
  requestAnimationFrame(tick);
 }
 requestAnimationFrame(tick);window.BENNU_READY=true;
}
start().catch(error=>{console.error(error);$('loading').textContent=`Unable to start: ${error.message}. Try a desktop browser with WebGL 2 and sufficient graphics memory.`;});
