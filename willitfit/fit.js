// Ported from Will It Fit 3.1.0: fit/DoorCheck.kt and fit/HallCheck.kt.
// Math.fround preserves Kotlin Float inputs and intermediate Float arithmetic;
// turn() uses doubles for trigonometry, then returns Floats, as Kotlin does.
const f = Math.fround;
export const TIGHT_CM = 2;
export const CM_PER_INCH = f(2.54);

// Keep the Kotlin enum order: it is the final tie-breaker in both checks.
export const CARRIES = Object.freeze([
  { id: 'UPRIGHT', across: 'widthCm', up: 'heightCm', along: 'depthCm', isUpright: true },
  { id: 'UPRIGHT_SIDEWAYS', across: 'depthCm', up: 'heightCm', along: 'widthCm', isUpright: true },
  { id: 'ON_ITS_SIDE', across: 'heightCm', up: 'widthCm', along: 'depthCm', isUpright: false },
  { id: 'ON_ITS_SIDE_SIDEWAYS', across: 'depthCm', up: 'widthCm', along: 'heightCm', isUpright: false },
  { id: 'ON_ITS_BACK', across: 'widthCm', up: 'depthCm', along: 'heightCm', isUpright: false },
  { id: 'ON_ITS_BACK_SIDEWAYS', across: 'heightCm', up: 'depthCm', along: 'widthCm', isUpright: false },
].map((carry, ordinal) => Object.freeze({ ...carry, ordinal })));

// Width × depth × height, in cm, from fit/Presets.kt. Typical sizes, not product sheets.
export const PRESETS = Object.freeze({
  sofa2: Object.freeze([170, 90, 85]),
  sofa3: Object.freeze([220, 95, 85]),
  fridge: Object.freeze([60, 66, 186]),
  wardrobe: Object.freeze([100, 60, 201]),
  bed140: Object.freeze([150, 205, 95]),
  bed160: Object.freeze([170, 215, 95]),
  washer: Object.freeze([60, 60, 85]),
});

// Website examples only: these are not presets in the Android app.
// Mattress thickness and assembled frame dimensions must be replaced with actual sizes.
export const WEB_EXAMPLES = Object.freeze({
  bed180: Object.freeze([190, 215, 95]),
  mattress140: Object.freeze([140, 190, 25]),
  mattress160: Object.freeze([160, 200, 25]),
  mattress180: Object.freeze([180, 200, 25]),
  dryer: Object.freeze([60, 65, 85]),
});

// Preset.dimensionsIn(INCH): whole inches, converted back to Float centimetres.
export function presetDimensions(id, unit = 'cm') {
  return (PRESETS[id] ?? WEB_EXAMPLES[id]).map(cm => unit === 'in'
    ? f(Math.round(f(cm / CM_PER_INCH)) * CM_PER_INCH) : cm);
}

function result(fits, carry, marginCm, extra = {}) {
  return { fits, carry: carry.id, marginCm, isTight: fits && marginCm < TIGHT_CM, ...extra };
}

function fittingOrder(a, b) {
  return Number(b.carry.isUpright) - Number(a.carry.isUpright)
    || b.marginCm - a.marginCm || a.carry.ordinal - b.carry.ordinal;
}

// Only the width side of DoorCheck, across the narrowest of the same six carries.
// This is not a stair simulation: no headroom, slope or change of orientation is checked.
export function checkStairWidth(obj, widthCm) {
  const carry = CARRIES.reduce((best, next) =>
    f(obj[next.across]) < f(obj[best.across]) ? next : best);
  const marginCm = f(f(widthCm) - f(obj[carry.across]));
  return result(marginCm >= 0, carry, marginCm);
}

export function checkDoor(obj, door) {
  const all = CARRIES.map(carry => ({
    carry,
    marginCm: Math.min(
      f(f(door.widthCm) - f(obj[carry.across])),
      f(f(door.heightCm) - f(obj[carry.up])),
    ),
  }));
  const fitting = all.filter(v => v.marginCm >= 0);
  const best = fitting.length ? fitting.sort(fittingOrder)[0]
    : all.sort((a, b) => b.marginCm - a.marginCm || a.carry.ordinal - b.carry.ordinal)[0];
  return result(fitting.length > 0, best.carry, best.marginCm);
}

export function turn(widthCm, turnWidthCm, acrossCm) {
  const a = f(widthCm), b = f(turnWidthCm), w = f(acrossCm);
  if (w > a || w > b) return { longestCm: f(Math.min(a, b) - w), angleDeg: 45 };
  let best = Number.MAX_VALUE, bestDeg = 45;
  for (let i = 1; i < 900; i++) {
    const deg = i / 10;
    const t = deg * Math.PI / 180;
    const s = Math.sin(t), c = Math.cos(t);
    const length = (a * s + b * c - w) / (s * c);
    if (length < best) { best = length; bestDeg = deg; }
  }
  return { longestCm: f(best), angleDeg: f(bestDeg) };
}

export function checkHall(obj, hall) {
  const narrowest = Math.min(f(hall.widthCm), f(hall.turnWidthCm));
  const all = CARRIES.map(carry => {
    const across = f(obj[carry.across]), along = f(obj[carry.along]);
    const widthGap = f(narrowest - across);
    const ceilingGap = f(f(hall.ceilingCm) - f(obj[carry.up]));
    const corner = turn(hall.widthCm, hall.turnWidthCm, Math.min(across, narrowest));
    const turnGap = f(corner.longestCm - along);
    // Kotlin minBy keeps the first tied minimum: ceiling, width, then turn.
    const gaps = [{ limit: 'CEILING', gap: ceilingGap }, { limit: 'WIDTH', gap: widthGap }];
    if (widthGap >= 0) gaps.push({ limit: 'TURN', gap: turnGap });
    const tightest = gaps.reduce((a, b) => b.gap < a.gap ? b : a);
    // Kotlin sumOf converts each negative Float gap to Double before summing.
    const missing = f(Math.min(widthGap, 0) + Math.min(ceilingGap, 0) + Math.min(turnGap, 0));
    return { carry, marginCm: tightest.gap, limit: tightest.limit, angleDeg: corner.angleDeg, missing };
  });
  const fitting = all.filter(v => v.marginCm >= 0);
  const best = fitting.length ? fitting.sort(fittingOrder)[0]
    : all.sort((a, b) => b.missing - a.missing || a.carry.ordinal - b.carry.ordinal)[0];
  return result(fitting.length > 0, best.carry, best.marginCm, { limit: best.limit, angleDeg: best.angleDeg });
}
