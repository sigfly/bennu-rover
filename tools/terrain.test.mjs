import test from 'node:test';
import assert from 'node:assert/strict';
import {geoToVector,vectorToGeo} from '../src/terrain.js';
test('coordinate conversion roundtrips across the seam and hemispheres',()=>{for(const [a,b] of [[0,0],[45,90],[-70,-170],[12,179.9]]){const [x,y,z]=geoToVector(a,b);const p=vectorToGeo({x,y,z});assert.ok(Math.abs(p.lat-a)<1e-9);assert.ok(Math.abs(p.lon-b)<1e-9);}});
