import * as THREE from 'three';

export const FACE_COUNT=11,FACE_SIZE=20,TILE=384,COLS=4,ROWS=3;
const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
export function faceDirections(){
 const y0=1-1/FACE_COUNT,r0=Math.sqrt(1-y0*y0),rotation=new THREE.Quaternion().setFromUnitVectors(v(r0,y0,0),v(1,.16,0).normalize());
 return Array.from({length:FACE_COUNT},(_,i)=>{const y=1-2*(i+.5)/FACE_COUNT,r=Math.sqrt(1-y*y),a=i*Math.PI*(3-Math.sqrt(5));return v(r*Math.cos(a),y,r*Math.sin(a)).applyQuaternion(rotation);});
}
export function faceSites(groundAt){
 return faceDirections().map((normal,i)=>{
  const center=groundAt(normal)?.point;if(!center)throw Error('Missing face projection terrain');
  const up=v(0,1,0).addScaledVector(normal,-normal.y);if(up.lengthSq()<1e-5)up.set(1,0,0).addScaledVector(normal,-normal.x);up.normalize().applyAxisAngle(normal,(i%5-2)*.18);
  const right=up.clone().cross(normal).normalize();return {center,normal,up,right};
 });
}
export function projectionUV(point,site){
 const d=point.clone().sub(site.center);return {u:.5+d.dot(site.right)/FACE_SIZE,v:.5-d.dot(site.up)/FACE_SIZE,depth:d.dot(site.normal)};
}
export function faceUniforms(){
 const placeholder=new THREE.DataTexture(new Uint8Array([0,0,0,0]),1,1);placeholder.needsUpdate=true;
 return {faceMode:{value:0},faceExpose:{value:0},faceAtlas:{value:placeholder},faceCenters:{value:Array.from({length:FACE_COUNT},()=>v())},faceRights:{value:Array.from({length:FACE_COUNT},()=>v())},faceUps:{value:Array.from({length:FACE_COUNT},()=>v())},faceNormals:{value:Array.from({length:FACE_COUNT},()=>v())},faceFound:{value:new Float32Array(FACE_COUNT)}};
}
export const faceShader=`
uniform float faceMode;
uniform float faceExpose;
uniform sampler2D faceAtlas;
uniform vec3 faceCenters[11];
uniform vec3 faceRights[11];
uniform vec3 faceUps[11];
uniform vec3 faceNormals[11];
uniform float faceFound[11];
vec3 faceProjection(vec3 rock, vec3 point, float light){
 if(faceMode<0.5)return rock;
 for(int i=0;i<11;i++){
  vec3 delta=point-faceCenters[i];
  if(abs(dot(delta,faceNormals[i]))>42.0)continue;
  vec2 q=vec2(dot(delta,faceRights[i]),-dot(delta,faceUps[i]))/${FACE_SIZE.toFixed(1)}+0.5;
  if(q.x<0.0||q.y<0.0||q.x>1.0||q.y>1.0)continue;
  vec2 cell=vec2(mod(float(i),4.0),floor(float(i)/4.0));
  vec4 image=texture2D(faceAtlas,vec2((cell.x+q.x)/4.0,1.0-(cell.y+q.y)/3.0));
  float gray=dot(image.rgb,vec3(.2126,.7152,.0722));
  // Projected light has some brightness even on the night side, but preserves
  // the rock's microtexture and real-time relief rather than looking like paper.
  float detail=clamp(dot(rock,vec3(.333)),0.0,1.0);
  float luminance=(.055+.79*gray)*(.66+.25*light)+.12*detail;
  vec3 projected=vec3(luminance);
  if(faceFound[i]>.5)projected=vec3(.03,.55+.40*gray,.09);
  else if(faceExpose>.5)projected=vec3(.95,.84+.15*gray,.025);
  rock=mix(rock,projected,image.a*(faceExpose>.5||faceFound[i]>.5?.94:.46));
 }
 return rock;
}
`;
async function makeAtlas(decode){
 const canvas=document.createElement('canvas');canvas.width=TILE*COLS;canvas.height=TILE*ROWS;const ctx=canvas.getContext('2d',{willReadFrequently:true});
 const images=await Promise.all(Array.from({length:FACE_COUNT},async(_,i)=>{const bytes=decode('face-'+i),url=URL.createObjectURL(new Blob([bytes],{type:'image/webp'}));try{return await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=url;});}finally{URL.revokeObjectURL(url);}}));
 images.forEach((img,i)=>{const scale=(TILE-4)/Math.max(img.width,img.height),w=img.width*scale,h=img.height*scale;ctx.drawImage(img,(i%COLS)*TILE+(TILE-w)/2,Math.floor(i/COLS)*TILE+(TILE-h)/2,w,h);});
 const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data,texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;
 return {texture,pixels,width:canvas.width};
}
export function createFaceHunt(ground,groundAt,camera,canvas,ui,uniforms,decode){
 const sites=faceSites(groundAt),found=new Set(),ray=new THREE.Raycaster();ray.firstHitOnly=true;
 let atlas=null,pending=null,enabled=false,exposed=false,down=null;
 sites.forEach((s,i)=>{uniforms.faceCenters.value[i].copy(s.center);uniforms.faceRights.value[i].copy(s.right);uniforms.faceUps.value[i].copy(s.up);uniforms.faceNormals.value[i].copy(s.normal);});
 function update(){ui.counter.textContent=found.size+'/11 found';ui.progress.value=found.size;ui.expose.textContent=exposed?'Hide exposure':'Expose';ui.expose.setAttribute('aria-pressed',String(exposed));uniforms.faceExpose.value=Number(exposed);}
 function discover(i){if(!enabled||!atlas||found.has(i))return false;found.add(i);uniforms.faceFound.value[i]=1;const li=document.createElement('li');li.textContent='Portrait '+String(i+1).padStart(2,'0')+' — found';ui.list.append(li);update();ui.message.textContent=found.size===FACE_COUNT?'Case closed. All eleven faces found.':'Portrait discovered. Keep looking.';if(found.size===FACE_COUNT)ui.finale.showModal();return true;}
 async function change(){enabled=ui.toggle.checked;ui.panel.hidden=!enabled;uniforms.faceMode.value=0;if(!enabled)return;
  if(!atlas){ui.message.textContent='Preparing projected portraits…';ui.expose.disabled=true;try{pending??=makeAtlas(decode);atlas=await pending;uniforms.faceAtlas.value.dispose();uniforms.faceAtlas.value=atlas.texture;}catch(error){ui.message.textContent='Unable to load portraits: '+error.message;ui.toggle.checked=false;enabled=false;return;}finally{ui.expose.disabled=false;}}
  uniforms.faceMode.value=Number(enabled);ui.message.textContent='Orbit or drive. Click a projected face to discover it.';update();canvas.dispatchEvent(new Event('input',{bubbles:true}));
 }
 function pick(e){if(!enabled||!atlas)return;const rect=canvas.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2),camera);const hit=ray.intersectObject(ground,false)[0];if(!hit)return;
  for(let i=0;i<sites.length;i++){const {u,v,depth}=projectionUV(hit.point,sites[i]);if(Math.abs(depth)>42||u<0||u>=1||v<0||v>=1)continue;const x=(i%COLS)*TILE+Math.floor(u*TILE),y=Math.floor(i/COLS)*TILE+Math.floor(v*TILE);if(atlas.pixels[(y*atlas.width+x)*4+3]>36){discover(i);break;}}
 }
 canvas.addEventListener('pointerdown',e=>{if(e.button===0)down={x:e.clientX,y:e.clientY,id:e.pointerId};});
 canvas.addEventListener('pointerup',e=>{if(down&&down.id===e.pointerId&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<6)pick(e);down=null;});
 canvas.addEventListener('pointercancel',()=>{down=null;});
 ui.toggle.addEventListener('change',change);ui.expose.addEventListener('click',()=>{exposed=!exposed;update();});
 ui.reset.addEventListener('click',()=>{found.clear();uniforms.faceFound.value.fill(0);ui.list.replaceChildren();ui.message.textContent='Expedition reset. Find all eleven faces.';update();if(ui.finale.open)ui.finale.close();});
 ui.close.addEventListener('click',()=>ui.finale.close());update();
 return {sites,found,change,discover};
}
