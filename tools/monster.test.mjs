import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import * as THREE from 'three';
import {TRUCK,dampedStep,wheelTargets,createMonsterTruck} from '../src/monster.js';
test('scale and 30 inch suspension travel',()=>{assert.equal(TRUCK.length,5.18);assert.equal(TRUCK.width,3.81);assert.equal(TRUCK.height,3.2);assert.equal(TRUCK.tireDiameter,1.6764);assert.equal(TRUCK.travel,.762);});
test('spring damping converges without instability and uneven contact produces chassis roll and pitch',()=>{
 const s={x:0,v:0};for(let i=0;i<120;i++)dampedStep(s,.35,1/60,7,1);assert.ok(Math.abs(s.x-.35)<1e-5);
 const level=wheelTargets([0,0,0,0]);assert.equal(level.body,0);assert.equal(level.roll,0);assert.equal(level.pitch,0);
 const bump=wheelTargets([.6,0,0,0]);assert.ok(bump.roll>0&&bump.pitch>0&&bump.body>0);
});
function geometryOnly(bytes){
 // Browser tests cover all real PBR images; Node has no image decoder, so use the same
 // verified GLB geometry with texture bindings removed for suspension regression tests.
 const len=bytes.readUInt32LE(12),j=JSON.parse(bytes.subarray(20,20+len));
 for(const m of j.materials){delete m.normalTexture;delete m.occlusionTexture;delete m.emissiveTexture;delete m.pbrMetallicRoughness?.baseColorTexture;delete m.pbrMetallicRoughness?.metallicRoughnessTexture;}
 delete j.images;delete j.textures;delete j.samplers;
 const raw=Buffer.from(JSON.stringify(j));const padded=Buffer.concat([raw,Buffer.alloc((4-raw.length%4)%4,32)]),tail=bytes.subarray(20+len),head=Buffer.alloc(20);
 head.writeUInt32LE(0x46546c67,0);head.writeUInt32LE(2,4);head.writeUInt32LE(20+padded.length+tail.length,8);head.writeUInt32LE(padded.length,12);head.writeUInt32LE(0x4e4f534a,16);
 const out=Buffer.concat([head,padded,tail]);return out.buffer.slice(out.byteOffset,out.byteOffset+out.byteLength);
}
test('real source truck: four independent hubs, true scale, animated compression and damping',{skip:!existsSync('.cache/monster-truck.glb')},async()=>{
 const t=await createMonsterTruck(geometryOnly(readFileSync('.cache/monster-truck.glb'))),s=new THREE.Vector3(250,0,0),h=new THREE.Vector3(0,0,-1);
 assert.equal(t.wheels.length,4);assert.equal(new Set(t.wheels.map(w=>w.node)).size,4);
 let hill=false;const groundAt=dir=>({point:dir.clone().multiplyScalar(250+(hill&&dir.y>0&&dir.z<0?.65:0))});
 let p=t.update({surface:s,heading:h,groundAt,dt:1/60,velocity:0,steer:0,reset:true});
 const sizes=new THREE.Box3().setFromObject(t.root,true).getSize(new THREE.Vector3());assert.ok(Math.abs(sizes.x-TRUCK.length)<.1||Math.abs(sizes.z-TRUCK.length)<.1); // world frame after radial orientation
 const local=new THREE.Box3().setFromObject(t.root);assert.ok(t.root.getObjectByName('monster-truck_body').geometry.index.count<10798*3);
 const initial=t.wheels.map(w=>w.state.x);hill=true;s.set(250,.1,0);
 for(let i=0;i<90;i++)p=t.update({surface:s,heading:h,groundAt,dt:1/60,velocity:2,steer:.8});
 assert.ok(t.wheels.some((w,i)=>Math.abs(w.state.x-initial[i])>.05));assert.ok(Math.max(...p.suspension)-Math.min(...p.suspension)>10);
 assert.ok(p.suspension.every(n=>n>=-1e-4&&n<=100.0001));assert.ok(t.wheels[0].steering.rotation.y>0);assert.ok(t.wheels[2].steering.rotation.y<0);
 assert.ok(t.root.userData.poseRevision>0);
});
