// Vireo Bay, a gta6-01 entry (Node 22, standard library only). The game
// itself lives in the game/ folder beside this file — plain static files a
// desktop browser loads offline (game/index.html and its ES modules, no
// library, no network request) — and this file hands it in: it copies game/
// and screenshots/ next to this file into /output and writes
// /output/dossier.json, the summary the judge reads, with the vendored
// make.fun library.
// Round 7: no build change — the polish is visual only; this entrypoint is
// re-authored live under the round-7 recording, same behaviour, clearer shape.
// The two trees are copied with one helper so they can never drift apart.

// To run it outside the grader: `node serve.ts` in the tools folder serves
// game/ on http://localhost:8080. To build the submission by hand, point
// MAKEFUN_OUTPUT_DIR at a scratch folder first:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';
import * as vendor from './vendor/makefun-game.ts';

const here = url.fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Caps from the scorer's own gate (reference/gate.json): only text_max_bytes
// shapes the bytes; the rest refuse an entry the scorer would refuse — more
// than 4 screenshots or one over 256 KiB; more than 993 files in game/ or
// 48 MiB of game files, in all, or a path under game/ over 1000 bytes. game/
// counts beside /output's own 1000-entry cap, its screenshots/ and dossier.json.
const GATE_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

// One helper for both copies, so the two trees move the same way.
function mirror(source, dest) {
  fs.cpSync(source, dest, { recursive: true });
}

fs.mkdirSync(out, { recursive: true });
mirror(path.join(here, 'game'), path.join(out, 'game'));
fs.mkdirSync(path.join(out, 'screenshots'), { recursive: true });
if (fs.existsSync(path.join(here, 'screenshots'))) {
  mirror(path.join(here, 'screenshots'), path.join(out, 'screenshots'));
}

fs.writeFileSync(
  path.join(out, 'dossier.json'),
  vendor.buildDossier(out, GATE_CAPS),
);
