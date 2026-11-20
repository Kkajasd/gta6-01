// Keyboard and mouse input for Vireo Bay: one shared state object the
// simulation reads every step, plus edge-triggered actions (enter, punch,
// shoot) that fire once per press.
export function createInput() {
  return {
    up: false, down: false, left: false, right: false,
    enter: false, punch: false, shoot: false, handbrake: false,
    pause: false, any: false,
    mouseX: 0, mouseY: 0, clicked: false,
  };
}

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  KeyE: 'enter',
  Space: 'punch',
  KeyF: 'shoot',
  ShiftLeft: 'handbrake', ShiftRight: 'handbrake',
  KeyP: 'pause',
};

// Bind keyboard + mouse on the given window/canvas; returns an unbind fn.
export function bindInput(input, target, canvas) {
  function down(e) {
    const name = KEYMAP[e.code];
    if (!name) return;
    if (name === 'pause') { input.pause = true; }
    else if (name === 'enter' || name === 'punch' || name === 'shoot') {
      if (!input[name]) input[name] = true;
    } else {
      input[name] = true;
    }
    input.any = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  }
  function up(e) {
    const name = KEYMAP[e.code];
    if (!name || name === 'pause') return;
    if (name === 'enter' || name === 'punch' || name === 'shoot') return;
    input[name] = false;
  }
  function mouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - rect.left;
    input.mouseY = e.clientY - rect.top;
  }
  function mouseDown(e) {
    mouseMove(e);
    input.clicked = true;
    input.any = true;
  }
  // Losing focus must not leave a key stuck down.
  function blur() {
    input.up = input.down = input.left = input.right = false;
    input.handbrake = false;
  }
  target.addEventListener('keydown', down);
  target.addEventListener('keyup', up);
  target.addEventListener('blur', blur);
  canvas.addEventListener('mousemove', mouseMove);
  canvas.addEventListener('mousedown', mouseDown);
  return function unbind() {
    target.removeEventListener('keydown', down);
    target.removeEventListener('keyup', up);
    target.removeEventListener('blur', blur);
    canvas.removeEventListener('mousemove', mouseMove);
    canvas.removeEventListener('mousedown', mouseDown);
  };
}

// Clear the edge-triggered actions after each simulation step.
export function clearEdges(input) {
  input.enter = false;
  input.punch = false;
  input.shoot = false;
  input.pause = false;
  input.clicked = false;
}
