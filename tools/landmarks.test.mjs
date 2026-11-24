import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import * as THREE from 'three';
import {LANDMARKS,hull,siteDirection,placeLandmark,parseLandmark,createLandmarkHunt} from '../src/landmarks.js';
const sphere=dir=>({point:dir.clone().multiplyScalar(250),normal:dir.clone()});
const load=id=>{const b=readFileSync('.cache/landmarks/'+id.replace('landmark-','')+'.glb');return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);};
test('twenty separated sites, unique pinned metre-scale models',()=>{
 assert.equal(LANDMARKS.length,20);assert.equal(new Set(LANDMARKS.map(d=>d.id)).size,20);
 for(const [i,d] of LANDMARKS.entries()){assert.equal(d.license,'CC-BY-4.0');assert.match(d.sha256,/^[0-9a-f]{64}$/);assert.ok(d.triangles>=7000);assert.ok(Math.abs(siteDirection(i).length()-1)<1e-7);for(let j=0;j<i;j++)assert.ok(siteDirection(i).angleTo(siteDirection(j))>.45);}
 assert.equal(hull([[0,0],[0,1],[1,1],[1,0],[.5,.5]]).length,4);
});
test('rigid building coordinates and grade-connected foundation on a sphere',()=>{
 const group=new THREE.Group(),geom=new THREE.BoxGeometry(20,30,15);geom.translate(0,15,0);group.add(new THREE.Mesh(geom,new THREE.MeshBasicMaterial()));
 const a=placeLandmark({group,footprint:[[-10,-7.5],[10,-7.5],[10,7.5],[-10,7.5]],size:new THREE.Vector3(20,30,15)},0,sphere);
 assert.ok(Math.abs(group.scale.x-1)<1e-8&&Math.abs(group.scale.y-1)<1e-8);
 assert.ok(a.top>=Math.max(...a.edgeHeights));assert.ok(a.foundation.geometry.attributes.position.count>100);
 assert.ok(group.position.length()>250&&group.position.length()<252);
});
test('all actual compressed assets, monochrome and collection state',{skip:!LANDMARKS.every(d=>existsSync('.cache/landmarks/'+d.id+'.glb'))},async()=>{
 const make=()=>Object.assign(new EventTarget(),{checked:false,hidden:true,textContent:'',value:0,children:[],append(x){this.children.push(x)},replaceChildren(){this.children=[]},setAttribute(k,v){this[k]=v},showModal(){this.open=true},close(){this.open=false}});
 const ui=Object.fromEntries(['toggle','panel','counter','progress','message','list','reset','expose','finale','close'].map(k=>[k,make()]));const old=globalThis.document;globalThis.document={createElement:make};
 try{
  const scene=new THREE.Scene(),ground=new THREE.Mesh(new THREE.SphereGeometry(250,16,8),new THREE.MeshBasicMaterial());
  const hunt=createLandmarkHunt(scene,ground,sphere,new THREE.PerspectiveCamera(),new EventTarget(),ui,load);
  ui.toggle.checked=true;await hunt.change();assert.equal(hunt.assets.length,20);assert.equal(hunt.root.visible,true);
  for(const a of hunt.assets){assert.ok(Math.abs(a.size.y-(a.info.bounds.max[1]-a.info.bounds.min[1]))<.25);assert.ok(a.top>=Math.max(...a.edgeHeights));for(const mesh of a.list){const mat=mesh.material;for(const m of Array.isArray(mat)?mat:[mat])assert.ok(Math.abs(m.color.r-m.color.g)<1e-9&&Math.abs(m.color.g-m.color.b)<1e-9);}}
  ui.expose.dispatchEvent(new Event('click'));assert.equal(hunt.assets[0].list[0].material.color.getHex(),0xffff00);assert.equal(ui.progress.value,0);
  for(const a of hunt.assets){assert.equal(hunt.discover(a.info.id),true);assert.equal(hunt.discover(a.info.id),false);assert.equal(a.list[0].material.color.getHex(),0x3de763);}
  assert.equal(ui.counter.textContent,'20/20 found');assert.equal(ui.finale.open,true);ui.reset.dispatchEvent(new Event('click'));assert.equal(ui.progress.value,0);
 }finally{globalThis.document=old;}
});
