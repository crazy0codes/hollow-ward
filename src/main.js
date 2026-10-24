import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer, EffectPass, RenderPass, BloomEffect, NoiseEffect, VignetteEffect } from 'postprocessing';
import RAPIER from '@dimforge/rapier3d-compat';
import * as YUKA from 'yuka';
import './styles.css';

const $ = (id) => document.getElementById(id);
const MAP = [
  '#####.#####',
  '#.........#',
  '#.###.##..#',
  '#.#.....#.#',
  '#.#.....#.#',
  '#.........#',
  '#.###.##..#',
  '#...#.....#',
  '#...#.....#',
  '#.........#',
  '###########',
];
const ROWS = MAP.length, COLS = MAP[0].length, CELL = 5.25, WALL_H = 3.5, WALL_T = 0.28, EXIT_COL = 5;
const EXIT_Z = -((ROWS - 1) / 2) * CELL - CELL / 2;
const walkable = new Set();
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (MAP[r][c] === '.') walkable.add(r + ',' + c);
const mat = (color, roughness = 0.9, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const M = {
  floor: mat(0x323337, 0.97), wall: mat(0x414247, 0.94), darkWall: mat(0x24262a, 0.96),
  ceiling: mat(0x17191d, 0.96), trim: mat(0x68645d, 0.76, 0.14), metal: mat(0x4a5054, 0.55, 0.6),
  mattress: mat(0x77766e, 0.95), sheet: mat(0x96958a, 0.98), dark: mat(0x111216, 0.93),
  rust: mat(0x55272b, 0.9), key: new THREE.MeshStandardMaterial({ color: 0xcba34d, roughness: 0.28, metalness: 0.74, emissive: 0x4a2905, emissiveIntensity: 0.5 }),
  paper: mat(0xcac3ae, 1),
};
let scene, camera, renderer, composer, controls, world, kcc, playerBody, playerCollider, navGraph, navWorldPoints = new Map(), navGridLookup = new Map();
let flashlight, flashlightTarget, flashlightOn = true, battery = 100, exitDoor, exitPivot, exitCollider, exitOpen = false;
let enemyGroup, enemyModel, enemyLight, enemyMixer, enemyClips = {}, enemyFallback = false, enemyProcedural = false, enemyAssetName = 'procedural hunter';
let backroomLoaded = false, backroomGroup = null, backroomBounds = null, playerSpawn = null, enemySpawn = null, houseGroup = null, houseMixer = null, finaleActive = false, finaleClock = 0, receiverConsole = null;
let apparitionGroup, apparitionModel, apparitionActive = false, apparitionClock = 0, nextApparitionAt = 32;
let signalStations = [], hidingSpots = [], interactive = [], wallVisuals = [], lamps = [], nearestInteractable = null, wallParts = [], trimParts = [];
let isPlayerHidden = false, currentHideSpot = null, restoreFlashlightAfterHide = false;
let state = 'menu', elapsed = 0, messageTimer = 0, threat = 0, verticalSpeed = 0, bob = 0, footstep = 0, initializationError = null, frameCount = 0;
let lastDesired = { x: 0, y: 0, z: 0 }, lastActual = { x: 0, y: 0, z: 0 };
let enemyMode = 'LURK', enemyPath = [], enemyPathIndex = 0, patrolTarget = null, pathClock = 0, searchClock = 0;
let lastKnown = new THREE.Vector3(), audioContext, masterGain, audioReady = false, heartbeatClock = 0;
const moveKeys = new Set(), clock = new THREE.Clock(), raycaster = new THREE.Raycaster(), clearanceRaycaster = new THREE.Raycaster(), navigationRaycaster = new THREE.Raycaster();
const clearanceDirections = [
  new THREE.Vector3(1,0,0), new THREE.Vector3(-1,0,0), new THREE.Vector3(0,0,1), new THREE.Vector3(0,0,-1),
];
const forward = new THREE.Vector3(), right = new THREE.Vector3(), move = new THREE.Vector3(), direction = new THREE.Vector3();

function cellPos(row, col) { return new THREE.Vector3((col - (COLS - 1) / 2) * CELL, 0, (row - (ROWS - 1) / 2) * CELL); }
function toCell(pos) {
  return { row: THREE.MathUtils.clamp(Math.round(pos.z / CELL + (ROWS - 1) / 2), 0, ROWS - 1), col: THREE.MathUtils.clamp(Math.round(pos.x / CELL + (COLS - 1) / 2), 0, COLS - 1) };
}
function openCell(r, c) { return walkable.has(r + ',' + c); }
function box(w, h, d, material, pos, parent = scene) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.copy(pos); mesh.castShadow = false; mesh.receiveShadow = false; parent.add(mesh); return mesh;
}
function fixedBox(w, h, d, pos, rotationY = 0, tag = 'wall') {
  const q = { x: 0, y: Math.sin(rotationY / 2), z: 0, w: Math.cos(rotationY / 2) };
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y, pos.z).setRotation(q));
  const collider = world.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2), body);
  return { body, collider, tag };
}
function cylinder(radius, height, material, pos, parent = scene, segments = 10) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), material);
  mesh.position.copy(pos); mesh.castShadow = false; parent.add(mesh); return mesh;
}
function addWall(w, d, pos) {
  // Batch static wall visuals to keep the level's draw-call count low.
  const wallGeometry = new THREE.BoxGeometry(w, WALL_H, d);
  wallGeometry.translate(pos.x, WALL_H / 2, pos.z);
  wallParts.push(wallGeometry);
  const trimGeometry = new THREE.BoxGeometry(w, 0.13, d + 0.035);
  trimGeometry.translate(pos.x, 0.11, pos.z);
  trimParts.push(trimGeometry);
  fixedBox(w, WALL_H, d, new THREE.Vector3(pos.x, WALL_H / 2, pos.z));
}
function addLamp(row, col, power) {
  const p = cellPos(row, col);
  box(1.12, 0.11, 0.4, M.dark, new THREE.Vector3(p.x, WALL_H - 0.23, p.z));
  const tube = box(0.88, 0.035, 0.18, new THREE.MeshStandardMaterial({ color: 0xa9c2ca, emissive: 0x94b6c0, emissiveIntensity: 0.8 }), new THREE.Vector3(p.x, WALL_H - 0.3, p.z));
  const light = new THREE.PointLight(0xaec8d0, power, 8, 2); light.position.set(p.x, WALL_H - 0.48, p.z); scene.add(light);
  lamps.push({ tube, light, base: power, clock: Math.random() * 10 });
}
function drawHospital() {
  const floorParts = [], ceilingParts = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (!openCell(r, c)) continue;
    const p = cellPos(r, c);
    const fg = new THREE.BoxGeometry(CELL - 0.06, 0.22, CELL - 0.06); fg.translate(p.x, -0.12, p.z); floorParts.push(fg);
    if ((r + c) % 4 !== 0) { const cg = new THREE.BoxGeometry(CELL - 0.06, 0.18, CELL - 0.06); cg.translate(p.x, WALL_H + 0.08, p.z); ceilingParts.push(cg); }
    if (!openCell(r, c - 1)) addWall(WALL_T, CELL, new THREE.Vector3(p.x - CELL / 2, 0, p.z));
    if (!openCell(r, c + 1)) addWall(WALL_T, CELL, new THREE.Vector3(p.x + CELL / 2, 0, p.z));
    if (!openCell(r - 1, c)) addWall(CELL, WALL_T, new THREE.Vector3(p.x, 0, p.z - CELL / 2));
    if (!openCell(r + 1, c)) addWall(CELL, WALL_T, new THREE.Vector3(p.x, 0, p.z + CELL / 2));
  }
  const wallMesh = new THREE.Mesh(mergeGeometries(wallParts, false), M.wall);
  scene.add(wallMesh); wallVisuals.push(wallMesh);
  scene.add(new THREE.Mesh(mergeGeometries(trimParts, false), M.darkWall));
  scene.add(new THREE.Mesh(mergeGeometries(floorParts, false), M.floor));
  scene.add(new THREE.Mesh(mergeGeometries(ceilingParts, false), M.ceiling));
  for (const [r, c, power] of [[1,2,.72],[1,7,.45],[3,5,.6],[5,3,.65],[5,7,.4],[8,2,.35],[8,7,.52]]) addLamp(r, c, power);
  buildBeds(); buildCurtains();
}
function buildBeds() {
  for (const b of [{ r:1,c:2,rot:0 }, { r:1,c:7,rot:Math.PI/2 }, { r:3,c:5,rot:Math.PI/2 }, { r:8,c:2,rot:0 }]) {
    const p = cellPos(b.r, b.c), g = new THREE.Group(); g.position.copy(p); g.rotation.y = b.rot; scene.add(g);
    box(2.38,.16,1.08,M.metal,new THREE.Vector3(0,.57,0),g);
    box(2.2,.25,1.0,M.mattress,new THREE.Vector3(0,.77,0),g);
    box(.5,.11,.84,M.sheet,new THREE.Vector3(-.55,.95,0),g);
    for (const x of [-1.02,1.02]) for (const z of [-.42,.42]) {
      cylinder(.04,.52,M.metal,new THREE.Vector3(x,.28,z),g,8);
      cylinder(.105,.055,M.dark,new THREE.Vector3(x,.03,z),g,8);
    }
    box(2.45,.08,.1,M.metal,new THREE.Vector3(-1.18,1.05,0),g);
    box(2.45,.08,.1,M.metal,new THREE.Vector3(1.18,1.05,0),g);
  }
}
function buildNurseStation() {
  const p = cellPos(5,5);
  box(3.25,1.08,1.1,M.dark,new THREE.Vector3(p.x,.58,p.z-.65));
  box(3.45,.12,1.2,M.trim,new THREE.Vector3(p.x,1.18,p.z-.65));
  box(2.35,.5,.06,M.metal,new THREE.Vector3(p.x,1.55,p.z-.95));
  const screen = new THREE.MeshStandardMaterial({ color:0x101d1e, emissive:0x163c40, emissiveIntensity:.42 });
  box(.8,.44,.045,screen,new THREE.Vector3(p.x+.55,1.58,p.z-.99));
  const note = box(.44,.025,.34,M.paper,new THREE.Vector3(p.x-.72,1.27,p.z-.58));
  note.userData.targetType = 'note'; interactive.push(note);
  const lamp = new THREE.PointLight(0x6b999c,.35,3); lamp.position.set(p.x+.55,1.6,p.z-.9); scene.add(lamp);
}
function buildCurtains() {
  const fabric = new THREE.MeshStandardMaterial({ color:0x55575b, roughness:1, side:THREE.DoubleSide, transparent:true, opacity:.8 });
  for (const [r,c,axis] of [[3,2,'z'],[4,2,'z'],[7,2,'x'],[7,7,'x']]) {
    const p = cellPos(r,c), bar = new THREE.Group(); bar.position.copy(p); scene.add(bar);
    const length = axis === 'x' ? 2.1 : 2.65;
    box(length,.045,.045,M.metal,new THREE.Vector3(0,2.25,0),bar);
    const curtain = new THREE.Mesh(new THREE.PlaneGeometry(length,2.05,7,1),fabric); curtain.position.set(0,1.18,0); curtain.rotation.y = axis === 'x' ? Math.PI/2 : 0; bar.add(curtain);
    for (let i=0;i<7;i++) cylinder(.027,.027,M.metal,new THREE.Vector3(-length/2+i*length/6,2.2,0),bar,6);
  }
}
function buildExit() {
  const doorW = 2.35, z = EXIT_Z + .08, sideLen = (CELL - doorW)/2;
  addWall(sideLen,WALL_T,new THREE.Vector3(-doorW/2-sideLen/2,0,EXIT_Z));
  addWall(sideLen,WALL_T,new THREE.Vector3(doorW/2+sideLen/2,0,EXIT_Z));
  box(.16,WALL_H,.34,M.trim,new THREE.Vector3(-doorW/2,WALL_H/2,z));
  box(.16,WALL_H,.34,M.trim,new THREE.Vector3(doorW/2,WALL_H/2,z));
  box(doorW+.16,.17,.34,M.trim,new THREE.Vector3(0,WALL_H-.08,z));
  exitPivot = new THREE.Group(); exitPivot.position.set(-doorW/2,0,z+.11); scene.add(exitPivot);
  exitDoor = box(doorW,2.9,.13,mat(0x262b2f,.55,.52),new THREE.Vector3(doorW/2,1.45,0),exitPivot);
  box(.23,.23,.12,M.key,new THREE.Vector3(doorW-.28,1.42,.1),exitPivot);
  exitDoor.userData.targetType = 'exit'; interactive.push(exitDoor);
  createExitCollider();
  const sign = new THREE.MeshStandardMaterial({ color:0x18231c, emissive:0x1c422c, emissiveIntensity:.65 });
  box(1.02,.26,.05,sign,new THREE.Vector3(0,3.04,z-.12));
}
function createExitCollider() {
  if (exitCollider) return;
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,1.48,EXIT_Z+.08));
  exitCollider = world.createCollider(RAPIER.ColliderDesc.cuboid(1.18,1.46,.14),body);
}
function removeExitCollider() { if (exitCollider) { world.removeCollider(exitCollider,true); exitCollider = null; } }
function buildSignalStations() {
  const spots = [
    { row:2, col:1, name:'WEST ECHO RELAY', phase:'PHASE 01 // LOCAL MEMORY' },
    { row:2, col:8, name:'NORTH ECHO RELAY', phase:'PHASE 02 // LIVE VOICE' },
    { row:8, col:2, name:'LOWER ECHO RELAY', phase:'PHASE 03 // SUBJECT 09' },
  ];
  signalStations = spots.map((s,i) => {
    const p = nearestNavigationPoint(cellPos(s.row,s.col), [...hidingSpots.map(spot=>spot.position), ...signalStations.map(station=>station.position)], 5.5), group = new THREE.Group();
    group.position.set(p.x,0,p.z);
    box(.56,.72,.56,M.darkWall,new THREE.Vector3(0,.36,0),group);
    box(.76,.12,.7,M.metal,new THREE.Vector3(0,.77,0),group);
    box(.55,.35,.08,M.dark,new THREE.Vector3(0,1.01,-.18),group);
    const status = new THREE.MeshStandardMaterial({color:0x4a151b,emissive:0x9c111d,emissiveIntensity:.12,roughness:.35,metalness:.3});
    const panel = box(.38,.16,.035,status,new THREE.Vector3(0,1.03,-.13),group);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.16,.025,7,18),M.metal);
    ring.position.set(0,1.38,0); ring.rotation.x=Math.PI/2; group.add(ring);
    const orbMaterial = new THREE.MeshStandardMaterial({color:0x8c2026,emissive:0xa10c18,emissiveIntensity:.5,roughness:.24});
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(.105,1),orbMaterial);
    orb.position.set(0,1.38,0); group.add(orb);
    const glow = new THREE.PointLight(0x9c141e,.24,3,2); glow.position.set(0,1.45,0); group.add(glow);
    for (const side of [-1,1]) {
      cylinder(.025,.26,M.trim,new THREE.Vector3(side*.28,1.02,-.18),group,7);
    }
    group.userData = {targetType:'station',stationIndex:i,name:s.name,phase:s.phase,activated:false,panel,orb,glow,ring,phaseOffset:i*1.8};
    scene.add(group); interactive.push(group); return group;
  });
  return signalStations;
}
function buildReceiverConsole() {
  const p = nearestNavigationPoint(cellPos(5,5), [...hidingSpots.map(spot=>spot.position), ...signalStations.map(station=>station.position)], 5.5), group = new THREE.Group();
  group.position.set(p.x,0,p.z);
  box(1.15,.82,.8,M.darkWall,new THREE.Vector3(0,.41,0),group);
  box(1.25,.12,.88,M.metal,new THREE.Vector3(0,.87,0),group);
  box(.78,.46,.06,M.dark,new THREE.Vector3(0,1.17,-.31),group);
  const screenMaterial = new THREE.MeshStandardMaterial({color:0x112322,emissive:0x1c6c5b,emissiveIntensity:.36,roughness:.35});
  box(.6,.29,.035,screenMaterial,new THREE.Vector3(0,1.18,-.265),group);
  const dial = new THREE.Mesh(new THREE.TorusGeometry(.105,.034,8,18),M.trim);
  dial.position.set(-.3,1.02,.15); dial.rotation.x=Math.PI/2; group.add(dial);
  const buttonMaterial = new THREE.MeshStandardMaterial({color:0x631b22,emissive:0x9d0b1b,emissiveIntensity:.22});
  const button = new THREE.Mesh(new THREE.CylinderGeometry(.09,.11,.07,12),buttonMaterial);
  button.position.set(.29,1.02,.15);group.add(button);
  const glow = new THREE.PointLight(0x237c66,.28,3,2);glow.position.set(0,1.35,0);group.add(glow);
  group.userData={targetType:'receiver',name:'ECHO INVERSION RECEIVER',screenMaterial,buttonMaterial,glow};
  scene.add(group);interactive.push(group);
  receiverConsole=group;
  return group;
}
async function loadBackroomEnvironment() {
  const url='/assets/psx_-_backroom.glb';
  try {
    const response=await fetch(url,{method:'HEAD'});
    if(!response.ok)return false;
    const gltf=await new GLTFLoader().loadAsync(url);
    backroomGroup=new THREE.Group();
    backroomGroup.name='ECHO Backroom Environment';
    backroomGroup.add(gltf.scene);
    backroomGroup.updateMatrixWorld(true);
    const originalBounds=new THREE.Box3().setFromObject(backroomGroup);
    const originalSize=originalBounds.getSize(new THREE.Vector3());
    if(originalSize.x<1||originalSize.z<1)throw new Error('Backroom GLB has invalid dimensions');
    // Fit the imported maze to the current play-space without changing its vertical proportions.
    backroomGroup.scale.set((COLS*CELL-4)/originalSize.x,1,(ROWS*CELL-2)/originalSize.z);
    backroomGroup.updateMatrixWorld(true);
    const scaledBounds=new THREE.Box3().setFromObject(backroomGroup);
    backroomGroup.position.x-= (scaledBounds.min.x+scaledBounds.max.x)/2;
    backroomGroup.position.z-= (scaledBounds.min.z+scaledBounds.max.z)/2;
    // The authored floor is at local y=-0.34. The overall bounds include stray geometry down at -1.246;
    // aligning that lowest vertex with y=0 lifts the actual floor into the player's capsule and blocks movement.
    backroomGroup.position.y = 0.34;
    backroomGroup.updateMatrixWorld(true);
    backroomGroup.traverse(node=>{
      if(!node.isMesh)return;
      node.castShadow=false;node.receiveShadow=false;
      node.frustumCulled=true;
      // Double-sided walls also make ray-based line-of-sight work from the inside of the maze.
      const makeDoubleSided=m=>{const c=m.clone();c.side=THREE.DoubleSide;return c;};
      node.material=Array.isArray(node.material)?node.material.map(makeDoubleSided):makeDoubleSided(node.material);
      wallVisuals.push(node);
      const geometry=node.geometry,position=geometry.attributes.position;
      if(!position||position.count<3)return;
      const vertices=new Float32Array(position.count*3),v=new THREE.Vector3();
      for(let i=0;i<position.count;i++){
        v.fromBufferAttribute(position,i).applyMatrix4(node.matrixWorld);
        vertices[i*3]=v.x;vertices[i*3+1]=v.y;vertices[i*3+2]=v.z;
      }
      const rawIndices=geometry.index?geometry.index.array:Array.from({length:position.count},(_,i)=>i);
      const indices=Uint32Array.from(rawIndices);
      try {
        const body=world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
        world.createCollider(RAPIER.ColliderDesc.trimesh(vertices,indices),body);
      } catch(error) {
        console.warn('Skipped one invalid backroom collision mesh.',error);
      }
    });
    scene.add(backroomGroup);
    backroomBounds = new THREE.Box3().setFromObject(backroomGroup);
    backroomLoaded=true;
    return true;
  } catch(error) {
    console.warn('Backroom GLB unavailable; using procedural fallback level.',error);
    backroomGroup=null;backroomLoaded=false;return false;
  }
}
function isBackroomPointClear(position, clearance = 0.56) {
  if (!backroomLoaded || !backroomBounds || wallVisuals.length === 0) return true;
  const margin = 0.9;
  if (position.x < backroomBounds.min.x + margin || position.x > backroomBounds.max.x - margin ||
      position.z < backroomBounds.min.z + margin || position.z > backroomBounds.max.z - margin) return false;
  // The ray height is above the floor and below the ceiling, so this checks walls and furniture,
  // not the floor plane that the character is supposed to stand on.
  const origin = new THREE.Vector3(position.x, 0.95, position.z);
  clearanceRaycaster.near = 0;
  clearanceRaycaster.far = clearance;
  for (const dir of clearanceDirections) {
    clearanceRaycaster.set(origin, dir);
    const hits = clearanceRaycaster.intersectObjects(wallVisuals, false);
    if (hits.length && hits[0].distance < clearance) return false;
  }
  return true;
}
function findSafeEnvironmentPosition(preferred, maxRadius = CELL, clearance = 0.56) {
  const base = preferred.clone();
  base.y = 0;
  if (!backroomLoaded || isBackroomPointClear(base, clearance)) return base;
  // Imported Backrooms geometry is not laid out like the procedural test grid. Find the nearest
  // actual open spot before placing the player, relays, receiver, or hunter.
  const step = 1.0;
  const rings = Math.ceil(maxRadius / step);
  const candidates = [];
  for (let ix = -rings; ix <= rings; ix++) {
    for (let iz = -rings; iz <= rings; iz++) {
      const dx = ix * step, dz = iz * step, distanceSq = dx * dx + dz * dz;
      if (distanceSq <= maxRadius * maxRadius) candidates.push({ dx, dz, distanceSq });
    }
  }
  candidates.sort((a, b) => a.distanceSq - b.distanceSq);
  for (const candidate of candidates) {
    const point = new THREE.Vector3(base.x + candidate.dx, 0, base.z + candidate.dz);
    if (isBackroomPointClear(point, clearance)) return point;
  }
  console.warn('No clear Backrooms position found near', base.toArray(), '- using its authored fallback position.');
  return base;
}
function buildHidingSpots() {
  if (!backroomLoaded || !navWorldPoints.size) return;
  const preferences = [cellPos(2,4), cellPos(6,2), cellPos(8,7)];
  const used = [];
  const rotations = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  hidingSpots = [];
  for (let i = 0; i < preferences.length; i++) {
    const position = nearestNavigationPoint(preferences[i], used, 7);
    used.push(position.clone());
    const group = new THREE.Group();
    group.name = 'Echo hiding locker ' + (i + 1);
    group.position.copy(position);
    group.rotation.y = rotations[i];
    box(.98,2.15,.78,M.darkWall,new THREE.Vector3(0,1.075,0),group);
    const doorMaterial = mat(i===1?0x33282a:0x292c2e,.92,.12);
    box(.84,1.92,.055,doorMaterial,new THREE.Vector3(0,1.08,.405),group);
    box(.9,.075,.08,M.metal,new THREE.Vector3(0,2.13,.38),group);
    box(.9,.075,.08,M.metal,new THREE.Vector3(0,.07,.38),group);
    box(.065,1.98,.08,M.metal,new THREE.Vector3(-.45,1.08,.38),group);
    box(.065,1.98,.08,M.metal,new THREE.Vector3(.45,1.08,.38),group);
    box(.035,.25,.045,M.trim,new THREE.Vector3(.27,1.0,.45),group);
    const indicator=box(.09,.055,.04,mat(0x721922,.5,.2),new THREE.Vector3(0,1.92,.45),group);
    indicator.material.emissive.set(0x9d1724);
    indicator.material.emissiveIntensity=.45;
    group.userData={targetType:'hidingSpot',name:'EMERGENCY LOCKER',spotIndex:i,indicator};
    scene.add(group);
    interactive.push(group);
    hidingSpots.push(group);
    group.traverse(node=>{
      if(node.isMesh){node.castShadow=false;node.receiveShadow=false;wallVisuals.push(node);}
    });
    fixedBox(1.0,2.16,.82,new THREE.Vector3(position.x,1.08,position.z),group.rotation.y,'hiding-locker');
  }
}
function enterHideSpot(spot) {
  if (!spot || isPlayerHidden) return;
  if (spot.position.distanceTo(camera.position) > 2.25) {
    showMessage('Move closer to the locker first.',1.8);
    return;
  }
  currentHideSpot=spot;
  restoreFlashlightAfterHide=flashlightOn;
  isPlayerHidden=true;
  moveKeys.clear();
  flashlightOn=false;flashlight.visible=false;
  const p=spot.position;
  playerBody.setTranslation({x:p.x,y:.88,z:p.z},true);
  camera.position.set(p.x,1.45,p.z);
  camera.updateMatrixWorld();
  $('hide-overlay')?.classList.remove('hidden');
  showMessage('You fold into the locker. Stay still until the footsteps fade.',3.4);
  cue('click',.05);
}
function leaveHideSpot() {
  if (!isPlayerHidden || !currentHideSpot) return;
  const spot=currentHideSpot;
  const forwardExit=new THREE.Vector3(0,0,1.45).applyAxisAngle(new THREE.Vector3(0,1,0),spot.rotation.y).add(spot.position);
  const rearExit=new THREE.Vector3(0,0,-1.45).applyAxisAngle(new THREE.Vector3(0,1,0),spot.rotation.y).add(spot.position);
  let exit=isBackroomPointClear(forwardExit,.45)?forwardExit:rearExit;
  if(!isBackroomPointClear(exit,.45))exit=nearestNavigationPoint(spot.position);
  isPlayerHidden=false;currentHideSpot=null;
  playerBody.setTranslation({x:exit.x,y:.88,z:exit.z},true);
  camera.position.set(exit.x,1.45,exit.z);
  camera.updateMatrixWorld();
  flashlightOn=restoreFlashlightAfterHide&&battery>.5;
  flashlight.visible=flashlightOn;
  $('hide-overlay')?.classList.add('hidden');
  showMessage('You step back into the corridor. Keep moving.',2.2);
}
function drawBackroomLighting() {
  for(const [r,c,power] of [[1,2,.72],[1,7,.48],[3,5,.42],[5,3,.58],[5,7,.38],[8,2,.46],[8,7,.5]])addLamp(r,c,power);
  // Sparse soundless emergency beacons give orientation without turning the maze into a bright map.
  for(const [r,c] of [[2,1],[2,8],[8,2]]) {
    const p=cellPos(r,c);
    const beacon=new THREE.PointLight(0x9c1825,.14,2.6,2);beacon.position.set(p.x,.28,p.z);scene.add(beacon);
  }
}
async function loadFinalHouse() {
  if(houseGroup)return true;
  const url='/assets/modular_kit_horror_house_104_pieces.glb';
  try {
    const response=await fetch(url,{method:'HEAD'});
    if(!response.ok)return false;
    const gltf=await new GLTFLoader().loadAsync(url);
    houseGroup=new THREE.Group();houseGroup.name='False Home';
    houseGroup.add(gltf.scene);
    houseGroup.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(houseGroup),size=bounds.getSize(new THREE.Vector3());
    const scale=4.8/Math.max(.2,size.y);
    houseGroup.scale.setScalar(scale);
    houseGroup.updateMatrixWorld(true);
    const scaledBounds=new THREE.Box3().setFromObject(houseGroup);
    const look=new THREE.Vector3();camera.getWorldDirection(look);look.y=0;
    if(look.lengthSq()<.01)look.set(0,0,-1);look.normalize();
    const target=camera.position.clone().addScaledVector(look,13.5);
    houseGroup.position.x+=target.x-(scaledBounds.min.x+scaledBounds.max.x)/2;
    houseGroup.position.z+=target.z-(scaledBounds.min.z+scaledBounds.max.z)/2;
    houseGroup.position.y-=scaledBounds.min.y;
    houseGroup.visible=true;
    houseGroup.traverse(node=>{if(node.isMesh){node.castShadow=false;node.receiveShadow=false;}});
    scene.add(houseGroup);
    if(gltf.animations?.length){
      houseMixer=new THREE.AnimationMixer(houseGroup);
      const clip=gltf.animations.find(a=>a.name.toLowerCase().includes('front door'))||gltf.animations[0];
      const action=houseMixer.clipAction(clip);
      action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
    }
    return true;
  } catch(error) {
    console.warn('Optional house finale model could not be loaded.',error);
    houseGroup=null;houseMixer=null;return false;
  }
}
function navigationSegmentClear(a, b) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const distance = Math.hypot(dx, dz);
  if (distance < .08) return true;
  const dir = new THREE.Vector3(dx / distance, 0, dz / distance);
  const side = new THREE.Vector3(-dir.z, 0, dir.x);
  const maxHit = distance - .14;
  if (maxHit <= .06) return true;
  for (const offset of [-.3, 0, .3]) {
    const origin = new THREE.Vector3(a.x + side.x * offset, .95, a.z + side.z * offset);
    navigationRaycaster.set(origin, dir);
    navigationRaycaster.near = .06;
    navigationRaycaster.far = maxHit;
    if (navigationRaycaster.intersectObjects(wallVisuals, false).length) return false;
  }
  return true;
}
function buildBackroomNavigationGraph() {
  navWorldPoints.clear(); navGridLookup.clear();
  const graph = new YUKA.Graph();
  if (!backroomBounds) return graph;
  const spacing = 1.8, margin = 1.35;
  const minX = backroomBounds.min.x + margin, maxX = backroomBounds.max.x - margin;
  const minZ = backroomBounds.min.z + margin, maxZ = backroomBounds.max.z - margin;
  const columns = Math.floor((maxX - minX) / spacing) + 1;
  const rows = Math.floor((maxZ - minZ) / spacing) + 1;
  for (let iz = 0; iz < rows; iz++) for (let ix = 0; ix < columns; ix++) {
    const point = new THREE.Vector3(minX + ix * spacing, 0, minZ + iz * spacing);
    if (!isBackroomPointClear(point, .76)) continue;
    const id = navWorldPoints.size;
    navWorldPoints.set(id, point); navGridLookup.set(ix + ',' + iz, id);
    graph.addNode(new YUKA.Node(id));
  }
  for (const [key, id] of navGridLookup) {
    const [ix, iz] = key.split(',').map(Number), point = navWorldPoints.get(id);
    for (const [dx, dz] of [[1, 0], [0, 1]]) {
      const nextId = navGridLookup.get((ix + dx) + ',' + (iz + dz));
      if (nextId === undefined) continue;
      const nextPoint = navWorldPoints.get(nextId);
      if (!navigationSegmentClear(point, nextPoint)) continue;
      graph.addEdge(new YUKA.Edge(id, nextId, 1));
      graph.addEdge(new YUKA.Edge(nextId, id, 1));
    }
  }
  console.info('Backrooms navigation built:', navWorldPoints.size, 'walkable nodes');
  return graph;
}
function buildNavigationGraph() {
  navWorldPoints.clear(); navGridLookup.clear();
  if (backroomLoaded && backroomBounds) return buildBackroomNavigationGraph();
  const graph = new YUKA.Graph();
  for (const label of walkable) { const [r,c] = label.split(',').map(Number); graph.addNode(new YUKA.Node(r*COLS+c)); }
  for (const label of walkable) {
    const [r,c] = label.split(',').map(Number), a = r*COLS+c;
    for (const [nr,nc] of [[r+1,c],[r-1,c],[r,c+1],[r,c-1]]) if (openCell(nr,nc)) graph.addEdge(new YUKA.Edge(a,nr*COLS+nc,1));
  }
  return graph;
}
function nearestNode(pos) {
  if (backroomLoaded && navWorldPoints.size) {
    let best = -1, distance = Infinity;
    for (const [id, point] of navWorldPoints) {
      const dx = point.x - pos.x, dz = point.z - pos.z, d = dx * dx + dz * dz;
      if (d < distance) { best = id; distance = d; }
    }
    return best;
  }
  const cell = toCell(pos); if (openCell(cell.row,cell.col)) return cell.row*COLS+cell.col;
  let best=0,dist=Infinity;
  for (const label of walkable) { const [r,c] = label.split(',').map(Number), p=cellPos(r,c), d=p.distanceToSquared(new THREE.Vector3(pos.x,0,pos.z)); if(d<dist){best=r*COLS+c;dist=d;} }
  return best;
}
function nearestNavigationPoint(preferred, excluded = [], minSpacing = 0) {
  if (!backroomLoaded || !navWorldPoints.size) return findSafeEnvironmentPosition(preferred, CELL);
  const minDistanceSq = minSpacing * minSpacing;
  let candidates = [...navWorldPoints.values()].filter(point => excluded.every(other => point.distanceToSquared(other) >= minDistanceSq));
  if (!candidates.length) candidates = [...navWorldPoints.values()];
  let best = null, bestDistance = Infinity;
  for (const point of candidates) {
    const distance = (point.x - preferred.x) ** 2 + (point.z - preferred.z) ** 2;
    if (distance < bestDistance) { best = point; bestDistance = distance; }
  }
  return best ? best.clone() : preferred.clone().setY(0);
}
function findPath(from,to) {
  const a=nearestNode(from), b=nearestNode(to);
  if (a < 0 || b < 0) return [];
  const toPosition = id => backroomLoaded && navWorldPoints.has(id)
    ? navWorldPoints.get(id).clone()
    : cellPos(Math.floor(id/COLS),id%COLS);
  if(a===b) return [toPosition(a)];
  const search=new YUKA.BFS(navGraph,a,b); search.search();
  const path=search.getPath();
  if (backroomLoaded && path.length < 2) return [];
  return path.map(toPosition);
}
function createHunterFallback() {
  enemyFallback = true;
  const skin = new THREE.MeshStandardMaterial({ color:0x101012, roughness:.95, emissive:0x180209, emissiveIntensity:.4 });
  const bone = mat(0x282329,.85), eye = new THREE.MeshStandardMaterial({ color:0xb10c18, emissive:0xff0018, emissiveIntensity:3.5 });
  enemyModel = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.28,.72,4,8),skin); torso.position.y=1.03; enemyModel.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.235,10,8),bone); head.scale.set(.82,1.12,.9); head.position.set(0,1.66,.03); enemyModel.add(head);
  for (const side of [-1,1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(.09,.65,3,6),skin); arm.position.set(side*.37,1.02,.02); arm.rotation.z=-side*.22; enemyModel.add(arm);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(.115,.62,3,6),bone); leg.position.set(side*.16,.34,0); enemyModel.add(leg);
    const e = new THREE.Mesh(new THREE.SphereGeometry(.035,7,6),eye); e.position.set(side*.085,1.68,.22); enemyModel.add(e);
  }
}
async function loadOptionalAssets() {
  const loader = new GLTFLoader();
  const tryLoad = async (url) => {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (!response.ok) return null;
      return await loader.loadAsync(url);
    } catch { return null; }
  };

  // Prefer the user's animated horror creature, then their rigged character, then the CC0 fallback.
  let assetUrl = '/assets/the_human_deer.glb';
  let gltf = await tryLoad(assetUrl);
  const hasDeer = Boolean(gltf);
  if (!gltf) {
    assetUrl = '/assets/Meshy_AI_Character_output.glb';
    gltf = await tryLoad(assetUrl);
  }
  if (!gltf) {
    assetUrl = '/assets/RobotExpressive.glb';
    gltf = await tryLoad(assetUrl);
  }

  if (gltf) {
    enemyGroup = new THREE.Group();
    enemyModel = gltf.scene;
    enemyAssetName = assetUrl.split('/').pop();
    enemyModel.traverse(node => {
      if (!node.isMesh) return;
      node.castShadow = false;
      node.receiveShadow = false;
      // Keep user-authored textures/materials. Only darken the generic robot fallback.
      if (assetUrl.endsWith('RobotExpressive.glb')) {
        const darken = material => {
          const copy = material.clone();
          if (copy.color) copy.color.set(0x121114);
          return copy;
        };
        node.material = Array.isArray(node.material) ? node.material.map(darken) : darken(node.material);
      }
    });
    enemyModel.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(enemyModel);
    const height = Math.max(.1, bounds.max.y - bounds.min.y);
    const targetHeight = hasDeer ? 2.35 : 1.82;
    const scale = targetHeight / height;
    enemyModel.scale.setScalar(scale);
    enemyModel.position.y = -bounds.min.y * scale;
    enemyGroup.add(enemyModel);
    if (gltf.animations?.length) {
      enemyMixer = new THREE.AnimationMixer(enemyModel);
      for (const clip of gltf.animations) enemyClips[clip.name.toLowerCase()] = clip;
      enemyProcedural = false;
    } else {
      // A skinned GLB without clips still gets visible bob, lean, and root motion while moving.
      enemyProcedural = true;
    }
    enemyFallback = false;
  }

  if (!enemyGroup) {
    enemyGroup = new THREE.Group();
    createHunterFallback();
    enemyGroup.add(enemyModel);
    enemyProcedural = true;
    enemyAssetName = 'procedural hunter (asset fallback)';
  }

  // Load the secondary rig independently. It has no embedded clips, so its apparition lunge is procedural.
  const apparitionGltf = await tryLoad('/assets/Meshy_AI_Character_output.glb');
  if (apparitionGltf) {
    apparitionGroup = new THREE.Group();
    apparitionModel = apparitionGltf.scene;
    apparitionModel.traverse(node => { if(node.isMesh){node.castShadow=false;node.receiveShadow=false;} });
    apparitionModel.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(apparitionModel);
    const height = Math.max(.1,bounds.max.y-bounds.min.y);
    const scale = 1.82/height;
    apparitionModel.scale.setScalar(scale);
    apparitionModel.position.y = -bounds.min.y*scale;
    apparitionGroup.add(apparitionModel);
    apparitionGroup.visible=false;
    scene.add(apparitionGroup);
  }

  enemyLight = new THREE.PointLight(0xb00b1b,.75,3,2);
  enemyLight.position.set(0,1.5,.14);
  enemyGroup.add(enemyLight);
  scene.add(enemyGroup);
  enemyGroup.position.copy(enemySpawn || cellPos(2,8));
  // Add the licensed CC0 tile as a small, optional dressing piece if its first-run download succeeded.
  try {
    const tileUrl = '/assets/corridor-floor-tile.glb';
    const tileResponse = await fetch(tileUrl, { method: 'HEAD' });
    if (tileResponse.ok) {
      const tileGltf = await loader.loadAsync(tileUrl);
      const tile = tileGltf.scene;
      tile.traverse((node) => {
        if (!node.isMesh) return;
        node.castShadow = false; node.receiveShadow = false;
        const shade = (material) => {
          const copy = material.clone();
          if (copy.color) copy.color.multiplyScalar(0.3);
          if ('roughness' in copy) copy.roughness = 0.96;
          return copy;
        };
        node.material = Array.isArray(node.material) ? node.material.map(shade) : shade(node.material);
      });
      const p = cellPos(9, 5);
      tile.scale.setScalar(CELL / 2);
      tile.position.set(p.x, -0.005, p.z);
      tile.rotation.y = Math.PI / 2;
      scene.add(tile);
    }
  } catch { /* Optional asset: missing or malformed tile never blocks startup. */ }
}
function setupRenderer() {
  renderer = new THREE.WebGLRenderer({canvas:$('game-canvas'),antialias:false,powerPreference:'high-performance',stencil:false});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.25)); renderer.setSize(innerWidth,innerHeight,false);
  renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=.84;
  scene = new THREE.Scene(); scene.background=new THREE.Color(0x030406); scene.fog=new THREE.FogExp2(0x080a0d,.0175);
  camera = new THREE.PerspectiveCamera(74,innerWidth/innerHeight,.05,90); camera.position.set(0,1.45,0); scene.add(camera);
  controls = new PointerLockControls(camera,document.body); controls.pointerSpeed=.78; controls.minPolarAngle=.2; controls.maxPolarAngle=Math.PI-.2;
  controls.addEventListener('unlock',()=>{if(state==='playing')pauseRun();});
  camera.add(new THREE.AudioListener());
  scene.add(new THREE.HemisphereLight(0x5d6b78,0x080607,.42),new THREE.AmbientLight(0x4e515c,.12));
  flashlight = new THREE.SpotLight(0xe4efff,62,23,Math.PI/7.2,.42,1.5);
  flashlight.position.set(0,-.04,.05); flashlightTarget=new THREE.Object3D(); flashlightTarget.position.set(0,-.03,-1);
  camera.add(flashlight,flashlightTarget); flashlight.target=flashlightTarget;
  // CSS film grain/vignette preserve atmosphere without an expensive full-screen GPU pipeline.
  // Keep postprocessing available for future quality tiers; direct rendering is the safe baseline.
  window.addEventListener('resize',onResize);
}
function onResize(){if(!camera||!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight,false);composer?.setSize(innerWidth,innerHeight);}
function setupPhysics() {
  world = new RAPIER.World({x:0,y:-15.5,z:0}); world.timestep=1/60;
  const floor=world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,-.24,0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(COLS*CELL/2,.12,ROWS*CELL/2),floor);
  const start=cellPos(9,5);
  playerBody=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(start.x,.88,start.z));
  playerCollider=world.createCollider(RAPIER.ColliderDesc.capsule(.58,.29),playerBody);
  kcc=world.createCharacterController(.03); kcc.setApplyImpulsesToDynamicBodies(false); kcc.setSlideEnabled(true); kcc.setMaxSlopeClimbAngle(Math.PI/4.2);
}
function initAudio() {
  if(audioReady)return;
  try {
    const listener=camera.children.find(c=>c.isAudioListener); audioContext=listener?.context; if(!audioContext)return;
    masterGain=audioContext.createGain(); masterGain.gain.value=.2; masterGain.connect(listener.getInput());
    const droneGain=audioContext.createGain(); droneGain.gain.value=.055; droneGain.connect(masterGain);
    [48.5,50.1].forEach((hz,i)=>{const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.type=i?'triangle':'sine';osc.frequency.value=hz;gain.gain.value=i?.1:.2;osc.connect(gain).connect(droneGain);osc.start();});
    audioReady=true;
  } catch { /* Sound is an enhancement; it is not needed to complete the game. */ }
}
function cue(type,volume=.12) {
  if(!audioReady||!audioContext)return;
  try {
    const profiles={pickup:[680,420,.17,'triangle'],door:[92,34,.75,'sawtooth'],step:[77,38,.12,'sine'],heartbeat:[58,41,.24,'sine'],sting:[230,28,.8,'sawtooth'],click:[960,410,.045,'square']};
    const [start,end,duration,wave]=profiles[type]||profiles.click,now=audioContext.currentTime;
    const osc=audioContext.createOscillator(),gain=audioContext.createGain();
    osc.type=wave;osc.frequency.setValueAtTime(start,now);osc.frequency.exponentialRampToValueAtTime(Math.max(1,end),now+duration);
    gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(volume,now+.012);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
    osc.connect(gain).connect(masterGain);osc.start(now);osc.stop(now+duration+.03);
  }catch{/* Ignore unsupported Web Audio paths. */}
}
function showMessage(text,seconds=2.8){const el=$('message');el.textContent=text;el.classList.remove('hidden');messageTimer=seconds;}
function setThreat(value) {
  threat=THREE.MathUtils.clamp(value,0,1); $('threat-indicator').classList.toggle('visible',threat>.15);
  $('vignette').style.background='radial-gradient(ellipse at center, transparent 26%, rgba(0,0,0,'+(0.28+threat*.48)+') 76%, rgba(24,0,3,'+(threat*.48)+') 130%)';
}
function updateHud() {
  $('battery-number').textContent=Math.ceil(battery)+'%'; $('battery-fill').style.width=battery+'%'; $('battery-fill').style.background=battery<22?'#bd343b':'#c4bca6';
  const count=signalStations.filter(item=>item.userData.activated).length;
  [...$('signal-pips').children].forEach((pip,i)=>pip.classList.toggle('filled',i<count));
  $('objective-text').textContent=isPlayerHidden?'HIDDEN // HOLD STILL':count<3?'Synchronize echo relays ('+count+'/3)':'Return to the inversion receiver';
  $('location-label').textContent=enemyMode==='CHASE'?'ST. AGNES / MOVEMENT DETECTED':'ST. AGNES / RECOVERY WING';
}
function startRun() {
  if(!world||!controls)return;
  state='playing';elapsed=0;battery=100;flashlightOn=true;flashlight.visible=true;exitOpen=false;finaleActive=false;finaleClock=0;enemyMode='LURK';threat=0;searchClock=0;pathClock=0;verticalSpeed=0;bob=0;footstep=0;apparitionActive=false;apparitionClock=0;nextApparitionAt=32;isPlayerHidden=false;currentHideSpot=null;$('hide-overlay')?.classList.add('hidden');
  if(apparitionGroup)apparitionGroup.visible=false;
  if(houseGroup){scene.remove(houseGroup);houseGroup=null;houseMixer=null;}
  for(const station of signalStations){
    station.userData.activated=false;station.userData.panel.material.emissiveIntensity=.12;station.userData.panel.material.color.set(0x4a151b);
    station.userData.orb.material.emissiveIntensity=.5;station.userData.orb.material.color.set(0x8c2026);
    station.userData.glow.intensity=.24;station.userData.ring.material=M.metal;
  }
  if(receiverConsole){receiverConsole.userData.screenMaterial.emissiveIntensity=.36;receiverConsole.userData.glow.intensity=.28;receiverConsole.userData.buttonMaterial.emissiveIntensity=.22;}
  const start=(playerSpawn || cellPos(9,5)).clone();playerBody.setTranslation({x:start.x,y:.88,z:start.z},true);
  enemyGroup.position.copy(enemySpawn || cellPos(2,8));enemyPath=[];enemyPathIndex=0;patrolTarget=null;lastKnown.copy(start);
  $('title-screen').classList.add('hidden');$('pause-screen').classList.add('hidden');$('end-screen').classList.add('hidden');$('hud').classList.remove('hidden');$('interaction-prompt').classList.add('hidden');
  updateHud();initAudio();controls.lock();showMessage('Do not escape. Break the broadcast before it learns your name.',4.5);
}
function pauseRun(){if(state!=='playing')return;state='paused';$('pause-screen').classList.remove('hidden');$('hud').classList.add('hidden');}
function resumeRun(){state='playing';$('pause-screen').classList.add('hidden');$('hud').classList.remove('hidden');controls.lock();}
function endRun(won) {
  if(state==='won'||state==='lost')return;state=won?'won':'lost';controls.unlock();$('hud').classList.add('hidden');$('pause-screen').classList.add('hidden');$('end-screen').classList.remove('hidden');
  $('end-eyebrow').textContent=won?'ST. AGNES // DISCHARGE PAPERS':'ST. AGNES // INCIDENT REPORT';
  $('end-title').textContent=won?'YOU GOT OUT.':'PATIENT NOT FOUND.';
  $('end-copy').textContent=won?'The receiver accepts the inversion. The maze goes silent. Then a front door opens somewhere inside the backroom. The monitor prints: SUBJECT 09 HAS BEEN COPIED. The intercom speaks in your voice, from somewhere behind you: “Welcome home.”':'The Attendant reaches you. The intercom announces: “Subject 09 returned to containment.” A monitor begins beeping beneath the silence.';
  cue(won?'door':'sting',won?.12:.3);
}
function toggleFlashlight(){if(state!=='playing')return;if(battery<=.5){flashlightOn=false;flashlight.visible=false;showMessage('The flashlight battery is dead.',1.8);cue('click');return;}flashlightOn=!flashlightOn;flashlight.visible=flashlightOn;cue('click',.08);}
function interact(target) {
  if(!target)return;
  const data=target.userData||{};
  if(data.targetType==='hidingSpot'){if(isPlayerHidden)leaveHideSpot();else enterHideSpot(target);return;}
  if(data.targetType==='station'){
    if(data.activated){showMessage(data.name+' is already synchronized. It is still listening.',2.6);return;}
    data.activated=true;
    data.panel.material.color.set(0x6f2029);data.panel.material.emissiveIntensity=1.6;
    data.orb.material.color.set(0xf03a48);data.orb.material.emissiveIntensity=3.2;
    data.glow.color.set(0xe51d31);data.glow.intensity=1.25;
    data.ring.material=new THREE.MeshStandardMaterial({color:0xb73842,emissive:0x67111b,emissiveIntensity:.9,metalness:.55,roughness:.3});
    cue('pickup',.22);
    setThreat(Math.max(threat,.18+signalStations.filter(item=>item.userData.activated).length*.17));
    const count=signalStations.filter(item=>item.userData.activated).length;
    showMessage(count<3?data.phase+' synchronized. Something just learned where you are.':'All three relays are live. Return to the receiver and invert the signal.',4.2);
    if(count===3){enemyMode='CHASE';lastKnown.copy(camera.position);planPath(camera.position);pathClock=0;cue('sting',.48);}
    updateHud();return;
  }
  if(data.targetType==='receiver'){
    const count=signalStations.filter(item=>item.userData.activated).length;
    if(count<3){showMessage('INVERSION DENIED. Echo relays active: '+count+'/3. The system will not accept a partial signal.',3.4);cue('click',.08);return;}
    beginFinale();return;
  }
  if(data.targetType==='note'){showMessage('THE LAST HANDWRITTEN NOTE: “It is not inside the house. The house is how it gets inside you.”',5.5);cue('pickup',.1);}
}
function findInteraction() {
  nearestInteractable=null;$('interaction-prompt').classList.add('hidden');$('crosshair').classList.remove('active');
  if(state!=='playing')return;
  if(isPlayerHidden && currentHideSpot){nearestInteractable=currentHideSpot;$('interaction-text').textContent='Leave hiding place';$('interaction-prompt').classList.remove('hidden');return;}
  raycaster.setFromCamera(new THREE.Vector2(0,0),camera);raycaster.far=3.0;
  const roots=interactive.filter(o=>o.visible),hits=raycaster.intersectObjects(roots,true);
  for(const hit of hits){
    let root=hit.object;
    while(root&&root!==scene&&root.userData?.targetType===undefined)root=root.parent;
    if(root&&root.userData?.targetType!==undefined){nearestInteractable=root;const type=root.userData.targetType;$('interaction-text').textContent=type==='station'?(root.userData.activated?'Inspect '+root.userData.name:'Synchronize '+root.userData.name):type==='receiver'?'Invert the signal':type==='note'?'Read the note':type==='hidingSpot'?'Hide in locker':'Interact';$('interaction-prompt').classList.remove('hidden');$('crosshair').classList.add('active');break;}
  }
  if(!nearestInteractable){
    const pos=camera.position;
    const close=interactive.find(item=>item.visible&&item.position.distanceTo(pos)<2.1&&['station','receiver','note','hidingSpot'].includes(item.userData?.targetType));
    if(close){nearestInteractable=close;const type=close.userData.targetType;$('interaction-text').textContent=type==='station'?(close.userData.activated?'Inspect '+close.userData.name:'Synchronize '+close.userData.name):type==='receiver'?'Invert the signal':type==='note'?'Read the note':'Hide in locker';$('interaction-prompt').classList.remove('hidden');}
  }
}
function handleInput(dt) {
  if(isPlayerHidden && currentHideSpot){camera.position.set(currentHideSpot.position.x,1.45,currentHideSpot.position.z);camera.updateMatrixWorld();findInteraction();if(messageTimer>0){messageTimer-=dt;if(messageTimer<=0)$('message').classList.add('hidden');}updateHud();return;}
  const running=moveKeys.has('ShiftLeft')||moveKeys.has('ShiftRight');
  const speed=running?5.25:3.05;
  const x=Number(moveKeys.has('KeyD'))-Number(moveKeys.has('KeyA')),z=Number(moveKeys.has('KeyW'))-Number(moveKeys.has('KeyS'));
  camera.getWorldDirection(forward);forward.y=0;forward.normalize();right.crossVectors(forward,camera.up).normalize();
  move.set(0,0,0);if(z)move.addScaledVector(forward,z);if(x)move.addScaledVector(right,x);if(move.lengthSq()>1)move.normalize();
  const current=playerBody.translation();verticalSpeed-=15.5*dt;if(current.y<.89&&verticalSpeed<0)verticalSpeed=0;
  const desired={x:move.x*speed*dt,y:verticalSpeed*dt,z:move.z*speed*dt};
  lastDesired = { x: desired.x, y: desired.y, z: desired.z };
  kcc.computeColliderMovement(playerCollider,desired);const actual=kcc.computedMovement();
  lastActual = { x: actual.x, y: actual.y, z: actual.z };
  playerBody.setNextKinematicTranslation({x:current.x+actual.x,y:Math.max(.88,current.y+actual.y),z:current.z+actual.z});
  const moving=move.lengthSq()>.01;
  if(moving){bob+=dt*(running?13:8);footstep+=dt;if(footstep>(running?.34:.5)){footstep=0;cue('step',running?.11:.06);}if(running&&Math.random()<dt*.12)lastKnown.set(current.x,0,current.z);}
  else{bob*=.92;footstep=0;}
  const t=playerBody.translation();camera.position.set(t.x,t.y+.57+(moving?Math.sin(bob)*(running?.045:.022):0),t.z);camera.updateMatrixWorld();
  if(flashlightOn&&battery>0){battery=Math.max(0,battery-dt*.105);flashlight.intensity=62*(battery<16?.63+Math.sin(elapsed*17)*.18:1);if(battery<=0){flashlightOn=false;flashlight.visible=false;showMessage('The flashlight sputters out.',2);cue('click',.08);}}
  findInteraction();if(messageTimer>0){messageTimer-=dt;if(messageTimer<=0)$('message').classList.add('hidden');}updateHud();
}
function canSeePlayer() {
  const origin=enemyGroup.position.clone();origin.y+=1.35;const target=camera.position.clone(),delta=target.clone().sub(origin),dist=delta.length();
  if(dist>15)return false;
  raycaster.set(origin,delta.normalize());raycaster.far=dist-.4;return raycaster.intersectObjects(wallVisuals,false).length===0;
}
function planPath(target){enemyPath=findPath(enemyGroup.position,target);enemyPathIndex=enemyPath.length>1?1:0;}
function choosePatrol() {
  if (backroomLoaded && navWorldPoints.size) {
    const here = enemyGroup.position;
    const candidates = [...navWorldPoints.values()].filter(point => {
      const d = Math.hypot(point.x - here.x, point.z - here.z);
      return d >= 5.5 && d <= 18;
    });
    patrolTarget = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)].clone() : null;
    if (patrolTarget) planPath(patrolTarget);
    return;
  }
  const spots=[[1,2],[1,7],[3,5],[5,2],[5,8],[8,7],[3,6],[7,6]].filter(([r,c])=>openCell(r,c));
  const at=toCell(enemyGroup.position),choices=spots.filter(([r,c])=>r!==at.row||c!==at.col),spot=choices[Math.floor(Math.random()*choices.length)]||[5,5];
  patrolTarget=cellPos(spot[0],spot[1]);planPath(patrolTarget);
}
function currentHunterWaypoint(fallbackTarget) {
  if (backroomLoaded) return enemyPath[enemyPathIndex] || null;
  return enemyPath[enemyPathIndex] || fallbackTarget;
}
function moveHunterToward(target,speed,dt) {
  if(!target)return;
  const offset=target.clone().sub(enemyGroup.position);offset.y=0;const dist=offset.length();
  if(dist<.3){enemyPathIndex++;return;}
  offset.normalize();
  const step=Math.min(dist,speed*dt);
  const candidate=enemyGroup.position.clone().addScaledVector(offset,step);
  // The route is generated from the imported geometry; guard each short move as well to avoid
  // the creature clipping through a wall if a thin feature falls between graph samples.
  if(backroomLoaded && (!navigationSegmentClear(enemyGroup.position,candidate) || !isBackroomPointClear(candidate,.5))) {
    pathClock=0;
    return;
  }
  enemyGroup.position.copy(candidate);enemyGroup.position.y=0;
  enemyGroup.rotation.y=Math.atan2(-offset.x,-offset.z);
  const sprinting=enemyMode==='CHASE';
  if(enemyModel){
    enemyModel.rotation.z=Math.sin(elapsed*(sprinting?14:5.2))*(sprinting?.045:.015);
    if(enemyProcedural){
      enemyModel.rotation.x=Math.sin(elapsed*(sprinting?11:5.2))*(sprinting?.035:.025);
      enemyModel.position.y=Math.sin(elapsed*(sprinting?15:7))*(sprinting?.065:.04);
    }
  }
}
function animateEnemyClip(name) {
  if(!enemyMixer)return;const found=Object.keys(enemyClips).find(n=>n.includes(name))||Object.keys(enemyClips).find(n=>n.includes('idle'))||Object.keys(enemyClips)[0];if(!found)return;
  const action=enemyMixer.clipAction(enemyClips[found]);if(enemyMixer._activeAction===action)return;const old=enemyMixer._activeAction;if(old)old.fadeOut(.2);action.reset().fadeIn(.2).play();enemyMixer._activeAction=action;
}
function updateEnemy(dt) {
  if(!enemyGroup)return;const player=camera.position.clone();player.y=0;const distance=enemyGroup.position.distanceTo(player),sees=canSeePlayer();
  const facing=flashlightOn&&battery>0&&distance<10&&camera.getWorldDirection(direction)&&direction.dot(enemyGroup.position.clone().sub(camera.position).normalize())>.89;
  if(distance<1.22&&!isPlayerHidden){endRun(false);return;}
  if(!isPlayerHidden&&sees&&(distance<12||(moveKeys.has('ShiftLeft')||moveKeys.has('ShiftRight'))&&distance<17)){if(enemyMode!=='CHASE'){enemyMode='CHASE';cue('sting',.22);showMessage('RUN. IT HAS SEEN YOU.',2.2);}lastKnown.copy(player);searchClock=0;}
  else if(enemyMode==='CHASE'){enemyMode='SEARCH';searchClock=0;planPath(lastKnown);}
  if(facing&&distance<5.2)threat=Math.max(threat,.72);pathClock-=dt;
  if(enemyMode==='LURK'){
    if(!patrolTarget||enemyPathIndex>=enemyPath.length||pathClock<=0){choosePatrol();pathClock=2.4+Math.random()*1.5;}
    moveHunterToward(currentHunterWaypoint(patrolTarget),1.35,dt);
    setThreat(distance<10?Math.max(threat*.98,(10-distance)/15):Math.max(0,threat-dt*.12));
  }else if(enemyMode==='CHASE'){
    if(pathClock<=0){planPath(player);pathClock=.48;}
    moveHunterToward(currentHunterWaypoint(player),facing?3.15:5.85,dt);setThreat(Math.min(1,threat+dt*.8));
    heartbeatClock+=dt;if(distance<5&&heartbeatClock>1.05){heartbeatClock=0;cue('heartbeat',threat*.17);}
  }else{
    searchClock+=dt;if(pathClock<=0){planPath(lastKnown);pathClock=.85;}
    moveHunterToward(currentHunterWaypoint(lastKnown),2.25,dt);setThreat(Math.max(0,threat-dt*.13));
    if(searchClock>4.3||enemyGroup.position.distanceTo(lastKnown)<1){enemyMode='LURK';patrolTarget=null;pathClock=0;}
  }
  if(enemyMixer){animateEnemyClip(enemyMode==='CHASE'?'running':enemyMode==='LURK'?'walking':'walking');enemyMixer.timeScale=enemyMode==='CHASE'?2.05:enemyMode==='SEARCH'?1.2:.92;enemyMixer.update(dt);}
  if(enemyLight)enemyLight.intensity=enemyMode==='CHASE'?1.35:.6;
}
function updateApparition(dt) {
  if (!apparitionGroup || state !== 'playing') return;
  const player = camera.position.clone();
  player.y = 0;

  if (!apparitionActive) {
    if (elapsed < nextApparitionAt || enemyMode === 'CHASE') return;
    if (enemyGroup && enemyGroup.position.distanceTo(player) < 8) {
      nextApparitionAt = elapsed + 3.5;
      return;
    }
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < .01) return;
    forward.normalize();
    apparitionGroup.position.copy(player).addScaledVector(forward, 4.15);
    apparitionGroup.position.y = 0;
    apparitionGroup.rotation.y = Math.atan2(-forward.x, -forward.z);
    apparitionGroup.scale.setScalar(.92);
    apparitionGroup.visible = true;
    apparitionActive = true;
    apparitionClock = .72;
    nextApparitionAt = elapsed + 62 + Math.random() * 23;
    cue('sting', .9);
    setThreat(Math.max(threat, .86));
    return;
  }

  apparitionClock -= dt;
  const toPlayer = player.clone().sub(apparitionGroup.position);
  toPlayer.y = 0;
  const distance = toPlayer.length();
  if (distance > .05) {
    toPlayer.normalize();
    apparitionGroup.position.addScaledVector(toPlayer, Math.min(distance, 6.6 * dt));
    apparitionGroup.rotation.y = Math.atan2(-toPlayer.x, -toPlayer.z);
  }
  const lungeProgress = THREE.MathUtils.clamp(1 - apparitionClock / .72, 0, 1);
  apparitionGroup.scale.setScalar(.92 + lungeProgress * .28);
  if (distance < .82 || apparitionClock <= 0) {
    apparitionGroup.visible = false;
    apparitionActive = false;
    apparitionGroup.scale.setScalar(.92);
  }
}
function updateSignalStationMotion() {
  for (const station of signalStations) {
    if (!station.visible) continue;
    const phase = station.userData.phaseOffset || 0;
    station.userData.orb.rotation.y += .012;
    station.userData.orb.position.y = 1.38 + Math.sin(elapsed * 1.7 + phase) * .045;
    station.userData.ring.rotation.z = Math.sin(elapsed * .55 + phase) * .09;
    if (!station.userData.activated) station.userData.glow.intensity = .18 + (Math.sin(elapsed * 2.2 + phase) + 1) * .035;
  }
}
function flicker(dt) {
  for(const lamp of lamps){lamp.clock+=dt;const broken=Math.sin(lamp.clock*2.7)>.94||Math.sin(lamp.clock*1.4)<-.97;lamp.light.intensity=broken?.08:lamp.base*(.82+Math.sin(lamp.clock*1.8)*.12);lamp.tube.material.emissiveIntensity=broken?.06:.55+lamp.base*.45;}
}
function beginFinale() {
  if(finaleActive||state!=='playing')return;
  finaleActive=true;finaleClock=0;
  receiverConsole.userData.screenMaterial.emissiveIntensity=2.4;
  receiverConsole.userData.buttonMaterial.emissiveIntensity=2.5;
  receiverConsole.userData.glow.intensity=2;
  enemyMode='CHASE';setThreat(1);cue('sting',.9);
  showMessage('SIGNAL INVERTED. Do not turn around. Something is opening your front door.',5.5);
  loadFinalHouse();
}
function updateDoor(dt) {
  if(!finaleActive)return;
  finaleClock+=dt;
  if(houseMixer)houseMixer.update(dt);
  if(finaleClock>6.5)endRun(true);
}
async function initialise() {
  $('loading-screen').classList.remove('hidden');
  setupRenderer();await RAPIER.init();setupPhysics();
  backroomLoaded=await loadBackroomEnvironment();
  navGraph=buildNavigationGraph();
  if(backroomLoaded){
    playerSpawn=nearestNavigationPoint(new THREE.Vector3(0,0,6));
    buildHidingSpots();
    navGraph=buildNavigationGraph();
    playerSpawn=nearestNavigationPoint(playerSpawn);
    enemySpawn=nearestNavigationPoint(cellPos(2,8),[playerSpawn],10);
    drawBackroomLighting();
  }else{
    playerSpawn=cellPos(9,5);enemySpawn=cellPos(2,8);drawHospital();
  }
  buildSignalStations();buildReceiverConsole();
  await loadOptionalAssets();
  $('loading-screen').classList.add('hidden');
}
$('start-button').addEventListener('click',()=>startRun());
$('resume-button').addEventListener('click',()=>resumeRun());
$('restart-button').addEventListener('click',()=>startRun());
$('play-again-button').addEventListener('click',()=>startRun());
document.addEventListener('keydown',e=>{if(['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight'].includes(e.code))moveKeys.add(e.code);if(e.code==='KeyF'&&!e.repeat)toggleFlashlight();if(e.code==='KeyE'&&!e.repeat&&state==='playing')interact(nearestInteractable);if(e.code==='Escape'&&state==='playing'&&!controls?.isLocked)pauseRun();});
document.addEventListener('keyup',e=>moveKeys.delete(e.code));
initialise().catch(error=>{initializationError=error?.stack||String(error);console.error('Hollow Ward initialisation failed.',error);$('loading-screen').classList.add('hidden');$('title-screen').classList.remove('hidden');const card=document.querySelector('.story-card');if(card)card.insertAdjacentHTML('beforeend','<p style="color:#d56b70">Initialisation failed. Check WebGL support and run npm install before starting the game.</p>');});
if (import.meta.env.DEV || new URLSearchParams(window.location.search).has('smokeTest')) {
  Object.defineProperty(window, '__HOLLOW_WARD__', { configurable: true, value: {
    get ready() { return Boolean(scene && world && controls && kcc && enemyGroup); },
    get frameCount() { return frameCount; },
    stepForTest(frames = 60) {
      const count = Math.max(1, Math.min(300, Math.floor(frames)));
      const dt = 1 / 60;
      for (let i = 0; i < count; i++) {
        if (state !== 'playing') break;
        handleInput(dt);
        world.timestep = dt;
        world.step();
      }
      const t = playerBody.translation();
      camera.position.set(t.x, t.y + .57, t.z);
      camera.updateMatrixWorld();
      return this.playerPosition;
    },
    get state() { return state; },
    get error() { return initializationError; },
    get playerPosition() { if (!playerBody) return null; const p = playerBody.translation(); return { x: p.x, y: p.y, z: p.z }; },
    get inputKeys() { return Array.from(moveKeys); },
    get desiredMovement() { return { ...lastDesired }; },
    get actualMovement() { return { ...lastActual }; },
    get pointerLocked() { return Boolean(controls?.isLocked); },
    get collisions() { if (!kcc) return 0; return kcc.numComputedCollisions(); },
    get facing() { if (!camera) return null; return camera.getWorldDirection(new THREE.Vector3()).toArray(); },
    get monsterAsset() { return enemyAssetName; },
    get monsterHasAnimation() { return Boolean(enemyMixer); },
    get apparitionVisible() { return Boolean(apparitionGroup?.visible); },
    get backroomLoaded() { return backroomLoaded; },
    get finaleActive() { return finaleActive; },
    get relayCount() { return signalStations.filter(item=>item.userData.activated).length; },
    get enemyPosition() { return enemyGroup ? {x:enemyGroup.position.x,y:enemyGroup.position.y,z:enemyGroup.position.z} : null; },
    get enemyMode() { return enemyMode; },
    get hidden() { return isPlayerHidden; },
    get hidingSpotCount() { return hidingSpots.length; },
    get navigationNodeCount() { return backroomLoaded ? navWorldPoints.size : walkable.size; },
    startHunterTestChase() { enemyMode='CHASE';lastKnown.copy(camera.position);planPath(camera.position);pathClock=0;return {mode:enemyMode,pathLength:enemyPath.length}; },
    advanceHunterForTest(frames=30) { const count=Math.max(1,Math.min(180,Math.floor(frames))),dt=1/60;for(let i=0;i<count;i++){if(state!=='playing')break;updateEnemy(dt);}return this.enemyPosition; },
    get enemyPosition() { return enemyGroup ? {x:enemyGroup.position.x,y:enemyGroup.position.y,z:enemyGroup.position.z} : null; },
    get enemyMode() { return enemyMode; },
    get hidden() { return isPlayerHidden; },
    get hidingSpotCount() { return hidingSpots.length; },
    get navigationNodeCount() { return backroomLoaded ? navWorldPoints.size : walkable.size; },
    startHunterTestChase() { enemyMode='CHASE';lastKnown.copy(camera.position);planPath(camera.position);pathClock=0;return {mode:enemyMode,pathLength:enemyPath.length}; },
    advanceHunterForTest(frames=30) { const count=Math.max(1,Math.min(180,Math.floor(frames))),dt=1/60;for(let i=0;i<count;i++){if(state!=='playing')break;updateEnemy(dt);}return this.enemyPosition; },
  }});
}
function animate() {
  requestAnimationFrame(animate);frameCount++;const dt=Math.min(clock.getDelta(),.1);
  if(state==='playing'){elapsed+=dt;if(!finaleActive)handleInput(dt);world.timestep=dt;world.step();if(!finaleActive)updateEnemy(dt);updateApparition(dt);updateSignalStationMotion();flicker(dt);updateDoor(dt);if(audioReady&&audioContext?.state==='suspended')audioContext.resume().catch(()=>{});}
  if(composer)composer.render(dt);else if(renderer&&scene&&camera)renderer.render(scene,camera);
}
animate();
