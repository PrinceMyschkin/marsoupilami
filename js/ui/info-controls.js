// MARSOUPILAMI · ui/info-controls.js
// Info panel controls: Summary / Full Physics toggle (synced to ?info=), hide button and the i key.
import { state } from '../state.js';
import { applyInfoModeChrome } from './info-panel.js';
import { updateLight } from '../render/lighting.js';
import { flyTyping } from '../controls/fly.js';

function syncInfoUrl(){
  const u = new URL(location.href);
  if (u.searchParams.get('info')==='0') return;           // keep the hide flag
  u.searchParams.set('info', state.infoMode);
  history.replaceState(null, '', u.pathname + u.search + u.hash);
}
function setInfoMode(mode){
  state.infoMode = (mode==='full') ? 'full' : 'summary';
  applyInfoModeChrome();
  syncInfoUrl();
  updateLight();
}
document.getElementById('hide').onclick = () => { const i=document.getElementById('info'); i.style.display = i.style.display==='none'?'':'none'; };
document.getElementById('infoToggle').addEventListener('click', e => {
  const b = e.target.closest('button[data-mode]'); if (!b) return;
  setInfoMode(b.dataset.mode);
});
applyInfoModeChrome();
addEventListener('keydown', e => { if (e.key==='i' && !e.ctrlKey && !e.metaKey && !e.altKey && !flyTyping()) document.getElementById('hide').onclick(); });

export { setInfoMode };
