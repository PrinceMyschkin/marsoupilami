// MARSOUPILAMI · state.js
// Startup parameters (defaults + URL overrides) and the small mutable state shared between modules.

const params = {
  height: 22.0, layers: 8, pillows: true, platform: true, tunnels: false, tunnelSpacing: 10, funnelCover: 100, perfOpen: 20, membrane: true, tethers: true, cutaway: true, cutEighth: false, labels: true,
  time: 11.0, pathLights: 'auto', lat: 35.23, lon: 163.95, decl: 0, tau: 0.5, exposure: 1.0, view: 'overview', ledW: 0, ledHours: 16, ledAuto: true, ledMix620: 0.6,
};
const qs = new URLSearchParams(location.search);
for (const [k,v] of qs) if (k in params) params[k] = (typeof params[k]==='number') ? parseFloat(v) : (typeof params[k]==='boolean' ? v==='1'||v==='true' : v);
// Mutable app state shared across modules. ES module imports are read-only bindings, so values that one
// module sets and others read live on this object.
const state = {
  infoMode: 'summary',   // left panel mode: 'summary' | 'full'
  stats: {},             // derived numbers of the last rebuild() (geometry/build.js)
  ledAutoState: null,    // last LED auto-balance solution (initialised in physics/leds.js, updated by updateLight)
  cLedW: null,           // lil-gui controller of the LED slider, filled when the GUI is built
  ptEnvK: 1,             // path-trace sky intensity, set by updateLight()
  ptHook: null,          // path-trace light sync, set once the path tracer code is loaded
  ptOnRebuild: null,     // path-trace re-bake after rebuild(), set by the path tracer
};
// info=0 hides the panel (handled later). info=summary | info=full selects the left-panel mode; default is Summary (for sharing).
{ const q = qs.get('info'); if (q==='full' || q==='physics') state.infoMode = 'full'; else if (q==='summary') state.infoMode = 'summary'; }

export { params, qs, state };
