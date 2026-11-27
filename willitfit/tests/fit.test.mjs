import assert from 'node:assert/strict';
import { checkDoor, checkHall, turn, CARRIES, TIGHT_CM } from '../fit.js';

const obj = ([widthCm, depthCm, heightCm]) => ({ widthCm, depthCm, heightCm });
const door = ([widthCm, heightCm]) => ({ widthCm, heightCm });
const hall = ([widthCm, turnWidthCm, ceilingCm]) => ({ widthCm, turnWidthCm, ceilingCm });
// Same inputs and expectations as DoorCheckTest.kt / HallCheckTest.kt in Will It Fit 3.1.0.
const cases = [
  ['door: washing machine upright', checkDoor, [60, 60, 85], door([78, 200]), true, 'UPRIGHT', 18, false],
  ['door: wardrobe sideways', checkDoor, [100, 60, 201], door([78, 204]), true, 'UPRIGHT_SIDEWAYS', 3, false],
  ['door: wardrobe lying down', checkDoor, [100, 60, 201], door([78, 200]), true, 'ON_ITS_SIDE_SIDEWAYS', 18, false],
  ['door: upright wins over a larger lying margin', checkDoor, [77, 40, 199], door([78, 200]), true, 'UPRIGHT', 1, true],
  ['door: exact fit is tight', checkDoor, [78, 50, 200], door([78, 200]), true, null, 0, true],
  ['door: one millimetre too wide on every side', checkDoor, [78.1, 78.1, 200.1], door([78, 200]), false, null, -0.1, false],
  ['door: three-seat sofa misses', checkDoor, [220, 95, 85], door([78, 200]), false, 'ON_ITS_BACK_SIDEWAYS', -7, false],
  ['door: wider door passes sofa on its back', checkDoor, [220, 95, 85], door([90, 204]), true, 'ON_ITS_BACK_SIDEWAYS', 5, false],
  ['hall: washing machine upright', checkHall, [60, 60, 85], hall([78, 78, 240]), true, 'UPRIGHT', 18, false, 'WIDTH'],
  ['hall: two-seat sofa on its end', checkHall, [170, 90, 85], hall([100, 100, 240]), true, 'ON_ITS_SIDE', 15, false],
  ['hall: three-seat sofa misses the turn', checkHall, [220, 95, 85], hall([90, 90, 240]), false, 'ON_ITS_SIDE', 2 * (90 * Math.sqrt(2) - 85) - 95, false, 'TURN'],
  ['hall: wardrobe misses ceiling by 1 cm', checkHall, [100, 60, 201], hall([90, 90, 200]), false, 'UPRIGHT_SIDEWAYS', -1, false, 'CEILING'],
  ['hall: too wide, not too long', checkHall, [100, 100, 100], hall([90, 90, 240]), false, null, -10, false, 'WIDTH'],
];
for (const [name, check, dims, space, fits, carry, margin, tight, limit] of cases) {
  const v = check(obj(dims), space);
  assert.equal(v.fits, fits, `${name}: fits`);
  if (carry) assert.equal(v.carry, carry, `${name}: carry`);
  const tolerance = check === checkDoor && margin !== -0.1 ? 0.001 : 0.01;
  assert.ok(Math.abs(v.marginCm - margin) < tolerance, `${name}: margin ${v.marginCm}, expected ${margin}`);
  assert.equal(v.isTight, tight, `${name}: tight`);
  if (limit) assert.equal(v.limit, limit, `${name}: limiting side`);
  console.log(`PASS ${name}`);
}
// Analytical checks from HallCheckTest.kt also cover the 0.1° turn search.
for (const [a, b, w, expected] of [
  [100, 100, 0, 200 * Math.sqrt(2)],
  [80, 120, 0, (80 ** (2 / 3) + 120 ** (2 / 3)) ** 1.5],
  [90, 90, 80, 2 * (90 * Math.sqrt(2) - 80)],
]) assert.ok(Math.abs(turn(a, b, w).longestCm - expected) < 0.01);
assert.equal(turn(100, 100, 0).angleDeg, 45);
assert.ok(turn(90, 70, 80).longestCm < 0);
assert.equal(new Set(CARRIES.map(c => `${c.across}/${c.up}/${c.along}`)).size, 6);
assert.equal(TIGHT_CM, 2);
// The threshold is strict: 2 cm is not tight (also the app screenshot's verdict).
assert.equal(checkDoor(obj([76, 76, 198]), door([78, 200])).isTight, false);
console.log(`${cases.length} Kotlin verdict cases + turn geometry, six orientations and tight threshold passed.`);
