import test from 'node:test';
import assert from 'node:assert/strict';
import {floorAt,intersects} from '../src/physics.js';
test('stairs connect courtyard to balcony continuously',()=>{assert.equal(floorAt(8.4,8,0),0);assert.equal(floorAt(8.4,4,1.5),1.65);assert.equal(floorAt(8.4,0,3.2),3.3);assert.equal(floorAt(8,-1,3.3),3.3);});
test('ground floor remains walkable underneath the balcony',()=>{assert.equal(floorAt(0,0,0),0);assert.equal(floorAt(0,0,3.3),3.3);assert.equal(floorAt(0,10,3.3),0);});
test('collision uses player radius and vertical overlap',()=>{const wall={minX:1,maxX:2,minZ:1,maxZ:2,minY:0,maxY:3.1};assert.equal(intersects(.8,1.5,0,wall),true);assert.equal(intersects(.5,1.5,0,wall),false);assert.equal(intersects(1.5,1.5,3.3,wall),false);});
