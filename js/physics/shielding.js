// MARSOUPILAMI · physics/shielding.js
// Radiation shielding comparison: ISA standard atmosphere and well-known Earth elevations.

// ICAO / US Standard Atmosphere 1976 pressure ratio p/p0 vs geopotential altitude (km), 0–47 km
function isaRatio(hkm){
  const h=hkm*1000;
  if (h<=11000) return Math.pow(1-2.25577e-5*h, 5.25588);
  if (h<=20000) return 0.223361*Math.exp(-(h-11000)/6341.62);
  if (h<=32000) return 0.054033*Math.pow(1+(h-20000)/216650, -34.1632);
  return 0.0085666*Math.pow(1+2.8*(h-32000)/228650, -12.2011);
}
function isaAltitude(ratio){ if (ratio>=1) return 0; if (ratio<isaRatio(47)) return 99;
  let lo=0, hi=47; for (let i=0;i<60;i++){ const m=(lo+hi)/2; if (isaRatio(m)>ratio) lo=m; else hi=m; } return (lo+hi)/2; }
// Well-known Earth elevations (km) for the Summary shielding line; pick the closest if it is a reasonable match.
const EARTH_PLACES = [
  { name:'sea level', km:0 },
  { name:'Munich', km:0.519 },
  { name:'Denver', km:1.609 },
  { name:'St. Moritz', km:1.822 },
  { name:'Mexico City', km:2.240 },
  { name:'Quito', km:2.850 },
  { name:'La Paz', km:3.640 },
  { name:'Mont Blanc', km:4.808 },
  { name:'Everest Base Camp', km:5.364 },
  { name:'Kilimanjaro', km:5.895 },
  { name:'Aconcagua', km:6.961 },
  { name:'Everest', km:8.849 },
  { name:'airliner cruise', km:11.0 },
];
function closestEarthPlace(altKm){
  let best = EARTH_PLACES[0], bd = Math.abs(best.km - altKm);
  for (const p of EARTH_PLACES){ const d = Math.abs(p.km - altKm); if (d < bd){ best=p; bd=d; } }
  // Omit the name if nothing in the table is nearby (e.g. mid-stratosphere at 0 water layers).
  return bd <= 1.25 ? best : null;
}

export { closestEarthPlace, isaAltitude };
