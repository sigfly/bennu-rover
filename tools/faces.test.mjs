import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {FACE_COUNT,FACE_SIZE,faceDirections,faceSites,projectionUV,faceUniforms} from '../src/faces.js';
test('eleven 20-metre orthographic projection sites distributed around the asteroid',()=>{
 assert.equal(FACE_COUNT,11);assert.equal(FACE_SIZE,20);
 const dirs=faceDirections();assert.equal(dirs.length,11);
 for(let i=0;i<dirs.length;i++){assert.ok(Math.abs(dirs[i].length()-1)<1e-8);for(let j=0;j<i;j++)assert.ok(dirs[i].angleTo(dirs[j])>.6);}
 const sites=faceSites(d=>({point:d.clone().multiplyScalar(250)}));
 for(const s of sites){assert.ok(Math.abs(s.right.dot(s.up))<1e-8);const center=projectionUV(s.center,s);assert.equal(center.u,.5);assert.equal(center.v,.5);assert.ok(Math.abs(center.depth)<1e-8);const edge=projectionUV(s.center.clone().addScaledVector(s.right,10),s);assert.ok(Math.abs(edge.u-1)<1e-8);}
 const uniforms=faceUniforms();assert.equal(uniforms.faceMode.value,0);assert.equal(uniforms.faceFound.value.length,11);
});