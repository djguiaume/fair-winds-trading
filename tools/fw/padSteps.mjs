// `npm run shots -- --pad "lx=0.8:1500,rb:100"` (decision 0162): a fake controller's steps.

/** The standard controller layout's buttons in the browser's order (src/input/gamepad.ts). */
const PAD_BUTTONS = 'a b x y lb rb lt rt view menu ls rs up down left right home'.split(' ');
const PAD_AXES = ['lx', 'ly', 'rx', 'ry'];

/** `name[=value]:ms` steps (a list or comma separated) as axis or button, value and time. */
export const padSteps = (v) =>
  (Array.isArray(v) ? v : String(v).split(',').filter(Boolean)).map((step) => {
    const [what, ms] = String(step).split(':');
    const [name, value] = what.split('=');
    const axis = PAD_AXES.indexOf(name);
    const button = PAD_BUTTONS.indexOf(name);
    if (axis < 0 && button < 0) throw new Error(`no pad button or axis "${name}"`);
    return { axis, button, value: value === undefined ? 1 : Number(value), n: Number(ms) || 100 };
  });
