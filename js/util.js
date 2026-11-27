// MARSOUPILAMI · util.js
// Small shared helpers: number formatting, debounce, scratch matrices and the cylinder-between-points instancer.
import * as THREE from 'three';

const fmt = (v,d=0)=>v.toLocaleString('en-US',{maximumFractionDigits:d,minimumFractionDigits:d});
const fmtH = h => (Math.round(h*10)/10).toString();
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), UP = new THREE.Vector3(0,1,0);
function setCyl(mesh, i, a, b, r){
  V.subVectors(b, a); const len = V.length(); if (len < 1e-4){ M4.makeScale(0,0,0); mesh.setMatrixAt(i, M4); return; }
  Q.setFromUnitVectors(UP, V.clone().divideScalar(len));
  M4.compose(a, Q, new THREE.Vector3(r, len, r)); mesh.setMatrixAt(i, M4);
}

export { debounce, fmt, fmtH, M4, Q, setCyl };
