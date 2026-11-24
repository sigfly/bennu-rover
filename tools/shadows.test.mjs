import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {shadowProfile,createSunShadows} from '../src/shadows.js';
test('global mapping covers landmarks and local mapping resolves rover-scale shadows',()=>{
 assert.equal(shadowProfile('orbit',false,'off').enabled,false);
 const globe=shadowProfile('orbit',false,'high'),city=shadowProfile('orbit',true,'high'),local=shadowProfile('cockpit',true,'high');
 assert.equal(globe.resolution,4096);assert.ok(globe.half>=300);assert.ok(city.half>=600);
 assert.ok(local.half<50&&2*local.half/local.resolution<.025);assert.equal(shadowProfile('chase',false,'high',2048).resolution,2048);
});
test('shadow cache updates on Sun direction, scope, movement and expedition visibility',()=>{
 const scene=new THREE.Scene(),light=new THREE.DirectionalLight(),rover=new THREE.Group();
 const renderer={shadowMap:{},capabilities:{maxTextureSize:4096},domElement:{dataset:{}}},quality={value:'high'},stats={textContent:''},material={};
 const ctl=createSunShadows(renderer,light,scene,quality,stats,material);const sun=new THREE.Vector3(1,.3,.2).normalize();
 const render=(now,mode='orbit',landmarks=false,fossils=false)=>ctl.update({now,mode,sun,rover,landmarks,fossils,edition:'standard'});
 const rev=()=>Number(renderer.domElement.dataset.shadowRevision);
 render(0);assert.equal(rev(),1);assert.equal(light.castShadow,true);assert.equal(light.shadow.mapSize.x,4096);
 render(1000);assert.equal(rev(),1);
 sun.set(0,1,1).normalize();render(2000);assert.equal(rev(),2);
 render(2100,'orbit',true);assert.equal(rev(),3);assert.equal(light.shadow.camera.right,650);
 render(2200,'cockpit',true);assert.equal(rev(),4);assert.equal(light.shadow.camera.right,42);
 rover.position.set(1,2,3);render(2400,'cockpit',true);assert.equal(rev(),5);assert.ok(light.target.position.equals(rover.position));
 quality.value='off';render(2500,'cockpit',true);assert.equal(light.castShadow,false);assert.equal(renderer.shadowMap.enabled,false);
 quality.value='standard';render(2600,'cockpit',true);assert.equal(rev(),6);assert.equal(light.shadow.mapSize.x,2048);
});
