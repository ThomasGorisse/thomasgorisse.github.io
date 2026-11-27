import { checkDoor, checkHall, checkStairWidth, presetDimensions, CM_PER_INCH } from './fit.js';

const form = document.querySelector('[data-checker]');
const mode = form.dataset.checker;
const inputs = [...form.querySelectorAll('[data-size]')];
const unitInputs = [...form.querySelectorAll('[name="unit"]')];
const preset = form.querySelector('#preset');
const title = document.querySelector('#verdict-title');
const margin = document.querySelector('#verdict-margin');
const orientation = document.querySelector('#verdict-carry');
const status = document.querySelector('#verdict');
const widthStatus = document.querySelector('#width-verdict');
const appliance = form.dataset.appliance;
const f = Math.fround;
let unit = /^en-US$/i.test(navigator.language || '') ? 'in' : 'cm';
const values = new Map();
const carries = {
  UPRIGHT: mode === 'door' ? 'upright, facing the door' : 'upright, facing ahead',
  UPRIGHT_SIDEWAYS: 'upright, turned sideways',
  ON_ITS_SIDE: 'on its side',
  ON_ITS_SIDE_SIDEWAYS: 'on its side, turned',
  ON_ITS_BACK: 'on its back',
  ON_ITS_BACK_SIDEWAYS: 'on its back, turned',
};
const sideNames = { widthCm: 'width', depthCm: 'depth', heightCm: 'height' };
const axes = {
  UPRIGHT: ['widthCm', 'heightCm'], UPRIGHT_SIDEWAYS: ['depthCm', 'heightCm'],
  ON_ITS_SIDE: ['heightCm', 'widthCm'], ON_ITS_SIDE_SIDEWAYS: ['depthCm', 'widthCm'],
  ON_ITS_BACK: ['widthCm', 'depthCm'], ON_ITS_BACK_SIDEWAYS: ['heightCm', 'depthCm'],
};

function parse(input) {
  const text = input.value.trim().replace(',', '.');
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return null;
  const number = f(Number(text));
  const cm = unit === 'in' ? f(number * CM_PER_INCH) : number;
  return Number.isFinite(cm) && cm >= 1 && cm <= 1000 ? cm : null;
}

function fieldNumber(cm) {
  // Keep the underlying Float cm on a toggle; display enough digits to avoid rounding sizes.
  return String(Number((unit === 'in' ? cm / CM_PER_INCH : cm).toFixed(4)));
}

function gapText(cm) {
  // A small miss should never look like an exact fit. One decimal, at least 0.1 if nonzero.
  const raw = Math.abs(cm) / (unit === 'in' ? CM_PER_INCH : 1);
  const rounded = raw === 0 ? 0 : Math.max(0.1, Math.round(raw * 10) / 10);
  return `${rounded} ${unit}`;
}

function updateStairWidth(obj) {
  const invalid = ['object-width', 'object-depth', 'object-height', 'space-stair']
    .some(id => values.get(id) === null);
  if (invalid) {
    widthStatus.dataset.state = 'empty';
    document.querySelector('#width-title').textContent = 'Stair width only';
    document.querySelector('#width-margin').textContent = 'Enter the object sizes and the narrowest clear stair width.';
    document.querySelector('#width-carry').textContent = 'Flight headroom and tilting are not checked.';
    return;
  }
  const w = checkStairWidth(obj, values.get('space-stair'));
  const [across, up] = axes[w.carry];
  widthStatus.dataset.state = !w.fits ? 'no' : w.isTight ? 'tight' : 'yes';
  document.querySelector('#width-title').textContent = !w.fits ? 'Stair width: too narrow' : w.isTight ? 'Stair width: a tight size match' : 'Stair width: a size match';
  document.querySelector('#width-margin').textContent = `${gapText(w.marginCm)} ${w.fits ? 'to spare' : 'too wide'} · narrowest object side: ${gapText(obj[across])}`;
  document.querySelector('#width-carry').textContent = `Width-only orientation: ${carries[w.carry]}. Object ${sideNames[across]} across, ${sideNames[up]} up. No flight headroom or tilting check. The landing may need a different orientation; changing between them is not simulated.`;
}

function update() {
  const obj = { widthCm: values.get('object-width'), depthCm: values.get('object-depth'), heightCm: values.get('object-height') };
  if (mode === 'stairs') updateStairWidth(obj);
  // Each stair check depends only on its own measurements.
  const invalid = inputs.filter(input => input.id !== 'space-stair' && values.get(input.id) === null);
  for (const input of inputs) input.setAttribute('aria-invalid', String(values.get(input.id) === null));
  if (invalid.length) {
    status.dataset.state = 'empty';
    title.textContent = mode === 'stairs' ? 'Enter the object and landing measurements' : 'Enter all your measurements';
    margin.textContent = unit === 'cm' ? 'Use a number from 1 to 1,000 cm in every field.'
      : 'Use a size between 1 and 1,000 cm, expressed in inches (about 0.4–393.7 in).';
    orientation.textContent = 'The result updates as you type.';
    return;
  }
  const space = { widthCm: values.get('space-width'), heightCm: values.get('space-height'),
    turnWidthCm: values.get('space-turn'), ceilingCm: values.get('space-ceiling') };
  const v = mode === 'door' ? checkDoor(obj, space) : checkHall(obj, space);
  const nonUprightAppliance = appliance && v.fits && !v.carry.startsWith('UPRIGHT');
  status.dataset.state = !v.fits ? 'no' : v.isTight || nonUprightAppliance ? 'tight' : 'yes';
  title.textContent = mode === 'door'
    ? (!v.fits ? "No, it won't go through" : nonUprightAppliance ? 'Only a non-upright size match' : v.isTight ? "Yes, but it's tight" : 'Yes, it goes through')
    : mode === 'stairs'
      ? (!v.fits ? 'Landing turn: no size match' : v.isTight ? 'Landing turn: a tight size match' : 'Landing turn: a size match')
    : (!v.fits ? "No, it won't make the turn" : v.isTight ? 'Yes, but the turn is tight' : 'Yes, it makes the turn');
  const gap = gapText(v.marginCm);
  const limits = { WIDTH: mode === 'stairs' ? 'landing approach width' : 'hallway width', TURN: 'the turn', CEILING: mode === 'stairs' ? 'landing headroom' : 'ceiling' };
  margin.textContent = v.fits ? `${gap} to spare${mode !== 'door' ? ` · ${limits[v.limit]}` : ''}`
    : mode === 'door' ? `${gap} too big`
      : ({ WIDTH: `${gap} too wide for the ${mode === 'stairs' ? 'landing approach' : 'hallway'}`, TURN: `${gap} too long to make the turn`, CEILING: `${gap} too tall for the ${mode === 'stairs' ? 'landing headroom' : 'ceiling'}` })[v.limit];
  const [across, up] = axes[v.carry];
  orientation.textContent = `${appliance || mode === 'stairs' ? 'Geometric orientation:' : v.fits ? 'Carry it' : 'Closest orientation:'} ${carries[v.carry]}. Object ${sideNames[across]} across, ${sideNames[up]} up.`;
}

function renderFields() {
  for (const input of inputs) {
    const cm = values.get(input.id);
    if (cm !== null) input.value = fieldNumber(cm);
  }
  for (const label of form.querySelectorAll('[data-unit]')) label.textContent = unit;
  for (const radio of unitInputs) radio.checked = radio.value === unit;
  update();
}

function applyPreset() {
  if (preset.value === 'custom') return;
  const dims = presetDimensions(preset.value, unit);
  ['object-width', 'object-depth', 'object-height'].forEach((id, i) => values.set(id, dims[i]));
  renderFields();
}

for (const input of inputs) {
  const initial = unit === 'in' ? f(Number(input.dataset.inches) * CM_PER_INCH) : Number(input.value);
  values.set(input.id, initial);
  input.addEventListener('input', () => {
    values.set(input.id, parse(input));
    if (input.id.startsWith('object-')) preset.value = 'custom';
    update();
  });
}
for (const radio of unitInputs) radio.addEventListener('change', () => {
  if (!radio.checked) return;
  // Invalid/incomplete text has no length to convert: clear it when its unit changes.
  for (const input of inputs) if (values.get(input.id) === null) input.value = '';
  unit = radio.value;
  renderFields();
});
preset.addEventListener('change', applyPreset);
// Defensive: even Enter in a field cannot submit sizes or navigate away.
form.addEventListener('submit', event => event.preventDefault());
form.querySelector('.controls').disabled = false;
applyPreset();
