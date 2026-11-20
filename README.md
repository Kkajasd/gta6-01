# gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Kkajasd/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Kkajasd/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Vireo Bay** — an open-world crime game in a sun-soaked bay city. Dana Voss
owes the Bay Syndicate $5,000. Four jobs, one fast pink car, five wanted
stars of police who do not give up. Steal cars, lose the cops, run the jobs,
pay the debt.

A golden-hour 2D open world: paneled rooftops with AC units and a helipad,
neon signs (TACOS / MOTEL / DINER / GYM), a beach district with palms and
umbrellas, a marina with boats and a pier, a port full of containers, traffic
and pedestrians that follow the road grid, police chases, punch-and-shoot
combat, synthesized WebAudio sound, a HUD with a minimap, and a story that
ends when the debt is paid.

## Run it

Serve `game/` with any static file server and open `game/index.html` in
desktop Chrome — no build step, no network requests. For example:

```sh
cd game && python3 -m http.server 8080
```

Then open <http://localhost:8080>. WASD to drive and walk, E to enter or
steal a car, Space to punch, F to shoot, P to pause.

The four screenshots in `screenshots/` are taken from the running game with
`?shot=1-chase`, `?shot=2-street`, `?shot=3-mission` and `?shot=4-start`
(see `shots.json`): a police chase, the beach district, the Hideout job,
and the title screen.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and
writes `dossier.json` with the vendored `buildDossier` library.
