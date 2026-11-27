// MARSOUPILAMI · render/labels.js
// CSS2D labels and the vertical scale bar.
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { fmtH } from '../util.js';
import { G } from '../geometry/dome-shape.js';
import { scene } from './scene.js';

// ---------------------------------------------------------------- labels & scale bar
const labelGroup = new THREE.Group(); scene.add(labelGroup);
function label(text, x, y, z){ const d=document.createElement('div'); d.className='lbl'; d.textContent=text;
  const o=new CSS2DObject(d); o.position.set(x,y,z); labelGroup.add(o); return o; }
const lblWater = label('', -14, 0, 1.2);
const lblMembrane = label('membrane (0.85 atm inside)', 12, G.H+1.2, -1);
label('tether bundle → anchor footing', -15, 2.4, -5);
label('human 1.75 m', 0.6, 2.2, -5.0);
label('house + tail sculpture (top ≈ 5.4 m)', -10, 6.1, -10);
label('tree', 10, 7.2, -10);
const lblPlatform = label('suspended platform', 0, 10, 1.15);
lblPlatform.visible = false;
const scaleBar = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color:0xffffff }));
labelGroup.add(scaleBar); let scaleLabels = [];
function buildScaleBar(){ // vertical scale bar at the section, 1 m ticks, labels every 5 m (10 m for tall domes)
  const seg=[], X=-19.5, Z=1.0, top=Math.ceil(G.H+1), step = G.H > 25 ? 10 : 5;
  seg.push(X,0,Z, X,top,Z);
  for (let y=0;y<=top;y++){ const w = y%5===0?0.6:0.3; seg.push(X-w,y,Z, X+w,y,Z); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(seg,3));
  scaleBar.geometry.dispose(); scaleBar.geometry = g;
  for (const o of scaleLabels) labelGroup.remove(o);
  scaleLabels = [];
  for (let y=0; y<=G.H-2; y+=step) scaleLabels.push(label(`${y} m`, X-1.6, y, Z));
  scaleLabels.push(label(`${fmtH(G.H)} m`, X-1.6, G.H, Z));
  lblMembrane.position.set(12, G.H+1.2, -1);
}

export { buildScaleBar, labelGroup, lblPlatform, lblWater };
