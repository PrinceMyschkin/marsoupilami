// MARSOUPILAMI · ui/info-panel.js
// Left info panel: Summary and Full Physics HTML from the current light / structure state.
import { fmt } from '../util.js';
import { G, PH, PW } from '../geometry/dome-shape.js';
import { DIFFUSER_T, FUNNEL_RHO, PILLOW, PIPE_D, PIPE_RHO, T_BAG, pathFactor } from '../physics/optics.js';
import { LUM_EFF, P, PAR_PER_W } from '../physics/mars-environment.js';
import { params, state } from '../state.js';
import { dli, tunnelModel } from '../physics/light-transport.js';
import { WHITE_DUV_TOL, mixColour } from '../physics/colour.js';
import { LED_CH, LED_MAX, dliLedAuto, ledAddPerWatt, ledMix620, ledSplit } from '../physics/leds.js';
import { anchors, tetherCount } from '../geometry/tethers.js';
import { cells } from '../geometry/pillows.js';
import { PLATFORM_POOL_D, PLATFORM_POOL_L, PLATFORM_POOL_W, PLATFORM_R, platformGroup } from '../geometry/platform.js';
import { closestEarthPlace, isaAltitude } from '../physics/shielding.js';

function applyInfoModeChrome(){
  document.getElementById('info').classList.toggle('is-summary', state.infoMode==='summary');
  for (const b of document.querySelectorAll('#infoToggle [data-mode]')){
    const on = b.dataset.mode === state.infoMode;
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  }
}
const _solCache = new Map();
function cachedSol(key, fn){
  if (_solCache.has(key)) return _solCache.get(key);
  if (_solCache.size > 256) _solCache.clear();
  const v = fn(); _solCache.set(key, v); return v;
}
let _lastInfoHTML = '';
// Numbers and text of the info panel; called at the end of updateLight() with its per-update values.
function renderInfoPanel({ L, elev, az, I, w, bag, tm, fracDir }){
  // numbers
  const luxOut = I.glob*LUM_EFF, parOut = I.glob*PAR_PER_W;
  const tY = (fracDir*w.direct.Y + (1-fracDir)*w.diffuse.Y)*bag, tPAR = (fracDir*w.direct.par + (1-fracDir)*w.diffuse.par)*bag;
  const waterKPa = L*PILLOW.depth*P.rho*P.g/1000, dp = P.pin - P.pout, net = dp - waterKPa;   // weight per roof area: pillow volume / cell area
  const perTether = net*G.cell*G.cell, perBundle = perTether*25;
  const hh = Math.floor(params.time), mm = Math.floor((params.time-hh)*60);
  const bar = (v,c)=>`<span class="bar" style="width:${Math.round(v*90)}px;background:${c}"></span>`;
  // Sol integrals do not depend on the time of day or exposure: cache them so scrubbing / ▶ animate is cheap.
  const solKey = [L, params.lat, params.decl, params.tau, params.tunnels, params.perfOpen, state.stats.fF, state.stats.fP, state.stats.fM, state.stats.pipeLen].join('|');
  const dOut = cachedSol('out|'+[params.lat, params.decl, params.tau].join('|'), () => dli(L,true));
  const dIn = cachedSol('in|'+solKey, () => dli(L,false));
  let tunHTML = '';
  if (params.tunnels){
    const tN = tunnelModel(L, elev, true);
    const tT = fracDir*tm.kDir + (1-fracDir)*tm.kDif, tTn = fracDir*tN.kDir + (1-fracDir)*tN.kDif;
    const ch = c => (fracDir*w.direct[c] + (1-fracDir)*w.diffuse[c])*bag;
    const wo = { r:ch('r'), g:ch('g'), b:ch('b') }, wi = { r:tm.keep*wo.r+tT, g:tm.keep*wo.g+tT, b:tm.keep*wo.b+tT };
    const tYw = tm.keep*tY + tT, tPw = tm.keep*tPAR + tT, tYn = tN.keep*tY + tTn, tPn = tN.keep*tPAR + tTn;
    const sv0 = { fF:state.stats.fF, fP:state.stats.fP, fM:state.stats.fM }; Object.assign(state.stats, { fF:0, fP:0, fM:0 }); const dNo = dli(L,false); Object.assign(state.stats, sv0);
    const dNaive = dli(L,false,true);
    const zenD = 90 - Math.max(elev,0)*180/Math.PI, bounces = tm.len*Math.tan(Math.PI/2-Math.max(elev,0.01))/PIPE_D;
    const cpcLen = (Math.sqrt(state.stats.w*state.stats.w/Math.PI) + PIPE_D/2)/Math.tan(tm.thA);
    tunHTML = `<h2>Light tunnels</h2><table>
     <tr><td>Tunnels × spacing / funnel width</td><td class="v">${state.stats.tunnels} × ${state.stats.S} m / ${state.stats.w} m</td></tr>
     <tr><td>Funnel coverage of roof / water removed</td><td class="v">${fmt(100*tm.fF)} % / ${fmt(100*state.stats.fP,1)} %</td></tr>
     <tr><td>Funnel depth (15° walls, pillows hang lower)</td><td class="v">${fmt(state.stats.dep,2)} m</td></tr>
     <tr><td>Perforation open / captured, funnel ρ</td><td class="v">${fmt(params.perfOpen)} % / ${fmt(100-params.perfOpen)} %, ${FUNNEL_RHO}</td></tr>
     <tr><td>Concentration C / étendue acceptance θ<sub>a</sub></td><td class="v">${fmt(tm.C,0)}× / ±${fmt(tm.thA*180/Math.PI,1)}° (sun zenith ${fmt(zenD,0)}°)</td></tr>
     <tr><td>Pipe Ø ${PIPE_D} m × ${fmt(tm.len,1)} m, ρ = ${PIPE_RHO}/bounce</td><td class="v">${fmt(bounces,1)} bounces (sun)</td></tr>
     <tr><td>Pipe transmission direct / diffuse</td><td class="v">${fmt(100*tm.tpDir,0)} % / ${fmt(100*tm.tpDif,0)} %</td></tr>
     <tr><td>Diffuser transmission</td><td class="v">${fmt(100*DIFFUSER_T)} %</td></tr>
     <tr><td><b>Inside, without → with tunnels</b></td><td class="v"></td></tr>
     <tr><td>&nbsp; Illuminance</td><td class="v">${fmt(luxOut*tY/1000,1)} → ${fmt(luxOut*tYw/1000,1)} klx (${fmt(100*tY)} → ${fmt(100*tYw)} %)</td></tr>
     <tr><td>&nbsp; PAR (µmol/m²/s)</td><td class="v">${fmt(parOut*tPAR)} → ${fmt(parOut*tPw)} (${fmt(100*tPAR)} → ${fmt(100*tPw)} %)</td></tr>
     <tr><td>&nbsp; R / G / B transmission</td><td class="v">${fmt(100*wo.r)}/${fmt(100*wo.g)}/${fmt(100*wo.b)} → ${fmt(100*wi.r)}/${fmt(100*wi.g)}/${fmt(100*wi.b)} %</td></tr>
     <tr><td>&nbsp; Daily light integral</td><td class="v">${fmt(dNo,1)} → ${fmt(dIn,1)} mol/m²</td></tr>
     <tr><td><i>Naive (no étendue limit)</i></td><td class="v"><i>${fmt(luxOut*tYn/1000,1)} klx (${fmt(100*tYn)} %), PAR ${fmt(parOut*tPn)}, DLI ${fmt(dNaive,1)}</i></td></tr>
    </table><div class="src">Model (area-weighted): interior = [open roof + perforations]·water-filtered + mouth·T<sub>pipe</sub>(θ) + funnel sheet·(1−open)·ρ<sub>f</sub>·accepted·T<sub>pipe,diffuse</sub>, × 0.95 diffuser × T<sub>membrane</sub>; all tunnel light leaves the diffuser as diffuse light. A static funnel cannot raise radiance (étendue): it accepts only directions within θ<sub>a</sub> = asin(1/√C), and for sky light it delivers at most mouth area × sky. That bound needs an ideal compound parabolic concentrator ≈ ${fmt(cpcLen,0)} m deep; the drawn ${fmt(state.stats.dep,1)} m funnel (15° walls) sends near-vertical sun back up and does worse. The naive row assumes every captured ray reaches the pipe. T<sub>pipe</sub> = ρ<sup>n</sup>, n = L·tanθ/D; Al spectrally flat.</div>`;
  }
  const marsCol = P.pout*1000/P.g/10, earthCol = P.atm*1000/9.80665/10;   // g/cm²
  const waterCol = L*PILLOW.depth*100;   // mean areal density, g/cm² (1 m of water = 100 g/cm²)
  const sh = { marsCol, earthCol, total: waterCol + marsCol };
  sh.alt = isaAltitude(sh.total/earthCol); sh.altMars = isaAltitude(marsCol/earthCol);
  const parIn = (params.tunnels ? (tm.keep*tPAR + (fracDir*tm.kDir + (1-fracDir)*tm.kDif)) : tPAR) * parOut;
  const luxIn = (params.tunnels ? (tm.keep*tY + (fracDir*tm.kDir + (1-fracDir)*tm.kDif)) : tY) * luxOut;
  const { f: mixF, w620, w660 } = ledSplit(params.ledW);
  const add = ledAddPerWatt();
  const ledPar620 = w620*LED_CH[620].umol, ledPar660 = w660*LED_CH[660].umol, ledPar = ledPar620 + ledPar660;
  const ledLux620 = w620*LED_CH[620].lm, ledLux660 = w660*LED_CH[660].lm, ledLux = ledLux620 + ledLux660;
  const elec620 = w620/LED_CH[620].eta, elec660 = w660/LED_CH[660].eta, elecWm2 = elec620 + elec660;
  const ledDLI = params.ledAuto ? cachedSol('led|'+solKey+'|'+ledMix620()+'|'+params.pillows, dliLedAuto) : ledPar * params.ledHours * 3600 / 1e6;
  const canopyA = state.stats.canopyA ?? (cells.length*G.cell*G.cell);
  const footprintA = Math.PI * G.R * G.R;
  const sunR = state.ledAutoState.rgb.r, sunG = state.ledAutoState.rgb.g, sunB = state.ledAutoState.rgb.b;
  const sunSum = sunR+sunG+sunB, addR = add.r*params.ledW, addG = add.g*params.ledW, addB = add.b*params.ledW;
  const mixSum = sunSum + addR + addG + addB;
  const redSun = sunSum>0 ? sunR/sunSum : 0, redMix = mixSum>0 ? (sunR+addR)/mixSum : redSun;
  const colSun = sunSum>0 ? mixColour(state.ledAutoState.rgb, 0) : null, colMix = sunSum>0 || params.ledW>0 ? mixColour(state.ledAutoState.rgb, params.ledW) : null;
  const cdStr = c => c ? `${fmt(Math.round(c.CCT/10)*10,0)} K / ${c.Duv>=0?'+':'−'}${fmt(Math.abs(c.Duv),4)}` : '–';
  const parShare = (parIn+ledPar)>0 ? 100*ledPar/(parIn+ledPar) : 0;
  const autoNeed = state.ledAutoState.raw, autoClamp = params.ledAuto && state.ledAutoState.clamped;
  const ledHTML = `<h2>Red grow LEDs (620 + 660 nm), under the pillows</h2><table>
     <tr><td>Optical irradiance at floor (total)</td><td class="v">${fmt(params.ledW,1)} W/m²</td></tr>
     <tr><td>Red stimulus per optical W, 620 / 660 nm (sun-equivalent W)</td><td class="v">${fmt(LED_CH[620].r,1)} / ${fmt(LED_CH[660].r,2)}</td></tr>
     <tr><td>620 / 660 mix (fraction 620 nm)</td><td class="v">${fmt(100*mixF,0)} % / ${fmt(100*(1-mixF),0)} %</td></tr>
     <tr><td>620 nm optical / PAR / illuminance</td><td class="v">${fmt(w620,0)} W/m² / ${fmt(ledPar620)} µmol/m²/s / ${fmt(ledLux620)} lx</td></tr>
     <tr><td>660 nm optical / PAR / illuminance</td><td class="v">${fmt(w660,0)} W/m² / ${fmt(ledPar660)} µmol/m²/s / ${fmt(ledLux660)} lx</td></tr>
     <tr><td>Total PAR / illuminance</td><td class="v">${fmt(ledPar)} µmol/m²/s / ${fmt(ledLux)} lx</td></tr>
     <tr><td>Electrical, 620 nm (38 % WPE)</td><td class="v">${fmt(elec620,0)} W/m²</td></tr>
     <tr><td>Electrical, 660 nm (52 % WPE)</td><td class="v">${fmt(elec660,0)} W/m²</td></tr>
     <tr><td>LEDs span the underside of the pillow canopy</td><td class="v">${fmt(canopyA,0)} m² (footprint ${fmt(footprintA,0)} m²)</td></tr>
     <tr><td>Electrical total / pillow canopy</td><td class="v">${fmt(elecWm2,0)} W/m² / ${fmt(elecWm2*canopyA/1000,0)} kW over ${fmt(canopyA,0)} m²</td></tr>
     <tr><td>Auto-balance (white, Duv = 0)</td><td class="v">${params.ledAuto ? 'on' : 'off'}</td></tr>
     <tr><td>White-balance target</td><td class="v">Duv → 0 (on the blackbody locus)</td></tr>
     <tr><td>Colour sun only → with LEDs (CCT / Duv)</td><td class="v">${cdStr(colSun)} → ${cdStr(colMix)}</td></tr>
     <tr><td>Red share outside → sun only → with LEDs</td><td class="v">${fmt(100*state.ledAutoState.outShare,0)} % → ${fmt(100*redSun,0)} % → ${fmt(100*redMix,0)} %</td></tr>
     <tr><td>LED setpoint for target (unclamped)</td><td class="v">${fmt(Math.max(0,autoNeed),0)} W/m²</td></tr>
     ${autoClamp ? `<tr><td colspan="2" style="color:#ff8a6a">⚠ 100 W/m² is not enough to reach Duv = 0 at the current mix (need ${autoNeed > 10*LED_MAX ? 'more than '+fmt(10*LED_MAX,0) : fmt(autoNeed,0)} W/m²). Slider is clamped at 100.</td></tr>` : ''}
     <tr><td>PAR sunlight (this hour) + LEDs</td><td class="v">${fmt(parIn)} + ${fmt(ledPar)} = ${fmt(parIn+ledPar)} µmol/m²/s</td></tr>
     <tr><td>LED share of PAR (this hour)</td><td class="v">${fmt(parShare,0)} %</td></tr>
     <tr><td>Photoperiod</td><td class="v">${params.ledAuto ? 'follows the sun (off at night)' : fmt(params.ledHours,1)+' h/sol'}</td></tr>
     <tr><td>DLI from LEDs</td><td class="v">${fmt(ledDLI,1)} mol/m²/sol</td></tr>
     <tr><td>DLI sun + LEDs (1 sol)</td><td class="v">${fmt(dIn,1)} + ${fmt(ledDLI,1)} = ${fmt(dIn+ledDLI,1)} mol/m²</td></tr>
    </table>
    <div class="src">Two-channel luminous ceiling just under the pillow stack. LEDs span the underside of the pillow canopy (${fmt(canopyA,0)} m²), which is the grid of pillow cells — less than the dome footprint (${fmt(footprintA,0)} m²) because the edge arc has no pillows where the membrane is too low. The top slider is total optical W/m² at floor level (area-light intensity is compensated for ceiling height). The mix slider is the fraction of those watts at 620 nm (the rest is 660 nm); default 60 % 620 nm / 40 % 660 nm: 620 nm does the white balance, 660 nm adds photosynthetic photons so the LED share of the DLI does not vanish when only a little red is needed. 620 nm is orange-red: closer to the eye’s red, much higher luminous efficacy (this model’s CIE 1931 ȳ(620 nm)×683 = 255 lm/W; CIE V(620) ≈ 0.381 → 260 lm/W) and about 5.2× more effective per watt in the sRGB red channel, so it does the work of visual white balance and colour rendering. 660 nm is deep red: closest to the chlorophyll absorption peak, slightly more photons per joule (5.52 vs 5.18 µmol/J) and a higher wall-plug efficiency. Units: the colour solver counts each linear-sRGB channel in sun-equivalent watts, 1 unit = the R (G, B) stimulus of 1 W/m² of broadband 5778 K sunlight (all wavelengths; only ~38 % of it is in 400–700 nm). Unfiltered sunlight of I W/m² is therefore (I, I, I) and has red share 1/3. One optical W/m² of LED light at λ adds CMF→sRGB(λ) ÷ (the sun’s stimulus per broadband W): R = ${fmt(LED_CH[620].r,1)} at 620 nm and ${fmt(LED_CH[660].r,2)} at 660 nm (its small negative G/B, outside the sRGB gamut, is clipped to 0). The rendered LED light uses the same numbers: colour = that R:G:B, floor irradiance = W × R × 3.2/S₀ on the sun’s render scale (3.2 ≡ S₀ W/m²), and the interior sky light is put on the same scale, so the 3D view shows the colour the panel reports. Auto-balance (white, Duv = 0): solver channels × the sun’s per-W stimulus → absolute linear sRGB → CIE XYZ, plus the LED lines’ own CIE 1931 XYZ per W; CCT and Duv are the nearest point on the Planckian (blackbody) locus in CIE 1960 uv. Water leaves the light above the locus (blue-green, Duv > 0) and red moves it down; the W at which Duv = 0 is found by bisection and clamped to 0–100 W/m² (0 if the light is already on the pink side, and with no sunlight, so the LEDs switch off at night). Red light cannot replace the green that the water removes, so this white is a cool daylight white (high CCT), not sunlight’s ~5800 K; the older target “R/(R+G+B) = 1/3” overshot into a visible pink (Duv ≈ −0.017). Label: “white (CCT)” when |Duv| < ${WHITE_DUV_TOL} (≈ ANSI C78.377 tolerance), otherwise pink or blue-green tint. The R/G/B bars are the floor light’s channel shares relative to sunlight (sunlight = 33/33/33), not a white criterion. The mix slider stays user-set during auto (it is a design choice, not a power level). Photoperiod: default 16 h/sol (hours × 3600 s) when auto is off; when auto is on, DLI integrates the auto setpoint over one 24.66 h sol (same time grid as the sunlight DLI) and the hours slider is unused. Wall-plug assumptions: 38 % at 620 nm (mid of the 35–40 % range for orange-red diodes plus driver) and 52 % at 660 nm (mid of 50–55 %).</div>`;
    const fullHTML = `
  <h1>MARSOUPILAMI</h1>
  <div class="sub">Martian Overpressure Utility Pillow &amp; Laminated Membrane Infrastructure — tethered membrane dome (after Casey Handmer) with water pillows hung inside the membrane.</div>
  <h2>Geometry (to scale)</h2><table>
   <tr><td>Footprint Ø / tethered flat plateau Ø</td><td class="v">${fmt(2*G.R)} m / ${fmt(2*G.Rp)} m</td></tr>
   <tr><td>Membrane height at tether points / pillow crest</td><td class="v">${fmt(G.H,1)} m / ${fmt(G.H+G.bulge,2)} m</td></tr>
   <tr><td>Edge arc (60° at ground, 15° at plateau), radius</td><td class="v">${fmt(G.rho,1)} m</td></tr>
   <tr><td>Enclosed volume / air mass at 0.85 atm (net of water)</td><td class="v">${fmt(state.stats.volume/1000,0)}k m³ / ${fmt(Math.max(0, state.stats.volume - (state.stats.water||0))*1.025/1000,0)} t</td></tr>
   <tr><td>Anchor spacing / tethers per bundle</td><td class="v">${fmt(G.anchor)} m / ≤25</td></tr>
   <tr><td>Anchors / tethers total</td><td class="v">${anchors.length} / ${state.stats.nTethers ?? tetherCount()}</td></tr>
   <tr><td>Attachment grid = pillow cell</td><td class="v">${G.cell} × ${G.cell} m</td></tr>
   <tr><td>Pillow layers × pitch</td><td class="v">${L} × ${G.layerH} m</td></tr>
   <tr><td>Pillow ${fmt(PW,2)} × ${fmt(PH,2)} × ${fmt(PW,2)} m: water / open area per cell</td><td class="v">${fmt(PILLOW.V,2)} m³ (${fmt(100*PILLOW.depth,0)} % of a 1 m slab) / ${fmt(100*PILLOW.open,1)} %</td></tr>
   <tr><td>Clear height under water (plateau)</td><td class="v">${state.stats.waterBottom>0.3 ? fmt(state.stats.waterBottom,1)+' m' : '<span style="color:#ff8a6a">none</span>'}</td></tr>
   ${platformGroup.visible ? `<tr><td>Suspended platform Ø / walking surface</td><td class="v">${fmt(2*PLATFORM_R,0)} m / ${fmt(platformGroup.userData.deckY,1)} m</td></tr>` : ''}
   ${platformGroup.visible ? `<tr><td>Platform pool (${fmt(PLATFORM_POOL_W,2)} × ${fmt(PLATFORM_POOL_L,2)} × ${fmt(PLATFORM_POOL_D,2)} m water)</td><td class="v">${fmt(platformGroup.userData.poolKg||0,0)} kg water + ${fmt(platformGroup.userData.poolBasinKg||0,0)} kg basin</td></tr>` : ''}
   <tr><td>Pillows rendered / water</td><td class="v">${fmt(state.stats.pillowCount)} / ${fmt(state.stats.water)} t</td></tr>
   <tr><td>Nominal water (${L} layers over all cells)</td><td class="v">${fmt(cells.length*PILLOW.V*L)} t</td></tr>
   ${L>state.stats.maxFit ? `<tr><td colspan="2" style="color:#ff8a6a">⚠ ${L} m of water does not fit under a ${G.H} m dome: rendered stacks are clamped at the ground (max ${state.stats.maxFit} layers). Pressure, shielding and light figures use the nominal ${L} layers.</td></tr>` : ''}
  </table>
  <h2>Pressure balance</h2><table>
   <tr><td>Inside 0.85 atm − outside (~0.6 kPa)</td><td class="v">${fmt(dp,1)} kPa</td></tr>
   <tr><td>Water load ${L} × ${fmt(PILLOW.depth,3)} m × 1000 kg/m³ × 3.711 m/s²</td><td class="v">${fmt(waterKPa,1)} kPa (${fmt(100*waterKPa/dp,1)} %)</td></tr>
   <tr><td>Net uplift carried by tethers</td><td class="v">${fmt(net,1)} kPa</td></tr>
   <tr><td>Load per tether (4 m²) / per bundle (100 m²)</td><td class="v">${fmt(perTether,0)} kN / ${fmt(perBundle/1000,1)} MN</td></tr>
   <tr><td>Equivalent ballast per anchor (Mars g)</td><td class="v">${fmt(perBundle*1000/P.g/1000,0)} t</td></tr>
   <tr><td>Water for full balance (solid depth / pillow layers)</td><td class="v">${fmt(dp*1000/(P.rho*P.g),1)} m / ${fmt(dp*1000/(P.rho*P.g)/PILLOW.depth,1)}</td></tr>
  </table>
  <h2>Shielding vs. Earth</h2><table>
   <tr><td>Water ${L} layers (mean ${fmt(L*PILLOW.depth,2)} m solid)</td><td class="v">${fmt(waterCol)} g/cm²</td></tr>
   <tr><td>+ Mars atmosphere column (${fmt(P.pout*1000,0)} Pa / g<sub>Mars</sub>)</td><td class="v">${fmt(sh.marsCol,1)} g/cm²</td></tr>
   <tr><td><b>Total overhead mass</b></td><td class="v"><b>${fmt(sh.total,0)} g/cm²</b></td></tr>
   <tr><td>Earth sea-level atmosphere column</td><td class="v">${fmt(sh.earthCol,0)} g/cm²</td></tr>
   <tr><td><b>= share of Earth sea level</b></td><td class="v"><b>${fmt(100*sh.total/sh.earthCol,1)} %</b></td></tr>
   <tr><td><b>≈ like standing on Earth at</b></td><td class="v"><b>${sh.total>=sh.earthCol ? 'sea level or deeper (×'+fmt(sh.total/sh.earthCol,2)+')' : (sh.alt>47?'> 47 km':fmt(sh.alt,1)+' km')}</b></td></tr>
   <tr><td>(bare Mars surface, for reference)</td><td class="v">${fmt(sh.altMars,1)} km</td></tr>
   <tr><td>Water for Earth sea-level column (solid depth / pillow layers)</td><td class="v">${fmt((sh.earthCol-sh.marsCol)/100,1)} m / ${fmt((sh.earthCol-sh.marsCol)/100/PILLOW.depth,1)}</td></tr>
   <tr><td>Rough dose refs: Mars surface (RAD)</td><td class="v">~230 mSv/yr</td></tr>
   <tr><td>Earth natural background (world avg.)</td><td class="v">~2.4 mSv/yr</td></tr>
  </table>
  <div class="src">Equivalent altitude: hydrostatic column ∝ pressure, so overhead mass / 1033 g/cm² = p/p₀, inverted with the ICAO/US 1976 standard atmosphere (0–47 km). Water column is the mean over the roof (pillow volume / cell area); a sightline exactly along a 14 cm street sees less, any oblique one crosses pillows. Compares mass only: Earth also has a magnetosphere, and GCR dose does not scale linearly with mass (secondary particles), so no dose is computed for the water. Dose refs: Hassler et al. 2014, Science 343 (Curiosity RAD, 0.64 mSv/day ≈ 230 mSv/yr); UNSCEAR 2008 (2.4 mSv/yr).</div>
  <h2>Light — LTST ${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}, ${Math.abs(params.lat)}°${params.lat < 0 ? 'S' : 'N'} ${params.lon}°E, δ=${params.decl}°</h2><table>
   <tr><td>Sun elevation / azimuth</td><td class="v">${fmt(elev*180/Math.PI,1)}° / ${fmt(az,0)}°</td></tr>
   <tr><td>Outside global horiz. (τ=${params.tau})</td><td class="v">${fmt(I.glob)} W/m² (${fmt(100*I.glob/1000)} % of Earth 1000)</td></tr>
   <tr><td>Pillow stack transmission, direct sun (mean water path ${fmt(L*PILLOW.depth*pathFactor(Math.PI/2-Math.max(elev,0.01)),2)} m)</td><td class="v"></td></tr>
   <tr><td>&nbsp; R ${bar(w.direct.r,'#e04040')}</td><td class="v">${fmt(100*w.direct.r,1)} %</td></tr>
   <tr><td>&nbsp; G ${bar(w.direct.g,'#40c040')}</td><td class="v">${fmt(100*w.direct.g,1)} %</td></tr>
   <tr><td>&nbsp; B ${bar(w.direct.b,'#4070ff')}</td><td class="v">${fmt(100*w.direct.b,1)} %</td></tr>
   <tr><td>Diffuse sky light R / G / B</td><td class="v">${fmt(100*w.diffuse.r,0)} / ${fmt(100*w.diffuse.g,0)} / ${fmt(100*w.diffuse.b,0)} %</td></tr>
   <tr><td>+ outer membrane (bag films ${T_BAG} per pillow are in the stack values)</td><td class="v">× ${fmt(bag,3)}</td></tr>
   <tr><td>Illuminance outside → inside</td><td class="v">${fmt(luxOut/1000,1)} → ${fmt(luxOut*tY/1000,1)} klx (${fmt(100*tY)} %)</td></tr>
   <tr><td>PAR outside → inside</td><td class="v">${fmt(parOut)} → ${fmt(parOut*tPAR)} µmol/m²/s (${fmt(100*tPAR)} %)</td></tr>
   <tr><td>Daily light integral out → in (1 sol)${params.tunnels?' (with tunnels)':''}</td><td class="v">${fmt(dOut,1)} → ${fmt(dIn,1)} mol/m²</td></tr>
  </table>
  ${ledHTML}
  ${tunHTML}
  <div class="src">Water absorption: Pope &amp; Fry 1997, Appl. Opt. 36:8710 (400–700 nm, 10 nm steps; e.g. 450 nm 0.0092, 550 nm 0.0565, 650 nm 0.340, 700 nm 0.624 m⁻¹). Spectral Beer–Lambert with refraction into water (n=1.333), integrated with a 5778 K solar spectrum and CIE 1931 CMFs → linear sRGB, luminance and PAR photons. Pillows as drawn (${fmt(PW,2)} × ${fmt(PH,2)} × ${fmt(PW,2)} m rounded cushions on the ${G.cell} m grid): ${fmt(PILLOW.V,2)} m³ water each, i.e. ${fmt(PILLOW.depth,3)} m of water per layer averaged over the roof (used for mass, load and shielding), and ${fmt(100*PILLOW.open,1)} % open area per layer (tether streets + rounded corners). Optics: each layer is an area-weighted screen, T = open + Σ area·T<sub>bag</sub>·e<sup>−a·d·pf</sup> over the pillow’s chord lengths d, raised to the number of layers (layers independent: an oblique ray drifts out of the 14 cm streets). Mars: S₀=590 W/m², direct = S₀·e^(−τ/μ). Diffuse is the remainder of a δ-Eddington two-stream downward flux (Joseph, Wiscombe &amp; Weinman 1976, J. Atmos. Sci. 33:2452; Meador &amp; Weaver 1980, J. Atmos. Sci. 37:630) with solar-band dust ω₀=0.94, g=0.70 (Wolff et al. 2009; Madeleine et al. 2011) and surface albedo 0.20. At τ≤1 this stays within a few percent of the older 0.75·S₀μ(1−e^(−τ/μ)) fit; at τ=10.8 (Opportunity, June 2018) it falls to ~8 % of TOA instead of saturating at 75 %. 100 lm/W, 2.06 µmol/J. Dust colour of sun/sky is qualitative. Pillow geometry, tether count and loads are a conceptual layout, not a structural design.</div>`;

  const domeLine = `Dome: Ø ${fmt(2*G.R)} m · ${fmt(L*G.layerH,0)} m water sky · ${state.stats.waterBottom>0.3 ? fmt(state.stats.waterBottom,0)+' m clear' : '0 m clear'}`;
  const forcesLine = `Forces: ${fmt(dp,1)} kPa air ↑ = ${fmt(waterKPa,1)} kPa water ↓ + ${fmt(net,1)} kPa tethers ↓`;
  let shieldLine;
  if (sh.total >= sh.earthCol){
    shieldLine = `Shielding: ${fmt(sh.total,0)} g/cm² ≈ Earth at sea level or deeper`;
  } else {
    const altStr = sh.alt>47 ? '> 47 km' : `${fmt(sh.alt,1)} km`;
    const place = closestEarthPlace(sh.alt);
    shieldLine = `Shielding: ${fmt(sh.total,0)} g/cm² ≈ Earth at ${altStr} altitude${place ? ' ('+place.name+')' : ''}`;
  }
  const luxTot = luxIn + ledLux;
  let tint;
  if (luxTot < 5 || mixSum <= 1e-9 || !colMix) tint = 'night';
  else if (Math.abs(colMix.Duv) < WHITE_DUV_TOL) tint = `white (${fmt(Math.round(colMix.CCT/100)*100,0)} K)`;
  else if (colMix.Duv < 0) tint = 'pink tint';
  else tint = 'blue-green tint';
  let lightSrc = '';
  if (params.ledW > 0 && luxIn > 0.5) lightSrc = ' (Sun + 620/660 nm LEDs)';
  else if (params.ledW > 0) lightSrc = ' (620/660 nm LEDs)';
  const lightLine = `Light: ${fmt(luxTot/1000,1)} klx ${tint}${lightSrc}`;
  const dliTot = dIn + ledDLI;
  let botanyLine = `Botany: DLI ${fmt(dliTot,1)} mol/m²/sol`;
  if (params.ledW > 0) botanyLine += ` · ${fmt(elecWm2*canopyA/1000,0)} kW LED power`;
  const mixR = mixSum>0 ? (sunR+addR)/mixSum : 0, mixG = mixSum>0 ? (sunG+addG)/mixSum : 0, mixB = mixSum>0 ? (sunB+addB)/mixSum : 0;
  const mixMax = Math.max(mixR, mixG, mixB, 1e-9);
  const summaryHTML = `
  <div class="s-line">${domeLine}</div>
  <div class="s-line">${forcesLine}</div>
  <div class="s-line">${shieldLine}</div>
  <div class="s-line">${lightLine}</div>
  <div class="s-line">${botanyLine}</div>
  <div class="s-bars">
    <div class="cap">Interior colour</div>
    <table>
      <tr><td>R ${bar(mixR/mixMax,'#e04040')}</td><td class="v">${fmt(100*mixR,0)} %</td></tr>
      <tr><td>G ${bar(mixG/mixMax,'#40c040')}</td><td class="v">${fmt(100*mixG,0)} %</td></tr>
      <tr><td>B ${bar(mixB/mixMax,'#4070ff')}</td><td class="v">${fmt(100*mixB,0)} %</td></tr>
    </table>
  </div>`;
  window.__summary = { dome:domeLine, forces:forcesLine, shielding:shieldLine, light:lightLine, botany:botanyLine, mix:{r:mixR,g:mixG,b:mixB} };
  applyInfoModeChrome();
  const html = state.infoMode==='summary' ? summaryHTML : fullHTML;
  if (html !== _lastInfoHTML){ _lastInfoHTML = html; document.getElementById('infoBody').innerHTML = html; }
}

export { applyInfoModeChrome, renderInfoPanel };
