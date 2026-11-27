// MARSOUPILAMI · render/cutaway.js
// Section cutaways: half cut (z <= 1) and 1/8 sector, clip planes and point tests.
import * as THREE from 'three';
import { params } from '../state.js';

// cut plane: keep z <= 1 (the cell boundary just in front of the centre row)
const CUT_Z = 1.0;
const cutPlane = new THREE.Plane(new THREE.Vector3(0,0,-1), CUT_Z);
// 1/8 (45°) sector cutaway, a wedge about the −Z axis (the usual look-into side of the half cut).
// three.js keeps fragments with n·p + c ≥ 0 for every plane. The wedge |atan2(x, −z)| ≤ π/8 is
// −z ≥ |x|·cot(π/8), i.e. cos(π/8)·x − sin(π/8)·z ≥ 0 and −cos(π/8)·x − sin(π/8)·z ≥ 0
// (same region as inEighth() and the path-trace slicer).
const EIGHTH_HALF = Math.PI/8;
const eighthPlanes = [
  new THREE.Plane(new THREE.Vector3( Math.cos(EIGHTH_HALF), 0, -Math.sin(EIGHTH_HALF)), 0),
  new THREE.Plane(new THREE.Vector3(-Math.cos(EIGHTH_HALF), 0, -Math.sin(EIGHTH_HALF)), 0),
];
function isCut(){ return !!(params.cutaway || params.cutEighth); }
function inEighth(x, z){ return Math.abs(Math.atan2(x, -z)) <= EIGHTH_HALF + 1e-6; }
function inCut(x, z){
  if (params.cutEighth) return inEighth(x, z);
  if (params.cutaway) return z <= CUT_Z;
  return true;
}
function currentClipPlanes(){ return params.cutEighth ? eighthPlanes : (params.cutaway ? [cutPlane] : null); }
const clipList = [];
function clippable(mat){ clipList.push(mat); return mat; }

export { clipList, clippable, currentClipPlanes, CUT_Z, EIGHTH_HALF, inCut, inEighth, isCut };
