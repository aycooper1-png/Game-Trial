# Notes for any AI (or developer) working on Game Trial

**Read this whole file before you change anything.** It is the handoff from earlier work sessions: how the code is
laid out, how to test and publish, what the owner likes, and the design decisions they have already made (do not undo
them without asking). `AGENTS.md` points here too.

- Live game: https://aycooper1-png.github.io/Game-Trial/ (GitHub Pages, from `main`)
- Repo: https://github.com/aycooper1-png/Game-Trial
- What it is: a remake and large expansion of yclen's Map Factory prototype
  (https://yclen.github.io/map-factory/prototype). A territory, economy, logistics and war game on a seeded disk
  world, with AI nations, research up to the Dyson swarm, other worlds (Moon, Aries, Vulcan, gas giants and moons),
  space flight, and two-player multiplayer.
- The player-facing description of every feature is in `README.md`. This file is about building it.

Last updated: 2026-11-26 (after the "transport and logistics" rounds; cache tag `?v=22`).

---

## 1. Working with the owner

The owner plays mostly on an **iPhone** (Safari) and also on desktop. They write long, numbered requests and care a
great deal about realism, consistency and the game being fun.

Standing preferences (follow these every time):

1. **Build in stages and test each stage.** Don't write everything and hope. Run the relevant tests after each stage.
2. **Push once per round** (one commit per request), unless splitting genuinely improves quality.
3. **Every change must make the game better.** Review graphics, fix bugs you find on the way, check phone layout.
4. **Ask before guessing on design.** When a request is ambiguous, explain the options plainly and let them choose.
   When they say "explain this before acting", stop and explain; do not build anything until they answer.
5. **Report honestly:** what was done, what was tested, what is still untested (for example real online
   multiplayer), and side effects (for example "early building is slower now").
6. Write in plain language for the owner. They are not a programmer; avoid code words in replies.
7. Multiplayer: the second player must be able to do **everything** the host can (except creative mode).
8. No security constraints were given; the game is a static page with no server of its own.

---

## 2. Files

| File | What it is |
|---|---|
| `index.html` | The page: canvas, HUD markup, panels. Loads `style.css?v=N`, `peerjs.min.js`, `game.js?v=N`. |
| `game.js` | **The whole game** (~14,800 lines, plain JS, `'use strict'`, no build step, no modules). |
| `style.css` | All styling, including the phone layout. |
| `peerjs.min.js` | Bundled PeerJS (multiplayer matchmaking). Do not edit. |
| `README.md` | Player-facing feature list. Update it when features change. |
| `tests/` | Playwright scripts used to test every round (see section 5). |
| `CLAUDE.md` / `AGENTS.md` | These notes. |

**Cache tag:** `index.html` loads `style.css?v=N` and `game.js?v=N`. **Bump N on every push** (it is 22 now) or
phones keep the old code.

---

## 3. How `game.js` is organised

There is no module system: everything is a global function or `const`/`let` in one script. Find things by searching
for the section banners (`// ======` blocks and `// ---------- title ----------` lines). The order of sections:

1. **`CFG`** (top of file): every tuning number. Keys include `buildings`, `techs`, `techFx`, `units`, `military`
   (incl. `feed` = troop wheat upkeep), `fleet` (all vehicles), `personalities`, `weapons`, `drive`, `moon`, `sun`,
   `vulcan`, `planets`. **Put new tuning numbers in CFG or in a clearly named const near the system.**
2. Small helpers, sprites (`SVG`, `RAS`, `SPR`: buildings, vehicles, units drawn as SVG then rasterised).
3. World state: `const game = {...}` (around line 1640) holds almost everything: `countries` (your domains /
   territories), `nations` (AI), `buildings`, `links` (sea/rail/air routes), `cars` (haulers), `hubJobs` (goods
   waiting in yards), `shipments` (goods/troops visibly travelling outside the link system), `research`, `armies`,
   `attacks`, `raids`, `dip`, `treaties`, `alliances`, `fleetTarget`, `envoys`, etc.
   Tile layers are typed arrays: `biome`, `owner`, `countryOf`, `aiOf` (nation id + 1), `building`, `depositOf`,
   `NET` (bit 1 = player road on tile), `bridgeAt`, `landmass`.
4. Map generation, territory layers, diplomacy opinions, roads and walls, logistics, research, buildings, pushes and
   expeditions, military, the fleet, the simulation tick, rendering, other worlds, input, HUD, computing/AI,
   inventories, walls part 2, gold/market, diplomacy part 2, counter-offers, notifications, **multiplayer** (end).
5. Last lines: `window.__game = {...}` exports for tests, then `init()`.

### Terms used in the code
- **Country / domain / territory** = one of the player's separate pieces of land (`game.countries[i]`, `C`). Each has
  its own `res` (stock), `people`, power, etc. `activeCountry()` is the one the HUD shows.
- **Nation** = AI player (`game.nations[k]`, `n`). Its stock is `n.stock`; its techs `n.R` (a Set).
- **Side**: `'P'` is the player, nation ids are numbers. `sideOf(tile)`.
- **Link** `L`: a route between two hubs (`L.a`, `L.b` tiles), `L.kind` = `'sea'|'rail'|'air'`, `L.ships` = its
  vehicles, `L.req.a/b` = consignments waiting on each quay, `L.out.a/b` = bulk goods waiting, `L.path` tiles.
- **Car** `v` = a road hauler (porter … self-driving hauler). `v.job`, `v.act`, `v.pts/spd/via` (route),
  `v.cargo`, `v.tier`, `v.country`.
- **Worlds:** each world is a full map; the one on screen is swapped in. `WORLD` = current index, `useWorld(w)`,
  `onWorld(w, fn)`, `forWorlds`, `worldGenerated(w)`, `genWorld`. `GAME_KEYS` lists per-world fields of `game`;
  `shipments`, `shipIns`, `troopFlights` are global. **Any per-world code must run with the right world swapped in.**

### Main systems and their key functions
- **Tick:** `tickAll(dt)` (all worlds, envoys, multiplayer) → `tick(dt)` per world. Economy, food (`eat` includes
  `C.feedWheat` upkeep), power (`P.need + trainMW + carMW`), research, AI, cars (`stepCars`), links, shipments.
- **Roads:** `roads` (global array of road lines `{pts, cum, len, tiles, key, side, a, b, lanes, len0, works}`),
  `game.connects` (spur roads to buildings), `buildRoads()` (new roads between settlements, laid straight by
  `makeLine`), `netGraph()` (graph of road junctions with `edges` for mid-road joining), `markNet()`.
- **Routing:** `findRoute(ax, ay, bx, by, prof)` → `findRoute0`: Dijkstra over the road graph, **joining a road at its
  nearest point, not only at its ends**. `prof.avoid` (tier `stick`) makes better vehicles keep to roads.
  `keepOnLand` keeps off-road legs off water. `carProf(v)`, `haulProf(C)`.
- **Haulers:** `carNextJob(v)` (priority: building sites nearest first, then yards, pickups, exports, rockets …),
  `carGo(v, x, y, act)`, `carArrive(v)` handles `act` (`loadSite`, `deliver`, `loadYard`, `board`, `deliverImp`,
  `tradeOut`, `toLink`, …), `dropCarJob`, `atHub` (upgrades happen here), `addCar`, `buyVehicle`, `orderUpgrade`,
  `fleetSummary`.
- **Building sites:** `tryBuild(i, type)`, `site.need` (still to be paid into the site), `site.cost`,
  `siteHaul(S)` (what still has to be carried out from the settlement), `site.hauled`, `site.imported`,
  `site.cars`/`site.claim` (haulers working it), `site.pending` (on its way by train), `siteCheck(b)` starts the crew.
  `dispatchSupplies()` fills `need` from stock or asks linked territories. `rushSite`.
- **Goods between your territories:** `importPlan` / `importWay` / `askImport` / `importAndBuild`,
  `sendConsignment(D, q, at)`, `boardLink`, `deliver(q, C, hub)`, `impArrive`, `toYard`, `yardDone`, `routesTo(C)`.
  Quays: `QUAY_MAX`, `quayLoad`. Timetables: `SCHED`, `inboundTo`, `loadAt(..., append)`, `topUp`.
- **Shipments (visible travellers outside links):** `shipGoods(from, to, res, opt)`, `tradePath`, legs of kind
  `land|sea|air|quay|amph`, `stepShipments`. Used for trades with nations and troop marches.
- **Troops:** `transferTroops`, `troopLeg`, `troopsAtQuay`, `arriveTroops`, `garrisons()`, armies, attacks, raids.
- **Traffic & speed:** `stepTraffic`, `jam(road)`, `roadCap`, `LANE`, `loadSpeed(f)`.
- **AI computer (C.A.I.S.):** `aiState(b)`, `aiCompute(C)`, `AICMD` (commands), `aiDoRoads` (road restructuring,
  uses `roadServe`, `roadScore`, `aiRoadStretch`, `aiRoadBlds`), `showAIPanel`.
- **Nations:** `aiThink`, `aiOffers`, `offerTo` (always has Accept / Counter… / Decline), `aiConsider` (trades),
  `aiTreaty`, `aiPeace`/`aiPeaceScore`, `aiAlly`, `doTrade`, `signTreaty`.
- **Diplomacy UI:** `openDiplomacy(n)`, `renderDiplomacy`, `dipAction(act)` (proposals go by **envoy**:
  `game.envoys`, `stepEnvoys`), counter-offers `withCounter`, `showCounter`, ask-all `askAll` → `askAllNow`.
- **Notifications:** `notify(title, body, buttons, expire, onTap)`, `toast(msg)`, `showModal(html, buttons)`.
- **HUD:** `updateHud()` (top bar, per-territory `.terrn` line, people bar with upkeep).
- **Saving:** `saveGame()` / `loadGame(sv)` (localStorage key `SAVE_KEY`; autosave every 10 s). Add new persistent
  fields to both. Envoys are not saved (closures).
- **Multiplayer (end of file):** `MP` state, PeerJS wire (or `tr=bc` BroadcastChannel for tests), `MP_ORDERS`
  wrapped by `mpWrap` (co-op guest orders are forwarded to the host as `{t:'cmd'}`), `MP_HOST_ONLY`.
  **Co-op:** host runs the world, guest shows snapshots (`mpSnapshot`, `mpApply`, `toGuestView`).
  **Rivals:** the `RIV` module: each browser runs its own full realm; the other human appears as nation slot
  `MP.nid` on both sides. Host sends `rivWorldMsg` (world, other nations, losses), guest sends `rivRealmMsg`
  (its tiles, buildings, stats, damage). `rivApplyWorld`/`rivApplyRealm`, `mirrorBuildings`, `rivSyncWars`,
  `rivOffer`/`rivOnOffer` (trades/peace between humans, with counters), `rivStart` (guest's first join: sows farm
  fields, adds farms and 2 porters). Guest save key: `game-trial-mp-<room>`.

### URL parameters
`?seed=N` map seed · `?mode=peaceful|easy|normal|hard|murder` · `?mp=host&style=rivals|coop&room=X` host ·
`?join=X&style=...` guest · `&tr=bc` use BroadcastChannel instead of PeerJS (tests, same browser).

---

## 4. Design decisions already made by the owner (keep them)

### Hauling and logistics
- **Haulers never change shape.** A porter never "becomes a boat". Goods between territories go: sending
  territory's hauler → its port/station/airport quay → boat/train/plane → far quay/yard → receiving territory's
  hauler → destination. Overland if the two share a landmass. Across water with no link: no import; the game says
  what to build. Automatic supplies between linked territories use the same chain.
- **Riders:** if the receiving territory has no haulers at all, one hauler boards with the goods and stays there
  (never a territory's last hauler; only one on the way at a time). No other automatic hauler transfers.
- **Haulers ride boats/trains only when absolutely necessary.** Inside one territory a hauler rides a train only
  if it is needed very far away (60+ tiles), there's no road there (40+ tiles off-road) and a rail stop is much
  closer. Goods themselves may still go by train (haulers set them down at the station).
- **Road keeping by tier** (`stick` in `CFG.fleet.car.tiers`): porter 1 (keep the porters' free logic), handcart 1.3,
  horse 1.6, carriage 2.2, caravan 3, truck 5, electric truck 9, self-driving 30 (follows roads to the nearest point
  to its goal and only leaves there). Getting to a port uses the same logic.
- **A hauler bought at a settlement appears at that settlement**, paid by that territory, and serves the building
  sites around it first (60 s), then goes where it's needed.
- **Upgrades one model at a time**, never skipping (creative mode may). After paying for one, the next can be ordered
  at once. Each vehicle pays for every model it climbs when it next calls at a hub.
- **A road touching a resource building counts as connected**; haulers stop on the road beside it (`roadStop`).
- **New roads between settlements are laid straight.** Only the AI (below) reshapes roads.
- **No vehicle ever carries more than its capacity.** Big loads take several trips. Up to `max(2, 40% of a
  territory's haulers)` work one job together (`helpersFor`); the rest carry on.
- **Capacities** are proportional to real life within ranges the owner set (old value → maximum):

  | Vehicle | Cargo | | Vehicle | Cargo |
  |---|---|---|---|---|
  | Porter | 10 | | Sailboat | 30 |
  | Handcart | 16 | | Galleon | 60 |
  | Pack horse | 22 | | Steamship | 185 |
  | Carriage | 60 | | Diesel freighter | 650 |
  | Caravan | 140 | | Container ship | 1,500 |
  | Truck | 250 | | Propeller plane | 40 |
  | Electric truck | 400 | | Jet | 220 |
  | Self-driving hauler | 800 | | Wide-body freighter | 550 |
  | Steam train | 220 | | Diesel train | 1,100 |
  | Electric train | 1,750 | | | |

  Allowed ranges: porter 10–15, handcart 16–28, horse 22–45, carriage 36–80, caravan 50–140, truck 60–250,
  e-truck 75–400, autohauler 95–800; sailboat 30–60, galleon 60–140, steamship 90–320, freighter 140–650,
  container 220–1500; plane 40–90, jet 70–220, cargojet 120–550; steam train 220–600, diesel 320–1200,
  electric 460–2500. Don't go outside these without asking.
- **Load and speed:** empty 125% speed, full 65% (`loadSpeed`), for haulers and link vehicles. A full load must
  always move the most goods per trip.
- **Traffic:** about one hauler per 3 tiles per lane at full speed, slower beyond (down to 40%). A road that stays
  jammed is widened to **two lanes** automatically, paid in stone (0.5/tile) by its territory.
- **Quays** hold 20,000 ("very very high"); beyond that goods wait at home.
- **Timetables:** boats/trains/planes stop 3 s; if they have room and a hauler is actively bringing goods to them,
  they wait up to 15 s more. Full or nothing coming: they leave on schedule.
- **Upkeep:** porters/horses/drivers eat wheat (`feed` per tier), electric trucks and self-driving haulers draw power
  (`mw`), trucks burn oil while moving, every troop eats 0.004 wheat/s (`CFG.military.feed`).
- **Planes fly straight lines at any angle** (no tile zig-zag).
- **HUD:** with more than one territory, each resource shows the selected territory's own stock in small type
  under the total (zoomed in: the territory under the camera).

### Troops
- Troop transfer flow (from a fort/base card): Transfer → how many → territories grouped by planet/moon → confirm.
  Other worlds go by rocket.
- **Across water troops march to their port and board a real boat** on the sea route, then march on.
  With Electronics (mechanized infantry and later) and **no boat free**, they convert their vehicles at the port
  (about 5 s), then cross by themselves, **drawn green and slow**. Earlier troops wait on the quay.

### Trade and diplomacy
- Trades with nations go through ports: goods wait on a quay between porter and boat; with your own port, your
  haulers carry outgoing goods to it and incoming goods land there (yard) for your haulers to bring in.
- **Proposals go by envoy** and the answer comes back as a notification. Envoy delay grows with distance
  (2–25 s); wars in between do not block envoys.
- **Every answer is accept, refuse or counter-offer.** A counter can be accepted, rejected or countered back
  (opens the panel with their terms). Nations' offers to you always have Counter… (demands: offer less). Applies to
  human-vs-human in Rivals too. (NPC-to-NPC trades have no UI, so no counters there.)

### The computer's AI (C.A.I.S.) and roads
- **Road restructuring** weighs each road as a whole against every building needing hauling and relays it only when
  clearly better overall, with gentle bends (≤ 50° per swing). It may stretch a road to **20% beyond its first
  length, rising to 50%** with more compute (data centers and power): `aiRoadStretch`. It re-checks when buildings
  change. **Spur roads** are an optional setting under that command (**off by default**, paid in stone).

### Multiplayer
- Rivals guest = a full realm (everything the host has, except creative mode). Co-op = one shared empire.

### Earlier rounds (already done)
Tech tree edits, gun ranges, Casimir/Alcubierre, megaprojects, art redraw (round 9), wall picking and straight
walls, transport progression, improved imports (nearest own territory on the same planet first, off-planet only
if none), troop transfers, iPhone expedition freeze fix (command panel closes when you pick Expedition/Attack/Fire).

---

## 5. Testing

There is no build. Serve the repo folder and drive it with Playwright + Chrome.

```bash
cd <repo> && python3 -m http.server 8765        # restart it if tests suddenly fail with connection refused
cd <repo>/tests && node r13.mjs                  # any test
```

- The scripts import Playwright from `/opt/npm-tools/node_modules/playwright/index.mjs` and launch
  `/usr/bin/google-chrome` with `--no-sandbox --use-gl=swiftshader`. **Change those two paths for your machine**
  (e.g. `import { chromium } from 'playwright'` after `npm i playwright`). WebKit could not be installed in the
  earlier environment, so iPhone Safari itself was never tested; phone layouts were tested at phone viewport sizes.
- Pattern inside a test: `page.goto('http://localhost:8765/?seed=42')`, wait until `#loading` is gone, clear
  `localStorage`, reload, then `page.evaluate(() => { const G = window.__game; G.stopSaving(); ... G.tick(0.05) ... })`.
  `window.__game` exports most functions; for anything not exported use `(0, eval)('someGlobal(...)')`.
  Always collect `pageerror` events and print "no errors" at the end.
- Rough map of the tests (all in `tests/`):
  - General/regression: `long` (long run), `ui`, `hud` (top-bar overflow at 1300/1500/1920; the 1500 px overflow is
    old and known), `mob5`/`mobexp` (phone), `flow4`, `stress7`, `artgame`, `wet`.
  - Logistics: `r5rail` (far site via train), `r9`/`r9ship` (shipping between worlds, colonies, rockets),
    `r10`/`r10b` (troop transfers), `r11` (imports), `r13` (imports across water via ports, riders, troops by boat and
    amphibious, nation trades through ports), `r13b` (upgrades, spawn, road keeping, roadside buildings, AI road
    restructuring, lanes, planes), `r13c` (no hauler over capacity), `r14` (counter-offers, envoy distance, upkeep,
    load speed).
  - Diplomacy/war/walls: `r5dip`, `r5wall`, `r5a`, `r6a`.
  - AI computer: `r6b`, `r6c` (r6c is a heavy 27-building build with 3 porters: slow by design now).
  - Space: `r5pad`, `shut4`, `late4`, `ipbm4`.
  - Multiplayer: `r7mp` (`node r7mp.mjs coop`), `r7mp2` (needs real network; expected to fail offline),
    `r12riv` (Rivals parity: farms, research, expansion, wars, tile loss, trades, reload).
  - Saving: `r5save`. Others are older one-offs.
- Test loops have fixed time budgets; since real loads were introduced, building takes longer, so some loops were
  lengthened. A failure like "Cannot read properties of undefined" right after a build loop usually means the
  building didn't finish in time; check before assuming a bug.

## 6. Publishing

```bash
# bump ?v=N in index.html (both style.css and game.js), then:
git add -A
git commit -m "Short summary of the round"     # end with the attribution lines your environment requires
git push origin main                            # GitHub Pages updates within a minute or two
```
Update `README.md` (player-facing) and this file (developer-facing) in the same commit when behaviour changes.

---

## 7. Known gaps and open items

- **Early game is slow to build** now that porters carry only 10 and no vehicle exceeds capacity (owner chose this;
  watch for complaints; upgrading haulers pays off).
- **Rivals:** computer nations raid only the host; their offers don't reach the guest; fights between nations and the
  guest are worked out on the host using the guest's mirrored troops; real PeerJS was never tested between two real
  devices (only `tr=bc` in one browser).
- Troops going to another world by rocket: if the launch pad is across water, the march to it still uses the old
  shipment path (could show a boat leg).
- Trades by a side that can fly use planes directly (not via airports).
- Envoys are not saved: a reload drops proposals still on the way.
- NPC-to-NPC trades have no counter-offers (no UI for them).
- HUD: at exactly ~1500 px width a few top-bar items overflow slightly (old, minor).
- `README.md` multiplayer "Limits" line was rewritten in this update; keep it in sync with the RIV module.

## 8. Style of the code

- Plain functions, short comments in plain English above each function saying what it does in game terms.
- Small edits are made with exact string replacements; keep indentation (2 spaces) and the existing comment voice.
- Tuning numbers near the top (`CFG`) or in a named const beside the system (`LANE`, `SCHED`, `QUAY_MAX`).
- Check `node --check game.js` after every edit before running tests.
