# MARSOUPILAMI – file structure

Static site, no build step: plain ES modules plus the import map in `index.html`
(three r160, lil-gui 0.19, three-mesh-bvh 0.7.4, three-gpu-pathtracer 0.0.23 from CDN).

## Run locally

ES modules do **not** load from `file://`. Serve the folder over HTTP:

```
cd marsoupilami
python3 -m http.server 8000
# open http://localhost:8000/
```

GitHub Pages serves it as is (put these files in the repo root or the Pages folder).
URL parameters work as before (`?view=interior&time=7.5&info=full`, `?pathTrace=1`, …).

## Files

| File | Responsibility |
|---|---|
| `index.html` | Markup (loading overlay, info panel, stats overlay) and the import map |
| `css/style.css` | All styles: info panel, loading overlay, labels, path-trace stats |
| `js/main.js` | Bootstrap: imports the modules in order, resize handler, first build, render loop |
| `js/state.js` | Startup defaults + URL overrides (`params`, `qs`) and the shared mutable `state` |
| `js/util.js` | Number formatting, debounce, scratch matrices, `setCyl` instancing helper |
| `js/polyfills.js` | `Scene.backgroundRotation/environmentRotation` polyfill for the path tracer |
| **physics/** | |
| `js/physics/optics.js` | Water absorption, CIE CMFs, sun spectrum weights, pillow integrals (`PILLOW`), stack transmission, pipe transmission |
| `js/physics/mars-environment.js` | Pressures, sun position, δ-Eddington two-stream dust model, irradiance, lm/W and PAR/W |
| `js/physics/light-transport.js` | Roof transmission (pillows + membrane), light-tunnel optics, daily light integral |
| `js/physics/colour.js` | Sun-equivalent RGB units, XYZ, CIE 1960 uv, CCT / Duv |
| `js/physics/leds.js` | 620/660 nm LED data, mix, PAR/lux/power, auto white balance (Duv = 0) and LED DLI |
| `js/physics/shielding.js` | ISA standard atmosphere and Earth elevation table for the shielding comparison |
| **geometry/** | |
| `js/geometry/dome-shape.js` | Dome dimensions `G`, membrane profile, tether attachment rule, height range |
| `js/geometry/terrain.js` | Ground, rocks, lawn, paths, pond, bollard lights |
| `js/geometry/membrane.js` | Membrane surface, seam grid, footing ring |
| `js/geometry/tethers.js` | Anchors, tether bundles, footings, collars, uplights |
| `js/geometry/pillows.js` | Pillow cells, cushion geometry, instanced pillows, spectral filter, straps |
| `js/geometry/scale-objects.js` | House with tail sculpture, tree, human |
| `js/geometry/tunnels.js` | Optional light tunnels (pipes, throats, diffusers, funnels) |
| `js/geometry/platform.js` | Suspended platform with hanging pool (clear height > 25 m) |
| `js/geometry/build.js` | `rebuild()`: places everything for the current layers / cut, derives `state.stats` |
| **render/** | |
| `js/render/scene.js` | Renderer, label renderer, scene, camera, orbit controls |
| `js/render/materials.js` | Interior tint uniforms + shader patch (`interior()`) |
| `js/render/cutaway.js` | Half and 1/8 sector cutaway planes and tests |
| `js/render/lights.js` | Sun, hemisphere light, LED canopy RectAreaLight |
| `js/render/sky.js` | Raster sky shader and path-trace gradient sky constants |
| `js/render/labels.js` | CSS2D labels and scale bar |
| `js/render/lighting.js` | `updateLight()`: time / dust / LED update of all lights and tints, then the panel |
| **ui/** | |
| `js/ui/info-panel.js` | Summary and Full Physics panel HTML |
| `js/ui/info-controls.js` | Summary / Full Physics toggle, hide button, `i` key |
| `js/ui/camera-views.js` | Camera presets |
| `js/ui/loading.js` | Loading overlay and the stepwise structure rebuild |
| `js/ui/gui.js` | lil-gui control panel |
| **controls/** | |
| `js/controls/fly.js` | WASD noclip fly controls |
| **pathtracer/** | |
| `js/pathtracer/pt-state.js` | Path tracer settings / runtime state (`window.__pt`) |
| `js/pathtracer/bake.js` | Bakes the raster scene into a path-traceable scene (materials, instancing, cuts, lights) |
| `js/pathtracer/pathtracer.js` | Start / stop / re-bake / light sync, GPU scheduling, GUI folder |
| `js/test-hook.js` | `window.__mars` test hook |

## Conventions

- Module order matters: `js/main.js` imports the modules in the order the old single file ran
  (only the labels now load just before the platform, which uses them), and every module imports only from modules listed before it (no import cycles).
- Values that one module sets and others read (`stats`, `ledAutoState`, `infoMode`, LED slider
  controller, path-trace hooks) live on `state` in `js/state.js`, because imported bindings are read-only.
- Text in the model stays English.
