// Vireo Bay — keyboard and mouse input. WASD / arrows drive and walk, E enters
// or steals a car, Space punches (and confirms), F shoots, P pauses, M mutes.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_SHOOT = 16;

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  KeyE: 'enter',
  Space: 'punch',
  KeyF: 'shoot',
  KeyP: 'pause',
  Escape: 'pause',
  KeyM: 'mute',
  Enter: 'confirm',
};

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  let muted = false;

  function onKeyDown(event) {
    const name = KEYMAP[event.code];
    if (!name) return;
    event.preventDefault();
    if (!held.has(name)) pressed.add(name);
    held.add(name);
  }
  function onKeyUp(event) {
    const name = KEYMAP[event.code];
    if (name) held.delete(name);
  }
  function onMouseDown(event) {
    event.preventDefault();
    pressed.add('confirm');
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onMouseDown);

  return {
    get muted() {
      return muted;
    },
    /** Steering -1..1 and throttle 0..1 for driving. */
    drive() {
      const steer = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
      const gas = held.has('up') ? 1 : 0;
      const brake = held.has('down') ? 1 : 0;
      return { steer, gas, brake };
    },
    /** A unit-ish walk vector for moving on foot. */
    walk() {
      const x = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
      const y = (held.has('down') ? 1 : 0) - (held.has('up') ? 1 : 0);
      const len = Math.hypot(x, y) || 1;
      return { x: x / len, y: y / len, moving: x !== 0 || y !== 0 };
    },
    /** Edge-triggered actions since the last call; also toggles mute. */
    takeActions() {
      let mask = 0;
      if (pressed.has('confirm') || pressed.has('punch')) mask |= ACTION_CONFIRM;
      if (pressed.has('pause')) mask |= ACTION_PAUSE;
      if (pressed.has('enter')) mask |= ACTION_ENTER;
      if (pressed.has('punch')) mask |= ACTION_PUNCH;
      if (pressed.has('shoot')) mask |= ACTION_SHOOT;
      if (pressed.has('mute')) muted = !muted;
      pressed.clear();
      return mask;
    },
  };
}
