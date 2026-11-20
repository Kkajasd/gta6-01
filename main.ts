// Vireo Bay — the entrypoint. Copies the game and its screenshots into /output
// and writes the dossier the judge reads. Node 22, standard library only.
//
// The grader runs this twice and requires byte-identical output, so the copy
// is a plain recursive copy and the dossier is built from the copied files.
// /output itself is never removed: in the grader it is a bind-mount, and
// removing it fails the run. Only its contents are cleared.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.OUTPUT_DIR || '/output';

function clearContents(dir) {
  for (const entry of readdirSync(dir)) {
    rmSync(join(dir, entry), { recursive: true, force: true });
  }
}

mkdirSync(OUT, { recursive: true });
clearContents(OUT);
if (!existsSync(join(ROOT, 'game', 'index.html'))) {
  throw new Error('Vireo Bay: game/index.html is missing, cannot build a dossier');
}
if (!existsSync(join(ROOT, 'screenshots'))) {
  throw new Error('Vireo Bay: screenshots/ is missing, cannot build a dossier');
}
cpSync(join(ROOT, 'game'), join(OUT, 'game'), { recursive: true });
cpSync(join(ROOT, 'screenshots'), join(OUT, 'screenshots'), { recursive: true });
writeFileSync(join(OUT, 'dossier.json'), buildDossier(OUT, CAPS));
console.log(`Vireo Bay: dossier written to ${join(OUT, 'dossier.json')}`);
