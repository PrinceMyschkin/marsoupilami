// MARSOUPILAMI · physics/mars-environment.js
// Mars environment: pressures, sun position, δ-Eddington two-stream dust model, surface irradiance,
// luminous efficacy and PAR conversion of sunlight.
import * as THREE from 'three';

// ============================================================================
//  PHYSICS: pressure
// ============================================================================
const P = { atm: 101.325, pin: 0.85*101.325, pout: 0.61, g: 3.711, rho: 1000 };

// ============================================================================
//  SUN & MARS ATMOSPHERE
// ============================================================================
const S0 = 590;   // W/m² top of Mars atmosphere at mean distance (1361 / 1.524²)
function sunVector(hours, latDeg, declDeg){
  const H=(hours-12)*15*Math.PI/180, f=latDeg*Math.PI/180, d=declDeg*Math.PI/180;
  const E=-Math.cos(d)*Math.sin(H), N=Math.sin(d)*Math.cos(f)-Math.cos(d)*Math.sin(f)*Math.cos(H),
        U=Math.sin(d)*Math.sin(f)+Math.cos(d)*Math.cos(f)*Math.cos(H);
  return new THREE.Vector3(E, U, -N).normalize();   // x = east, y = up, z = south
}
// Mars dust, solar band: single-scatter albedo and asymmetry (Wolff et al. 2009,
// Madeleine et al. 2011; mid-visible / solar-weighted values are ~0.93–0.95 and
// ~0.65–0.7). Surface broadband albedo ~0.2 (typical TES / Lambert mean).
const DUST_SSA = 0.94, DUST_G = 0.70, DUST_ALB = 0.20;
// Total downward flux at the surface (direct + diffuse) from a δ-Eddington
// two-stream (Joseph, Wiscombe & Weinman 1976; Meador & Weaver 1980).
// The beam in this solution is the δ-scaled “direct”; callers split off the
// true Beer–Lambert sun-disk (unscaled τ) and treat the rest as diffuse.
function dustTwoStreamDown(mu0, tau){
  mu0 = Math.min(Math.max(mu0, 1e-3), 1);
  const omega = Math.min(DUST_SSA, 0.999999), g = DUST_G, alb = DUST_ALB;
  const f = g*g;
  const taup = (1 - omega*f) * tau;
  let omegap = (1 - omega*f) > 1e-12 ? (1-f)*omega / (1 - omega*f) : 0;
  omegap = Math.min(omegap, 0.999999);
  const gp = g / (1 + g);
  const y1 = (7 - omegap*(4 + 3*gp))/4;
  const y2 = -(1 - omegap*(4 - 3*gp))/4;
  const y3 = (2 - 3*gp*mu0)/4;
  const y4 = 1 - y3;
  const lam = Math.sqrt(Math.max(y1*y1 - y2*y2, 0)) || 1e-8;
  let mu = mu0, den = lam*lam - 1/(mu*mu);
  if (Math.abs(den) < 1e-7){
    mu = mu0 * (mu0 > 0.5 ? 0.998 : 1.002);
    den = lam*lam - 1/(mu*mu);
    if (Math.abs(den) < 1e-7) den = den >= 0 ? 1e-7 : -1e-7;
  }
  const src = omegap * S0, invm = 1/mu;
  const P = src * ((y1 - invm)*y3 + y2*y4) / den;
  const Q = src * ((y1 + invm)*y4 + y2*y3) / den;
  const Rp = Math.abs(y2) < 1e-12 ? 0 : (y1 - lam)/y2;
  const Rm = Math.abs(y2) < 1e-12 ? 0 : (y1 + lam)/y2;
  const eLam = Math.exp(-Math.min(lam*taup, 80));
  const eSun = Math.exp(-Math.min(taup/mu, 80));
  const rhs = alb*(Q*eSun + S0*mu*eSun) - P*eSun;
  const a11 = Rp*eLam, a12 = Rm, b1 = -Q;
  const a21 = 1 - alb*Rp, a22 = eLam*(1 - alb*Rm), b2 = rhs;
  const det = a11*a22 - a12*a21;
  const U = Math.abs(det) < 1e-18 ? 0 : (b1*a22 - a12*b2)/det;
  const V = Math.abs(det) < 1e-18 ? 0 : (a11*b2 - b1*a21)/det;
  const downDif = U*Rp + V*Rm*eLam + Q*eSun;
  return Math.max(0, downDif + S0*mu*eSun);
}
function irradiance(mu, tau){   // mu = sin(elevation)
  // twilight: fade out the two-stream sky at the clamped low-sun value, so it is continuous at the
  // horizon and follows τ (a dusty sky is dark at sunset too; the old fixed 1.2 % of S₀ ignored τ)
  if (mu <= 0) { const tw = dustTwoStreamDown(0.035, tau)*THREE.MathUtils.smoothstep(mu, -0.3, 0); return {dni:0, dir:0, dif:tw, glob:tw}; }
  const m = Math.max(mu, 0.035), tr = Math.exp(-tau/m);
  const dni = S0*tr, dir = dni*m;
  // Diffuse = two-stream global minus the unscattered beam. At τ ≤ 1 this stays
  // close to the old 0.75·S₀μ(1−e^{−τ/μ}) fit; at τ ≈ 11 it no longer saturates
  // at 75 % of TOA (that fit stayed bright even in a global storm).
  const glob = dustTwoStreamDown(m, tau), dif = Math.max(0, glob - dir);
  return { dni, dir, dif, glob: dir + dif };
}
const LUM_EFF = 100;  // lm/W, broadband sunlight
const PAR_PER_W = 2.06; // µmol photons PAR per J of broadband sunlight

export { irradiance, LUM_EFF, P, PAR_PER_W, S0, sunVector };
