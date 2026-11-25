import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {DINOSAURS,skeleton,createFossilHunt} from '../src/fossils.js';
test('20 unique, distinct life-scale skeletal meshes',()=>{
 assert.equal(DINOSAURS.length,20);assert.equal(new Set(DINOSAURS.map(d=>d.name)).size,20);
 for(const [i,d] of DINOSAURS.entries()){const g=skeleton(d,i);assert.ok(Math.abs(g.boundingBox.max.x-g.boundingBox.min.x-d.length)<.0001);assert.ok(g.attributes.position.count>10000);assert.equal(g.attributes.color.count,g.attributes.position.count);assert.ok(g.attributes.position.array.every(Number.isFinite));assert.ok(g.attributes.normal.array.every(Number.isFinite));g.dispose();}
});
test('hunt toggle, terrain placement, unique finds, green state, completion and reset',()=>{
 const scene=new THREE.Scene(),ground=new THREE.Mesh(new THREE.SphereGeometry(250,32,16),new THREE.MeshBasicMaterial()),camera=new THREE.PerspectiveCamera();
 const element=()=>Object.assign(new EventTarget(),{checked:false,hidden:true,textContent:'',value:0,children:[],append(x){this.children.push(x)},replaceChildren(){this.children=[]},setAttribute(k,v){this[k]=v},showModal(){this.open=true},close(){this.open=false}});
 const ui=Object.fromEntries(['toggle','panel','counter','progress','message','list','reset','expose','finale','close'].map(k=>[k,element()]));
 const oldDoc=globalThis.document;globalThis.document={createElement:()=>element()};
 try{
  const h=createFossilHunt(scene,ground,dir=>({point:dir.clone().multiplyScalar(250),normal:dir.clone()}),camera,new EventTarget(),ui);
  assert.equal(h.root.visible,false);ui.toggle.checked=true;ui.toggle.dispatchEvent(new Event('change'));assert.equal(h.objects.length,20);assert.equal(h.root.visible,true);assert.equal(ui.counter.textContent,'0/20 found');
  const original=h.objects[0].material;assert.ok(original.emissiveIntensity>0&&original.emissiveIntensity<.3);assert.ok(original.vertexColors);ui.expose.dispatchEvent(new Event('click'));assert.equal(ui.expose['aria-pressed'],'true');assert.equal(h.objects[0].material.color.getHex(),0xffff00);assert.equal(ui.counter.textContent,'0/20 found');
  ui.expose.dispatchEvent(new Event('click'));assert.equal(h.objects[0].material,original);
  ui.expose.dispatchEvent(new Event('click'));
  for(const obj of h.objects){const r=obj.geometry.boundingSphere.center.length();assert.ok(r>249&&r<253);const original=obj.material;h.discover(obj);assert.notEqual(obj.material,original);h.discover(obj);}
  assert.equal(ui.progress.value,20);assert.ok(h.objects.every(o=>o.material.color.getHex()===0x3de763));assert.equal(ui.list.children.length,20);assert.equal(ui.finale.open,true);assert.equal(ui.counter.textContent,'20/20 found');
  ui.toggle.checked=false;ui.toggle.dispatchEvent(new Event('change'));assert.equal(h.root.visible,false);
  ui.toggle.checked=true;ui.toggle.dispatchEvent(new Event('change'));assert.equal(h.objects.length,20);assert.equal(ui.counter.textContent,'20/20 found');
  ui.reset.dispatchEvent(new Event('click'));assert.equal(h.found.size,0);assert.equal(ui.finale.open,false);assert.equal(ui.list.children.length,0);
 }finally{globalThis.document=oldDoc;}
});