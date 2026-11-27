// MARSOUPILAMI · controls/fly.js
// WASD noclip fly controls (Quake-style) that move camera and orbit target together.
import * as THREE from 'three';
import { camera, controls, renderer } from '../render/scene.js';

// WASD noclip (Quake-style): fly along the camera view, no clip, no gravity.
// Camera and orbit target move by the same delta so OrbitControls keeps working.
const FLY_SPEED = 5, FLY_SPRINT = 4;
const flyKeys = Object.create(null);
const flyForward = new THREE.Vector3(), flyRight = new THREE.Vector3(), flyDelta = new THREE.Vector3();
let flyLastT = 0;
const FLY_BIND = {
  KeyW:'w', KeyS:'s', KeyA:'a', KeyD:'d',
  KeyQ:'q', KeyE:'e',
  Space:'up', ControlLeft:'down', ControlRight:'down',
  ShiftLeft:'shift', ShiftRight:'shift',
};
function flyTyping(){
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}
function onFlyKey(e, down){
  const name = FLY_BIND[e.code];
  if (!name) return;
  if (!down){ flyKeys[name] = false; return; }   // always release, so nothing sticks
  if (flyTyping()) return;
  // leave browser shortcuts alone (Ctrl/Cmd+A, Ctrl+S, Alt+…); Ctrl itself is still "down"
  if ((e.metaKey || e.altKey || e.ctrlKey) && name !== 'down') return;
  if (name === 'up' || name === 'w' || name === 's' || name === 'a' || name === 'd' || name === 'q' || name === 'e') e.preventDefault();
  flyKeys[name] = down;
}
addEventListener('keydown', e => onFlyKey(e, true));
addEventListener('keyup', e => onFlyKey(e, false));
function flyClearKeys(){ for (const k of Object.keys(flyKeys)) flyKeys[k] = false; }
window.addEventListener('blur', flyClearKeys);
renderer.domElement.addEventListener('pointerdown', () => { if (flyTyping()) document.activeElement.blur(); });
function tickFly(now){
  const dt = flyLastT ? Math.min(0.05, (now - flyLastT) / 1000) : 0;
  flyLastT = now;
  const k = flyKeys;
  const x = (k.d?1:0) - (k.a?1:0);
  const y = (k.e?1:0) + (k.up?1:0) - (k.q?1:0) - (k.down?1:0);
  const z = (k.w?1:0) - (k.s?1:0);
  if (!x && !y && !z) return;
  camera.getWorldDirection(flyForward);
  flyRight.crossVectors(flyForward, camera.up);
  if (flyRight.lengthSq() < 1e-8) flyRight.setFromMatrixColumn(camera.matrixWorld, 0);
  flyRight.normalize();
  flyDelta.set(0,0,0);
  if (z) flyDelta.addScaledVector(flyForward, z);
  if (x) flyDelta.addScaledVector(flyRight, x);
  if (y) flyDelta.y += y;
  if (flyDelta.lengthSq() < 1e-12) return;
  flyDelta.normalize().multiplyScalar(FLY_SPEED * (k.shift ? FLY_SPRINT : 1) * dt);
  camera.position.add(flyDelta);
  controls.target.add(flyDelta);
}

export { flyKeys, flyTyping, tickFly };
