// Keyboard and mouse input. Held keys give movement; one-shot presses (enter a car,
// punch, pause, confirm) are queued as bit flags and taken once by the loop, so a press
// between two frames is never lost and never counted twice. The mouse position is kept
// in screen pixels; the caller converts it to world coordinates for aiming.
// Round 3: no input change — the polish is visual only.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MUTE = 16;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const PUNCH = new Set(['Space']);
const SHOOT = new Set(['KeyF']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  let up = false;
  let down = false;
  let left = false;
  let right = false;
  let run = false;
  let shooting = false;
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;

  function onKey(code, pressed, repeat) {
    if (UP.has(code)) up = pressed;
    else if (DOWN.has(code)) down = pressed;
    else if (LEFT.has(code)) left = pressed;
    else if (RIGHT.has(code)) right = pressed;
    else if (RUN.has(code)) run = pressed;
    else if (SHOOT.has(code)) shooting = pressed;
    else if (!pressed || repeat) return;
    else if (PUNCH.has(code)) actions |= ACTION_PUNCH | ACTION_CONFIRM;
    else if (ENTER.has(code)) actions |= ACTION_ENTER;
    else if (PAUSE.has(code)) actions |= ACTION_PAUSE;
    else if (MUTE.has(code)) actions |= ACTION_MUTE;
    else if (CONFIRM.has(code)) actions |= ACTION_CONFIRM;
    else return;
    if (CONFIRM.has(code) || PUNCH.has(code) || PAUSE.has(code) || ENTER.has(code) || MUTE.has(code)) {
      // Keep the page from scrolling on Space / arrows while playing.
    }
  }

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)
      || CONFIRM.has(event.code) || PUNCH.has(event.code)) event.preventDefault();
    onKey(event.code, true, event.repeat);
  });
  window.addEventListener('keyup', (event) => onKey(event.code, false, false));
  window.addEventListener('blur', () => {
    up = false; down = false; left = false; right = false; run = false; shooting = false;
  });

  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseDown = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => { mouseDown = false; });

  return {
    /** Held-key movement, -1/0/1 per axis, plus run and shooting. */
    held() {
      return {
        up, down, left, right, run,
        shoot: shooting || mouseDown,
        punch: false,
        enter: false,
        aimScreen: { x: mouseX, y: mouseY },
      };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
