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
let scene, camera, renderer, composer, controls, world, kcc, playerBody, playerCollider, navGraph;
let flashlight, flashlightTarget, flashlightOn = true, battery = 100, exitDoor, exitPivot, exitCollider, exitOpen = false;
let enemyGroup, enemyModel, enemyLight, enemyMixer, enemyClips = {}, enemyFallback = false;
let keys = [], interactive = [], wallVisuals = [], lamps = [], nearestInteractable = null;
let state = 'menu', elapsed = 0, messageTimer = 0, threat = 0, verticalSpeed = 0, bob = 0, footstep = 0;
let enemyMode = 'LURK', enemyPath = [], enemyPathIndex = 0, patrolTarget = null, pathClock = 0, searchClock = 0;
let lastKnown = new THREE.Vector3(), audioContext, masterGain, audioReady = false, heartbeatClock = 0;
const moveKeys = new Set(), clock = new THREE.Clock(), raycaster = new THREE.Raycaster();
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
  const wall = box(w, WALL_H, d, M.wall, new THREE.Vector3(pos.x, WALL_H / 2, pos.z));
  wallVisuals.push(wall);
  box(w, 0.13, d + 0.035, M.darkWall, new THREE.Vector3(pos.x, 0.11, pos.z));
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
    if (!openCell(r - 1, c) && !(r === 0 && c === EXIT_COL)) addWall(CELL, WALL_T, new THREE.Vector3(p.x, 0, p.z - CELL / 2));
    if (!openCell(r + 1, c)) addWall(CELL, WALL_T, new THREE.Vector3(p.x, 0, p.z + CELL / 2));
  }
  scene.add(new THREE.Mesh(mergeGeometries(floorParts, false), M.floor));
  scene.add(new THREE.Mesh(mergeGeometries(ceilingParts, false), M.ceiling));
  for (const [r, c, power] of [[1,2,.72],[1,7,.45],[3,5,.6],[5,3,.65],[5,7,.4],[8,2,.35],[8,7,.52]]) addLamp(r, c, power);
  buildBeds(); buildNurseStation(); buildCurtains(); buildExit();
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
    for (let i=0;i<7;i++) cylinder(.027,.027,.08,M.metal,new THREE.Vector3(-length/2+i*length/6,2.2,0),bar,6);
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
function buildKeys() {
  const spots = [
    { row:2,col:1,name:'WEST WARD KEY',note:'The paper tied to the brass key is stiff with old blood.' },
    { row:2,col:8,name:'SURGERY KEY',note:'The tag has been scratched until only a number remains.' },
    { row:8,col:2,name:'MORGUE KEY',note:'It is warm, as if someone has been holding it.' },
  ];
  keys = spots.map((s,i) => {
    const p = cellPos(s.row,s.col), group = new THREE.Group();
    group.position.set(p.x+(i-1)*.25,.98,p.z-.45); scene.add(group);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.16,.04,8,18),M.key); ring.rotation.y = Math.PI/2; ring.position.x = -.12; group.add(ring);
    box(.43,.07,.07,M.key,new THREE.Vector3(.12,0,0),group);
    box(.07,.15,.07,M.key,new THREE.Vector3(.26,-.04,0),group);
    box(.07,.11,.07,M.key,new THREE.Vector3(.04,-.02,0),group);
    const glow = new THREE.PointLight(0xcda24b,.5,2.2,2); glow.position.y=.12; group.add(glow);
    group.userData = { targetType:'key', keyIndex:i, name:s.name, note:s.note, collected:false };
    interactive.push(group); return group;
  });
  return keys;
}
function buildNavigationGraph() {
  const graph = new YUKA.Graph();
  for (const label of walkable) { const [r,c] = label.split(',').map(Number); graph.addNode(new YUKA.Node(r*COLS+c)); }
  for (const label of walkable) {
    const [r,c] = label.split(',').map(Number), a = r*COLS+c;
    for (const [nr,nc] of [[r+1,c],[r-1,c],[r,c+1],[r,c-1]]) if (openCell(nr,nc)) graph.addEdge(new YUKA.Edge(a,nr*COLS+nc,1));
  }
  return graph;
}
function nearestNode(pos) {
  const cell = toCell(pos); if (openCell(cell.row,cell.col)) return cell.row*COLS+cell.col;
  let best=0,dist=Infinity;
  for (const label of walkable) { const [r,c] = label.split(',').map(Number), p=cellPos(r,c), d=p.distanceToSquared(new THREE.Vector3(pos.x,0,pos.z)); if(d<dist){best=r*COLS+c;dist=d;} }
  return best;
}
function findPath(from,to) {
  const a=nearestNode(from), b=nearestNode(to);
  if(a===b) return [cellPos(Math.floor(a/COLS),a%COLS)];
  const astar=new YUKA.AStar(navGraph,a,b); astar.heuristic=new YUKA.HeuristicPolicyDijkstra(); astar.search();
  return astar.getPath().map(id=>cellPos(Math.floor(id/COLS),id%COLS));
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
  try {
    const resp = await fetch('/assets/RobotExpressive.glb',{method:'HEAD'});
    if (resp.ok) {
      const gltf = await loader.loadAsync('/assets/RobotExpressive.glb');
      enemyGroup = new THREE.Group(); enemyModel = gltf.scene;
      enemyModel.traverse(n=>{ if(n.isMesh){n.castShadow=false;n.receiveShadow=false; const dark=Array.isArray(n.material)?n.material.map(m=>m.clone()):n.material.clone(); if(Array.isArray(dark)){dark.forEach(m=>{if(m.color)m.color.set(0x121114);});n.material=dark;} else {if(dark.color)dark.color.set(0x121114);n.material=dark;} } });
      enemyModel.updateMatrixWorld(true);
      const bounds=new THREE.Box3().setFromObject(enemyModel), height=Math.max(.1,bounds.max.y-bounds.min.y);
      enemyModel.scale.setScalar(1.82/height); enemyModel.position.y=-bounds.min.y*(1.82/height); enemyGroup.add(enemyModel);
      if(gltf.animations?.length){enemyMixer=new THREE.AnimationMixer(enemyModel); for(const clip of gltf.animations)enemyClips[clip.name.toLowerCase()]=clip;}
      enemyFallback=false;
    }
  } catch { /* The included procedural hunter remains playable if the download is unavailable. */ }
  if(!enemyGroup){enemyGroup=new THREE.Group();createHunterFallback();enemyGroup.add(enemyModel);}
  enemyLight = new THREE.PointLight(0xb00b1b,.75,3,2); enemyLight.position.set(0,1.5,.14); enemyGroup.add(enemyLight); scene.add(enemyGroup);
  enemyGroup.position.copy(cellPos(2,8));
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5)); renderer.setSize(innerWidth,innerHeight,false);
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
  const bloom=new BloomEffect({intensity:.22,luminanceThreshold:.72,luminanceSmoothing:.12}), noise=new NoiseEffect(); noise.blendMode.opacity.value=.09;
  const vignette=new VignetteEffect({offset:.22,darkness:.86});
  composer=new EffectComposer(renderer); composer.addPass(new RenderPass(scene,camera)); composer.addPass(new EffectPass(camera,bloom,noise,vignette));
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
  const count=keys.filter(k=>k.userData.collected).length;
  [...$('key-pips').children].forEach((pip,i)=>pip.classList.toggle('filled',i<count));
  $('objective-text').textContent=count<3?'Find the three ward keys ('+count+'/3)':'Return to the north exit';
  $('location-label').textContent=enemyMode==='CHASE'?'ST. AGNES / MOVEMENT DETECTED':'ST. AGNES / RECOVERY WING';
}
function startRun() {
  if(!world||!controls)return;
  state='playing';elapsed=0;battery=100;flashlightOn=true;flashlight.visible=true;exitOpen=false;enemyMode='LURK';threat=0;searchClock=0;pathClock=0;verticalSpeed=0;bob=0;footstep=0;
  for(const key of keys){key.userData.collected=false;key.visible=true;key.position.y=.98;}
  if(exitPivot)exitPivot.rotation.y=0;if(!exitCollider)createExitCollider();
  const start=cellPos(9,5);playerBody.setTranslation({x:start.x,y:.88,z:start.z},true);
  enemyGroup.position.copy(cellPos(2,8));enemyPath=[];enemyPathIndex=0;patrolTarget=null;lastKnown.copy(start);
  $('title-screen').classList.add('hidden');$('pause-screen').classList.add('hidden');$('end-screen').classList.add('hidden');$('hud').classList.remove('hidden');$('interaction-prompt').classList.add('hidden');
  updateHud();initAudio();controls.lock();showMessage('Find the ward keys. The exit is at the north end of the hospital.',4.5);
}
function pauseRun(){if(state!=='playing')return;state='paused';$('pause-screen').classList.remove('hidden');$('hud').classList.add('hidden');}
function resumeRun(){state='playing';$('pause-screen').classList.add('hidden');$('hud').classList.remove('hidden');controls.lock();}
function endRun(won) {
  if(state==='won'||state==='lost')return;state=won?'won':'lost';controls.unlock();$('hud').classList.add('hidden');$('pause-screen').classList.add('hidden');$('end-screen').classList.remove('hidden');
  $('end-eyebrow').textContent=won?'ST. AGNES // DISCHARGE PAPERS':'ST. AGNES // INCIDENT REPORT';
  $('end-title').textContent=won?'YOU GOT OUT.':'PATIENT NOT FOUND.';
  $('end-copy').textContent=won?'The three keys turned. The door opened. Behind you, the ward lights went out one by one. Night shift complete in '+Math.floor(elapsed/60)+'m '+Math.floor(elapsed%60)+'s.':'Your footsteps stop. Somewhere in the ward, a monitor begins to beep again. The night shift has found another patient.';
  cue(won?'door':'sting',won?.12:.3);
}
function toggleFlashlight(){if(state!=='playing')return;if(battery<=.5){flashlightOn=false;flashlight.visible=false;showMessage('The flashlight battery is dead.',1.8);cue('click');return;}flashlightOn=!flashlightOn;flashlight.visible=flashlightOn;cue('click',.08);}
function interact(target) {
  if(!target)return;const data=target.userData||{};
  if(data.targetType==='key'){if(data.collected)return;data.collected=true;target.visible=false;showMessage(data.name+' acquired.',2.2);cue('pickup',.18);updateHud();if(keys.every(k=>k.userData.collected))showMessage('All three keys are secured. Return to the north exit.',4);return;}
  if(data.targetType==='note'){showMessage('NURSE’S NOTE: “If you hear it running, stay quiet. If the lights turn red, do not look behind you.”',6);cue('pickup',.1);return;}
  if(data.targetType==='exit'){const count=keys.filter(k=>k.userData.collected).length;if(count<3){showMessage('Three ward keys required. ('+count+'/3)',2.6);cue('click',.08);return;}if(!exitOpen){exitOpen=true;removeExitCollider();showMessage('The lock turns. The door is moving. RUN.',3.4);cue('door',.24);}}
}
function findInteraction() {
  nearestInteractable=null;$('interaction-prompt').classList.add('hidden');$('crosshair').classList.remove('active');
  if(state!=='playing')return;
  raycaster.setFromCamera(new THREE.Vector2(0,0),camera);raycaster.far=3.0;
  const roots=interactive.filter(o=>o.visible),hits=raycaster.intersectObjects(roots,true);
  for(const hit of hits){
    let root=hit.object;
    while(root&&root!==scene&&root.userData?.targetType===undefined)root=root.parent;
    if(root&&root.userData?.targetType!==undefined){nearestInteractable=root;$('interaction-text').textContent=root.userData.targetType==='key'?'Pick up '+root.userData.name:root.userData.targetType==='note'?'Read nurse’s note':(exitOpen?'Exit through the door':'Unlock the exit');$('interaction-prompt').classList.remove('hidden');$('crosshair').classList.add('active');break;}
  }
  if(!nearestInteractable){
    const pos=camera.position;
    const close=keys.find(k=>k.visible&&k.position.distanceTo(pos)<1.65);
    if(close){nearestInteractable=close;$('interaction-text').textContent='Pick up '+close.userData.name;$('interaction-prompt').classList.remove('hidden');}
    else if(exitDoor.position.distanceTo(pos)<3.3){nearestInteractable=exitDoor;$('interaction-text').textContent='Unlock the exit';$('interaction-prompt').classList.remove('hidden');}
  }
}
function handleInput(dt) {
  const running=moveKeys.has('ShiftLeft')||moveKeys.has('ShiftRight');
  const speed=running?5.25:3.05;
  const x=Number(moveKeys.has('KeyD'))-Number(moveKeys.has('KeyA')),z=Number(moveKeys.has('KeyW'))-Number(moveKeys.has('KeyS'));
  camera.getWorldDirection(forward);forward.y=0;forward.normalize();right.crossVectors(forward,camera.up).normalize();
  move.set(0,0,0);if(z)move.addScaledVector(forward,z);if(x)move.addScaledVector(right,x);if(move.lengthSq()>1)move.normalize();
  const current=playerBody.translation();verticalSpeed-=15.5*dt;if(current.y<.89&&verticalSpeed<0)verticalSpeed=0;
  const desired={x:move.x*speed*dt,y:verticalSpeed*dt,z:move.z*speed*dt};
  kcc.computeColliderMovement(playerCollider,desired);const actual=kcc.computedMovement();
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
  const spots=[[1,2],[1,7],[3,5],[5,2],[5,8],[8,7],[3,6],[7,6]].filter(([r,c])=>openCell(r,c));
  const at=toCell(enemyGroup.position),choices=spots.filter(([r,c])=>r!==at.row||c!==at.col),s=choices[Math.floor(Math.random()*choices.length)]||[5,5];
  patrolTarget=cellPos(s[0],s[1]);planPath(patrolTarget);
}
function moveHunterToward(target,speed,dt) {
  if(!target)return;const offset=target.clone().sub(enemyGroup.position);offset.y=0;const dist=offset.length();
  if(dist<.32){enemyPathIndex++;return;}offset.normalize();enemyGroup.position.addScaledVector(offset,Math.min(dist,speed*dt));enemyGroup.position.y=0;enemyGroup.rotation.y=Math.atan2(-offset.x,-offset.z);
  if(enemyFallback&&enemyModel){enemyModel.rotation.z=Math.sin(elapsed*9)*.035;enemyModel.position.y=Math.sin(elapsed*7)*.025;}
}
function animateEnemyClip(name) {
  if(!enemyMixer)return;const found=Object.keys(enemyClips).find(n=>n.includes(name))||Object.keys(enemyClips).find(n=>n.includes('idle'));if(!found)return;
  const action=enemyMixer.clipAction(enemyClips[found]);if(enemyMixer._activeAction===action)return;const old=enemyMixer._activeAction;if(old)old.fadeOut(.2);action.reset().fadeIn(.2).play();enemyMixer._activeAction=action;
}
function updateEnemy(dt) {
  if(!enemyGroup)return;const player=camera.position.clone();player.y=0;const distance=enemyGroup.position.distanceTo(player),sees=canSeePlayer();
  const facing=flashlightOn&&battery>0&&distance<10&&camera.getWorldDirection(direction)&&direction.dot(enemyGroup.position.clone().sub(camera.position).normalize())>.89;
  if(distance<1.22){endRun(false);return;}
  if(sees&&(distance<12||(moveKeys.has('ShiftLeft')||moveKeys.has('ShiftRight'))&&distance<17)){if(enemyMode!=='CHASE'){enemyMode='CHASE';cue('sting',.22);showMessage('RUN. IT HAS SEEN YOU.',2.2);}lastKnown.copy(player);searchClock=0;}
  else if(enemyMode==='CHASE'){enemyMode='SEARCH';searchClock=0;planPath(lastKnown);}
  if(facing&&distance<5.2)threat=Math.max(threat,.72);pathClock-=dt;
  if(enemyMode==='LURK'){
    if(!patrolTarget||enemyPathIndex>=enemyPath.length||pathClock<=0){choosePatrol();pathClock=2.4+Math.random()*1.5;}
    moveHunterToward(enemyPath[enemyPathIndex]||patrolTarget,facing?.72:1.08,dt);
    setThreat(distance<10?Math.max(threat*.98,(10-distance)/15):Math.max(0,threat-dt*.12));
  }else if(enemyMode==='CHASE'){
    if(pathClock<=0){planPath(player);pathClock=.85;}
    moveHunterToward(enemyPath[enemyPathIndex]||player,facing?1.25:2.45,dt);setThreat(Math.min(1,threat+dt*.65));
    heartbeatClock+=dt;if(distance<5&&heartbeatClock>1.05){heartbeatClock=0;cue('heartbeat',threat*.17);}
  }else{
    searchClock+=dt;if(pathClock<=0){planPath(lastKnown);pathClock=1.25;}
    moveHunterToward(enemyPath[enemyPathIndex]||lastKnown,1.55,dt);setThreat(Math.max(0,threat-dt*.13));
    if(searchClock>4.3||enemyGroup.position.distanceTo(lastKnown)<1){enemyMode='LURK';patrolTarget=null;pathClock=0;}
  }
  if(enemyMixer){animateEnemyClip(enemyMode==='CHASE'?'running':enemyMode==='LURK'?'walking':'walking');enemyMixer.update(dt);}
  if(enemyLight)enemyLight.intensity=enemyMode==='CHASE'?1.35:.6;
}
function flicker(dt) {
  for(const lamp of lamps){lamp.clock+=dt;const broken=Math.sin(lamp.clock*2.7)>.94||Math.sin(lamp.clock*1.4)<-.97;lamp.light.intensity=broken?.08:lamp.base*(.82+Math.sin(lamp.clock*1.8)*.12);lamp.tube.material.emissiveIntensity=broken?.06:.55+lamp.base*.45;}
}
function updateDoor(dt) {
  if(exitOpen){exitPivot.rotation.y=THREE.MathUtils.damp(exitPivot.rotation.y,Math.PI*.47,1.4,dt);const p=camera.position;if(p.z<EXIT_Z-2&&Math.abs(p.x)<2.9)endRun(true);}
}
async function initialise() {
  $('loading-screen').classList.remove('hidden');setupRenderer();await RAPIER.init();setupPhysics();navGraph=buildNavigationGraph();drawHospital();buildKeys();await loadOptionalAssets();$('loading-screen').classList.add('hidden');
}
$('start-button').addEventListener('click',()=>startRun());
$('resume-button').addEventListener('click',()=>resumeRun());
$('restart-button').addEventListener('click',()=>startRun());
$('play-again-button').addEventListener('click',()=>startRun());
document.addEventListener('keydown',e=>{if(['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight'].includes(e.code))moveKeys.add(e.code);if(e.code==='KeyF'&&!e.repeat)toggleFlashlight();if(e.code==='KeyE'&&!e.repeat&&state==='playing')interact(nearestInteractable);if(e.code==='Escape'&&state==='playing'&&!controls?.isLocked)pauseRun();});
document.addEventListener('keyup',e=>moveKeys.delete(e.code));
initialise().catch(error=>{console.error('Hollow Ward initialisation failed.',error);$('loading-screen').classList.add('hidden');$('title-screen').classList.remove('hidden');const card=document.querySelector('.story-card');if(card)card.insertAdjacentHTML('beforeend','<p style="color:#d56b70">Initialisation failed. Check WebGL support and run npm install before starting the game.</p>');});
function animate() {
  requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04);
  if(state==='playing'){elapsed+=dt;handleInput(dt);world.timestep=dt;world.step();updateEnemy(dt);flicker(dt);updateDoor(dt);if(audioReady&&audioContext?.state==='suspended')audioContext.resume().catch(()=>{});}
  if(composer)composer.render(dt);else if(renderer&&scene&&camera)renderer.render(scene,camera);
}
animate();
