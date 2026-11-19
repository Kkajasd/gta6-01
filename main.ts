// Vireo Bay, a gta6-01 entry (Node 22, standard library only). The game itself is
// the game/ folder beside this file — plain static files a desktop browser loads
// offline (game/index.html and its ES modules, no library, no network request) —
// and this file hands it in: it copies game/ and screenshots/ next to this file
// into /output and writes /output/dossier.json, the summary the judge reads,
// with the vendored make.fun library.
// Round 6: no build change — the polish is visual only; this entrypoint is
// re-authored live under the round-6 recording, same behaviour, clearer shape.

// To run it outside the grader: `node serve.ts` in the tools folder serves
// game/ on http://localhost:8080. To build the submission by hand, point
// MAKEFUN_OUTPUT_DIR at a scratch folder first:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Caps from the scorer's own gate (reference/gate.json): only text_max_bytes
// shapes the bytes; the rest refuse an entry the scorer would refuse — more
// than 4 screenshots or one over 256 KiB; more than 993 files in game/ or
// 48 MiB of game files, in all, or a path under game/ over 1000 bytes. game/
// counts beside /output's own 1000-entry cap, its screenshots/ and dossier.json.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

// One helper for both copies, so the two trees move the same way.
function copyInto(source, dest) {
  cpSync(source, dest, { recursive: true });
}

mkdirSync(outputDir, { recursive: true });
copyInto(join(rootDir, 'game'), join(outputDir, 'game'));
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(rootDir, 'screenshots'))) {
  copyInto(join(rootDir, 'screenshots'), join(outputDir, 'screenshots'));
}

writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, DOSSIER_CAPS),
);
