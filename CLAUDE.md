# Game Trial: notes for any AI (or developer) working on the game

You may have been given only one link. Any of these leads here, and they are all the same project:

| Link | What it is |
|---|---|
| https://aycooper1-png.github.io/Game-Trial/ | The live game (what the owner plays). Built from the repo below. |
| https://github.com/aycooper1-png/Game-Trial | The source code repository. **All code changes are made here**, on branch `main`. |
| https://aycooper1-png.github.io/Game-Trial/CLAUDE.md | This file, served by the live site. |
| https://github.com/aycooper1-png/Game-Trial/blob/main/CLAUDE.md | This file, in the repo. |

The live site is published automatically from `main` by GitHub Pages: pushing to `main` updates the game in a minute
or two. There is no other server, build step or database.

**Read this whole file before you change anything.** It is the handoff from earlier work sessions. Sections:

- 0. Start here: what to do with a new request (the procedure, including the clarifying questions)
- 1. The owner and the words they use
- 2. Files
- 3. How `game.js` is organised
- 4. Design decisions the owner has already made (keep them)
- 5. Testing
- 6. Publishing
- 7. Known gaps and open items
- 8. Code style
- 9. Keeping these notes up to date

Last updated: 2026-11-27.

---

## 0. Start here: what to do with a new request

The owner wants every AI to **ask clarifying questions before writing code**, so the result is the game they
actually want, not a guess. Follow these steps in order, **for every new message from the owner** (owner's standing
instruction, 2026-11-26: "each time I give a prompt"). The owner may check that you did, so say plainly in your reply
that you re-read the notes.

**Exception (owner, 2026-11-26):** brief questions that need no change to the game (for example "what is the link to
the game?") need neither the re-read of the notes nor clarifying questions: just answer.

### Step 1: Read and understand (no code yet)
1. **Re-read all the notes, every time, even if you read them earlier in the same session:** this whole file, the
   off-screen `#ai-notes` block at the top of `index.html`, `README.md` (the player-facing description of every
   feature) and `tests/README.md`. (In round 17 an AI read only this file and part of the README, and the owner
   asked whether it had read all of them: it hadn't.)
2. Read the owner's request carefully. Their requests are often long and numbered. Keep their numbering in your reply.
3. For each item, find the code it touches (section 3 tells you where to look) and read it. Check how it works
   **now** before deciding what to change. Things you assume are missing may already exist.
4. Check each item against section 4 (decisions already made). If an item seems to contradict one of them, do not
   silently pick one: point it out and ask.

### Step 2: Ask clarifying questions (still no code)
The owner wants **clarifying questions that focus on quality over quantity** (2026-11-27, replacing "as many as
possible"): ask only what genuinely changes the result and can't be reliably decided from the notes, the code and good
judgement; decide small things yourself and say what you chose. Many questions are fine **only** when there genuinely
are many things that are very unclear and you cannot reliably tell what is better. Keep each question short; avoid
long lists of options. **No code changes until they have answered** (2026-11-26). Even when a request says "fix" or looks obvious, ask. The only
exception is a message that only gives answers or permission (for example "I give you permission to implement the
edits"): then build or publish what was agreed.
Reply with:
1. **A short restatement** of each numbered item in plain words ("Here's what I understand you want: ...").
2. **Numbered questions**, as many as are genuinely useful. The owner likes thorough questions and answers them by
   number. Good questions cover:
   - **Scope:** exactly which units, buildings, vehicles, troop types or screens the change applies to. Does it apply
     to the computer nations too? To other worlds (Moon, Aries...)? To both multiplayer modes and both players?
   - **Numbers:** ask for any number that matters (how fast, how much, how long, how far), or offer a sensible
     default and ask if it's right.
   - **Edge cases:** what should happen when the thing can't happen (no port, no resources, no haulers, at war,
     another world, creative mode on).
   - **Conflicts:** "This would change [earlier decision in section 4]. Do you want to change that, or keep it?"
   - **What they see:** how it should look or be announced (notification, toast, a card, a drawing on the map).
   - **Phone:** whether it must work on the iPhone layout (almost always yes).
   - **Your own ideas:** if you see a gap or a better way, offer it as a question; never add it unasked.
3. For any question that is hard to understand, **explain it with an example** and the options (a), (b), (c).
4. Then **stop and wait** for the answers.

**Follow-up questions are very important to the owner** (2026-11-26): after their answers, ask further questions
whenever an answer is still unclear to you, or when something they said seems illogical or could hurt the game (a
contradiction with another answer or an earlier decision, a rule that could jam or break something, a big balance
change). Say plainly what worries you and offer options. Don't build the affected parts until it's settled.

If the owner says "explain X before acting", explain it and wait; do not build anything for that request until they
answer. If an answer is unclear or seems to have a typo, ask again about that point only (example from the past:
"you cannot get either a refusal, or a counter offer, or an acceptance" really meant "you can get any one of the
three"). If they answer some questions and leave others, ask about the rest before building those parts.

Only skip the questions when the request is completely unambiguous (for example "give me the link", or an obvious
small bug fix). When in doubt, ask.

### Step 3: Build in stages
1. Make a short plan of stages (one stage per item or group of related items).
2. For each stage: change the code, run `node --check game.js`, run the tests that cover it (section 5), and look at
   a screenshot when something visual changed (desktop and phone size).
3. Fix what you broke. Fix real bugs you find on the way (and mention them).
4. If you discover something that changes what the owner will get (a side effect, a limit, a slowdown), tell them.
5. **Update these notes as you go** (section 9), stage by stage, while the details are fresh. Don't leave it all to the
   end, when things are easy to forget or get wrong.

### Step 4: Publish and report
1. Bump the cache tag, update `README.md`, **re-read and finish updating this file (section 9)**, commit once for
   the whole request, push to `main` (section 6).
2. Report to the owner in plain language (they are not a programmer):
   - what changed, item by item, in their numbering;
   - what you tested and what you could **not** test (for example: real iPhone Safari, real two-device multiplayer);
   - side effects and any numbers you chose yourself, so they can adjust them.
   Keep it readable on a phone. No code, no function names.

### If you cannot run code or push
If you are a chat assistant without access to the repo, a terminal or a browser: say so plainly at the start. You can
still do Steps 1 and 2 (read the code at the GitHub link and ask questions), and you can write the exact changes,
but the owner is not a programmer and cannot apply code edits by hand easily. Suggest they use an AI coding tool
that can edit the repo and push (for example Claude Code with this repository), and give it this file.

---

## 1. The owner and the words they use

The owner plays mostly on an **iPhone** (Safari), sometimes on desktop. They care a lot about realism, consistency
and the game being fun. They are not a programmer.

Standing preferences:
1. **Re-read all the notes, then ask clarifying questions (quality over quantity, 2026-11-27), then wait for every answer before
   changing code** (section 0). This applies to every new message (owner, 2026-11-26).
1b. **Ask follow-up questions** when an answer is unclear, illogical, or could hurt the game (section 0, Step 2).
2. **Build in stages and test each stage.**
2b. **Keep these notes exact enough that any other AI could pick up exactly where the last one left off** (owner,
   2026-11-26): update them during the work, as section 9 says.
3. **One commit and push per request** ("round"), unless splitting it genuinely improves quality. A round is one
   message from the owner with one or more numbered items.
4. **Every change must make the game better.** Review the graphics you touch, check the phone layout, fix bugs.
5. **Report honestly**, including what you could not test and side effects.
6. **Plain language** with the owner. No code words.
7. **Multiplayer parity:** the second player must be able to do everything the host can, except creative mode.
8. No security constraints were given.

### The owner's words, and what they mean in the code
These are easy to misread. Read requests with this table in mind, and ask when unsure.

| Owner says | Means | In the code |
|---|---|---|
| "the AI" (in a game request) | Usually the **in-game AI**: the central computer upgraded to C.A.I.S., which runs parts of your territory for you (roads, building, trade, war...). Sometimes the **computer nations**. Rarely you, the assistant. | `aiState`, `AICMD`, `aiDo*` (in-game AI) vs `game.nations`, `aiThink` (computer nations) |
| "computer nations", "NPCs", "nations" | The AI-controlled countries on the map | `game.nations[k]`, `n` |
| "territory", "domain" | One of **your** separate pieces of land, with its own stock and people. Same thing. | `game.countries[i]`, `C` |
| "porters", "transportation units", "haulers", "carts", "trucks" | Road haulers of any level, from porter to self-driving hauler. "Porters" sometimes means all of them, sometimes only the first level: check the context or ask. | `game.cars`, `v`, `CFG.fleet.car.tiers` |
| "boats", "trains", "planes" | Vehicles on sea routes, rail lines, air routes between ports, stations, airports | `game.links[].ships`, `CFG.fleet.boat/rail/plane` |
| "port", "station", "airport" | Hub buildings at the ends of links | `L.a`, `L.b`, building types `port`, `station`, `airport` |
| "upgrade" (vehicles) | Moving a fleet to the next model | `orderUpgrade`, `fleetTarget`, `atHub` |
| "main player", "host" | The player who started the multiplayer game | `MP.role === 'host'` |
| "second player", "guest", "friend" | The one who joined by link | `MP.role === 'guest'` |
| "creative mode", "Do not touch" | Infinite resources and all techs, for testing | `game.debug`, `toggleDebug` |
| "inventory", "master inventory" | The resource numbers in the top bar (all territories added up) | `updateHud`, `C.res` |
| "Rivals", "Co-op" | The two multiplayer modes | `mpRival()`, `MP.style` |

---

## 2. Files

| File | What it is |
|---|---|
| `index.html` | The page: canvas, HUD markup, panels, and an off-screen note for AIs (`#ai-notes`, plus the meta description). Loads `style.css?v=N`, `peerjs.min.js`, `game.js?v=N`. |
| `game.js` | **The whole game**: about 14,800 lines of plain JavaScript in one file (`'use strict'`, no modules, no build step, no frameworks). |
| `style.css` | All styling, including the phone layout. |
| `peerjs.min.js` | Bundled PeerJS library for multiplayer. **Do not edit.** |
| `sounds/` | The game's sounds (mp3, mono, 22 kHz), cut from the owner's own recording (see section 4, Sound). |
| `README.md` | Player-facing feature list. Update it when features change. |
| `tests/` | Playwright test scripts (section 5). Not loaded by the game. |
| `CLAUDE.md` | This file. `AGENTS.md` points here (other AI tools look for that name). |
| `.nojekyll` | Makes GitHub Pages serve files as they are. Keep it. |

**Cache tag:** `index.html` loads `style.css?v=N` and `game.js?v=N`. **Increase N by one on every push**, in both
places, or phones keep running the old code. Look in `index.html` for the current N (it was 30 on 2026-11-27).

---

## 3. How `game.js` is organised

Everything is a global function or `const`/`let` in one script. **Line numbers change all the time: find things by
searching** for the names below or for the section banners (`// ======` blocks and `// ---------- title ----------`
lines). The order of sections in the file:

1. **`CFG`** (top of file): tuning numbers. Keys include `buildings`, `techs`, `techFx`, `units`, `military`
   (including `feed`, the troops' wheat upkeep), `fleet` (all vehicles and their models), `personalities`, `weapons`,
   `drive`, `moon`, `sun`, `vulcan`, `planets`. Some newer systems keep their numbers in a named const beside the
   code instead (`LANE`, `SCHED`, `QUAY_MAX`, `QUAY_WAIT`). Put new tuning numbers in one of those two places.
2. Small helpers; sprites (`SVG`, `RAS`, `SPR`: every building, vehicle and unit is drawn as SVG, then turned into
   images).
3. World state: `const game = { ... }` holds almost everything: `countries` (your territories), `nations` (computer
   nations), `buildings`, `links`, `cars` (haulers), `hubJobs` (goods waiting in yards for a hauler), `shipments`
   (goods and troops travelling outside the link system), `research`, `armies`, `attacks`, `raids`, `dip`,
   `treaties`, `alliances`, `fleetTarget`, `envoys`, and more. Map layers are typed arrays indexed by tile:
   `biome`, `owner` (1 = yours), `countryOf`, `aiOf` (nation id + 1; 0 = none), `building`, `depositOf`, `NET`
   (bit 1 = your road on this tile), `bridgeAt`, `landmass`. Tile index `i = y * W + x`.
4. Then, in order: map generation, territory layers, diplomacy opinions, roads and walls, logistics, research,
   buildings, pushes and expeditions, military, the fleet, the simulation tick, rendering, other worlds and space,
   input, HUD, computing and the in-game AI, inventories, walls part 2, gold and market, diplomacy part 2,
   counter-offers, notifications, and **multiplayer** (at the end).
5. The last lines: `window.__game = { ... }` (exports used only by the tests), then `init()`.

### Code terms
- **Country `C`** = one of your territories (see section 1). Has `res` (stock), `people`, `cap`, power, `alive`.
  `activeCountry()` is the one the top bar shows; `liveCountry(id)`; `countryAt(tile)`.
- **Nation `n`** = a computer nation. Stock `n.stock`, techs `n.R` (a Set), land `n.tiles`, centre `n.lx, n.ly`.
- **Side**: `'P'` is you; nations are numbers (their id). `sideOf(tile)`.
- **Link `L`**: a route between two hubs: `L.a`, `L.b` (tiles), `L.kind` (`'sea'`, `'rail'` or `'air'`), `L.ships`
  (its vehicles), `L.req.a` / `L.req.b` (consignments waiting on each quay), `L.out.a` / `L.out.b` (bulk goods
  waiting), `L.path` (tiles).
- **Car `v`** = one road hauler. `v.job`, `v.act` (what it does on arrival), `v.pts` / `v.spd` / `v.via` (its
  route, speed per stretch, and which road each stretch is on), `v.cargo`, `v.tier` (model), `v.country`.
- **Worlds:** each world (home, Moon, Aries, ...) is a full map; only one is "swapped in" at a time. `WORLD` is the
  current one; `useWorld(w)`, `onWorld(w, fn)`, `forWorlds(fn)`, `worldGenerated(w)`, `genWorld(w)`. `GAME_KEYS`
  lists the fields of `game` that belong to each world; `shipments`, `shipIns` and `troopFlights` are shared by all
  worlds. **Code that touches one world must run while that world is swapped in.**

### Main systems and their key functions
- **Tick:** `tickAll(dt)` runs every world, the envoys and multiplayer, calling `tick(dt)` for each world: economy,
  food (people plus upkeep `C.feedWheat`), power (`P.need + trainMW + carMW`), research, nations, haulers
  (`stepCars`, which starts with `stepTraffic`), links (boats, trains, planes), shipments.
- **Roads:** `roads` (global list of road lines: `pts`, `cum`, `len`, `tiles`, `key`, `side`, `a`, `b`, `lanes`,
  `len0` (length when first laid), `works` (closed for road works until)), `game.connects` (short roads out to
  single buildings), `buildRoads()` (new roads between settlements, laid straight by `makeLine`), `netGraph()` (the
  road network as a graph; `edges` lets haulers join a road mid-way), `markNet()` (refresh after changes).
- **Routing:** `findRoute(ax, ay, bx, by, prof)` → `findRoute0`: shortest time over the road graph, joining a road at
  its nearest point. `prof.avoid` (from the model's `stick`) makes better vehicles keep to roads. `keepOnLand` keeps
  off-road stretches off water. Profiles: `carProf(v)`, `haulProf(C)`.
- **Calling a hauler ("Request porter"):** `askPorter(S)` (the question), `requestPorter(S)` (the order), `porterPick`
  / `porterChoose` (who comes), `porterHop` (which link, weights in `PORTER_WAY`), `porterGo` (it sets off, from
  `carNextJob` once it is free), `porterArrive` (acts `calledIn`, `boardCall`, `liftoff`), `porterLands`. The call is
  `v.call = { to, c, w }` (saved). Across a link it travels as a consignment `{ porter: ... }` on `L.req`; between
  worlds as a `game.troopFlights` entry with `porter`.
- **Taking buildings down (round 18):** `razeOrder(i, abort)` (the order, in `MP_ORDERS`), `askRaze` / `askAbort`
  (the questions), `razeRefund`, `paidFor`, `halfOf`, `razeTime`, `stepRaze` (haul → dust → `razeDone`), `townGone`,
  `razeTroops`, `hubGone`, `stepIdleFleet` / `game.idleFleet` (per world, saved), `scrapPlane`, `RAZE`, `CRASH`.
  `b.raze = { abort, keep, stage, t, T, h }` (saved). Rockets: the landing check at the top of the "down on a world"
  part of `stepShuttlesAir`, `landChance`, `RLAND`, `aiPowerAll`. The C.A.I.S. talk: `aiGuards`, `aiRefuse`, `AI_WARN`,
  `aiVerdict`, `playStyle`, `stepStyle` (`game.style`, saved), `IMPORTANT_TECH`.
- **Roads you tap:** shown in the bottom building card (`cardOf === -3`; bridges `cardOf === -4`, `bridgeSel`,
  `drawBridgeSel`), so the picked road stays visible. `roadNear`, `showRoadCard`, `roadExpand` / `roadExpandAt`, `askRoadDelete`, `roadDelete`,
  `roadRebuild`, `drawRoadSel` (`roadSel`), `ROAD_MAX_LANES`, `aiPruneRoads`, `altRoadLen`; `buildRoads` skips
  `game.noRoad` pairs. Lanes are drawn 1×, 1.75×, 2.45× wide (a highway gets a gold centre line).
- **Bridges:** `BRIDGE`, `bridgeOf` (tile → bridge, cached), `stepBridges` (`br.on`, troop breaks, closing),
  `canCross`, `bridgeGate`, `bridgeNear`, `showBridgeCard`, `bridgeConnect` / `bridgeUpgrade` / `bridgeClose` (by key
  `s:b`, in `MP_ORDERS`), `bridgeGone`, `bridgeRoadPlan`, `roadToBridge` (from `finishSite`). `br.up` is saved.
- **Placement and fields:** `harvestWhy`, `claimedTile`, `COLLECT_KINDS`, `idleCollector`, `drawIdleMarks`,
  `DESERT_WHEAT` (in `stepSowing` and `recomputeHarvest`).
- **Space gear:** `airless()`, `v.space`, sprites `sp_porter`, `sp_handcart`, `sp_horse`, `sp_carriage`, `sp_caravan`,
  `sp_truck`, `sp_etruck`, `sp_autohauler` (made right after the last `Object.assign(SHAPES, ...)`).
- **Market:** `MARKET` (now beside the market code), `priceOf`, `lotGold`, `tradeWhy`, `marketTrade(C, r, side, n)`,
  `showMarket`, `marketDraw`, `MK` (the picked resource and amount), styles `.mk-*` in `style.css`.
- **Importing for a purchase:** `askBuyImport`, `importAndBuy`, `buyImportPlan`, `sendImports` (shared with
  `importAndBuild`), `buyArrived` (called from `impArrive`), `game.pendingBuys` (not saved).
- **Haulers:** `carRefit(v, C)` (the upgrade, whenever an empty hauler stops in a settlement: called from `carArrive`
  and `carNextJob`), `carNextJob(v)` picks the next job (nearest building sites first, then yards, pickups from
  collectors, exports, rockets...), `carGo(v, x, y, act)`, `carArrive(v)` handles each `act` (`loadSite`, `deliver`,
  `loadYard`, `board`, `deliverImp`, `tradeOut`, `toLink`, ...), `dropCarJob`, `atHub` (upgrades happen here),
  `addCar`, `buyVehicle`, `orderUpgrade`, `fleetSummary`, `helpersFor`, `takeUpTo`.
- **Building sites:** `tryBuild(i, type)`. On a site `S`: `need` (still to be paid in), `cost`, `hauled`, `imported`,
  `cars` / `claim` (haulers working it), `pending` (on its way by train). `siteHaul(S)` = what still has to be carried
  out from the settlement. `siteCheck(b)` starts the building crew when everything is there. `dispatchSupplies()`
  fills `need` from stock or asks your linked territories. `rushSite` (pay gold).
- **Goods between your territories:** `importPlan`, `importWay`, `askImport`, `importAndBuild`,
  `sendConsignment(D, q, at)`, `boardLink`, `deliver(q, C, hub)`, `impArrive`, `toYard`, `yardDone`, `routesTo(C)`.
  Quays: `QUAY_MAX`, `quayLoad`. Timetables: `SCHED`, `inboundTo`, `loadAt(..., append)`, `topUp`.
- **Shipments** (things travelling outside links, drawn on the map): `shipGoods(from, to, res, opt)`, `tradePath`,
  `stepShipments`. Each has legs of kind `land`, `sea`, `air`, `quay` (waiting on a quay, drawn as crates) or `amph`
  (troops crossing by themselves). Used for trades with nations and for troops on the march.
- **Troops:** `transferTroops`, `troopLeg`, `troopsAtQuay`, `arriveTroops`, `garrisons()`, armies, attacks, raids.
- **Traffic and speed:** `stepTraffic`, `jam(road)`, `roadCap`, `LANE`, `loadSpeed(f)`.
- **In-game AI (C.A.I.S.):** `aiState(b)`, `aiCompute(C)`, `AICMD` (its commands), `aiDoRoads` (road restructuring:
  `roadServe`, `roadScore`, `aiRoadStretch`, `aiRoadBlds`), `showAIPanel`.
- **Computer nations:** `aiThink`, `aiOffers`, `offerTo` (always shows Accept / Counter… / Decline), `aiConsider`
  (judges trades), `aiTreaty`, `aiPeace` / `aiPeaceScore`, `aiAlly`, `doTrade`, `signTreaty`.
- **Diplomacy screen:** `openDiplomacy(n)`, `renderDiplomacy`, `dipAction(act)` (your proposals go by envoy:
  `game.envoys`, `stepEnvoys`), counter-offers (`withCounter`, `showCounter`), asking every nation (`askAll` →
  `askAllNow`).
- **Messages:** `notify(title, body, buttons, expire, onTap)` (notification with buttons), `toast(msg)` (short
  message), `showModal(html, buttons)` (dialog).
- **Top bar:** `updateHud()` (totals, each territory's own stock line `.terrn`, the people bar with upkeep).
- **Saving:** `saveGame()` / `loadGame(sv)` in the browser's localStorage (key `SAVE_KEY`), automatically every
  10 s. **A new field that must survive a reload has to be added to both.** (Envoys are not saved.)
- **Sound** (just before "notifications and questions"): `SND` (state: `muted`, `ctx`, `buf`, `loops`, `clashes`,
  `crews`, `talking`), `SND_ZOOM` (fade: silent at or below zoom 13, full only at `CFG.zoomMax` 40, curve 1.6;
  builder taps from zoom 25), `SND_KIND` (hauler model → sound; `etruck` is `null` = silent), `SND_LOOPS`,
  `SND_LEVEL`, `SND_NEAREST`, `SND_WORKER1`, `SND_FILES`, `sndZoom(z)`, `sndLoopify` (crossfades a loop's end into
  its start so it repeats without a gap), `sndInit` (makes the Web Audio context on the first unmute and loads
  `sounds/*.mp3`), `toggleMute`, `stepSound` (called every frame from `frame()` after `render`), `sndClash(x, y)`
  (called where nations fight each other), `crewPos(b, k, z)` (where builder k of a site stands; used by `drawCrew`
  and for taps), `sndTapBuilder(x, y)` (called from `clickAt`), `sndBuilderSays`, `sndTalking`. The mute button is
  `#cmdmenu button[data-act="mute"]` in `index.html` (handled in the `#cmdmenu` click handler; its icon is set in
  `updateCmdMenu`).
- **Tutorial** (just before "notifications and questions", after Sound): `TUT` (state: `on`, `part` = `'core'` or
  `'adv'`, `i` = step, `asking` = the skip question is showing), `TUT_STEPS.core` / `TUT_STEPS.adv` (each step:
  `title`, `text`, `pic` (sprite names drawn from `SVG`), and optionally `el` (a CSS selector to ring), `map` (a
  function giving a map spot to ring), `cam` (moves the camera), `first`, `last`), `tutStart(part, i)`, `tutEnd`,
  `tutShow`, `tutAct`, `tutFrame` (every frame from `frame()`: places the ring `#tut-hl` and moves the card `#tut`
  to the half of the screen away from it), `tutLook(p, z)`, `tutHome`, `tutPic`. The pause is one line in `frame()`
  (`if (TUT.on && !MP.role && game.time > 0.5) acc = 0`). Offered from `init()` on a new world (in place of the old
  "Welcome" note) and in `mpOnMsg` on `hello` for a joining player (not when a Rivals guest comes back to their own
  realm). The 📖 button is `#cmdmenu button[data-act="tutorial"]`. **If you change a feature the tutorial
  describes, update its text too.**
- **Multiplayer** (end of file): `MP` (role, style, connection), PeerJS (or `tr=bc`, a test channel inside one
  browser), `MP_ORDERS` (player orders, wrapped by `mpWrap`), `MP_HOST_ONLY`.
  - **Starting and joining:** `mpSetup` (Host a game / Join a game) → `mpHostSetup` → `mpHost`, or `mpJoinSetup` →
    `mpJoin`. Both end by reloading the page with the URL parameters below. **Game codes** (`mpMakeCode`,
    `mpReadCode`, `mpCodeSeed`, alphabet `MP_ABC`): 6 characters; the first five are random and name the room (the
    map seed is a hash of them), the sixth holds the style and the mode (`MP_MODES`). The code **is** the room name
    (`MP.room`), so nothing has to be exchanged before the two connect. Old-style links (`?join=...`) still work, and
    the waiting room still offers one.
  - **The line:** `LINK` (state) and `MP_NET` (timings, in seconds). `mpPeer` signs in to the matchmaking service,
    `mpDial` (guest) calls the host's room, `mpWire` hooks a connection up, `mpOnData` receives, `mpDrop` lets go of
    a dead one, `mpLost` / `mpUp` / `mpBanner` tell the player. **`mpWatch` runs once a second and drives every
    retry**: heartbeat (`ping` every 2 s), a line is dead after 12 s of silence (5 s after the page wakes up) or when
    ICE says failed, the guest redials by itself, either side signs in again if the matchmaking service drops it.
    The host accepts the newest connection from the same friend (`MP.cid`, kept in localStorage `gt-mp-cid`) and
    answers `full` only to a stranger while the friend's line is alive. Messages: `join` (first time, or after the
    guest reloaded) → `hello`; `rejoin` (the line dropped, pages still open) → `back` (co-op: with a snapshot); a
    `hello` to a guest that is already in (the host reloaded) is taken as a reconnection, never as a fresh start.
    `mpBusy` holds big updates back while the last one is still going out. `mpAwake` asks for a screen wake lock.
    Co-op: the guest's `tickAll` waits while `LINK.up` is false. Rivals: after `MP_NET.grace` (45 s) without the
    friend, the host's computer runs their nation.
  - **Co-op:** the host's browser runs the world; the guest's shows it (`mpSnapshot`, `mpApply`, `toGuestView`) and
    sends its orders to the host.
  - **Rivals:** the `RIV` module. Each browser runs its own full realm. Each side sees the other human as a nation
    in slot `MP.nid`. Every 2 s the host sends `rivWorldMsg` (the world, the computer nations, what the guest lost)
    and the guest sends `rivRealmMsg` (its land, buildings, stats, damage dealt). `rivApplyWorld`,
    `rivApplyRealm`, `mirrorBuildings`, `rivSyncWars`, `rivOffer` / `rivOnOffer` (trades and peace between the two
    humans, with counters), `rivStart` (the guest's first join). The guest's save key is `game-trial-mp-<room>`.
  - **When you add a player action, add it to `MP_ORDERS`** (unless it is host-only), and check it works for the
    guest in both modes.

### URL parameters
`?seed=N` (map seed) · `?mode=peaceful|easy|normal|hard|murder` · host: `?mp=host&style=rivals|coop&room=X` ·
guest: `?join=X&style=...` (X is the game code when the game was started from the Host screen) · `&tr=bc` (tests:
connect two tabs of one browser instead of over the internet) · `&ps=host:port` (tests: use a PeerJS matchmaking
server of your own, see `tests/r17mp.mjs`).

---

## 4. Design decisions the owner has already made (keep them)

These came from the owner's own answers. **Do not change them without asking.** Where a number was **chosen by an
AI** (the owner gave only the rule), it is marked *(AI's number)*: you may suggest a different value, but ask first.

### Hauling and logistics
- **Haulers never change shape.** A porter never turns into a boat. Goods between your territories go: the sending
  territory's hauler carries them to its port (station, airport) → they wait on the quay → boat (train, plane) →
  far quay → a hauler of the receiving territory takes them to where they're needed. Overland if the two share a
  landmass. Across water with no link between them: no import; the game tells the player what to build. Automatic
  supplies between linked territories use the same chain.
- **Riders:** if the receiving territory has no haulers at all, one hauler boards with the goods and stays there. Never
  a territory's last hauler, and only one on its way at a time. The owner said **no** other automatic transfer of
  haulers between territories.
- **Haulers ride boats and trains only when they absolutely must.** Inside one territory, a hauler rides a train only
  if it is needed very far away with no road there, and a rail stop is much closer (*AI's numbers*: 60+ tiles away,
  40+ tiles off-road, rail option at most half the off-road distance). Goods may still go by train without a hauler
  riding: the hauler sets them down at the station.
- **How much each model keeps to roads** (`stick` in `CFG.fleet.car.tiers`): porters cut across country freely (the
  owner wants the porters' old behaviour kept); each better model sticks to roads more; self-driving haulers follow
  roads to the point nearest their goal and only leave the road there. *(AI's numbers: porter 1, handcart 1.3, horse
  1.6, carriage 2.2, caravan 3, truck 5, electric truck 9, self-driving 30.)* Getting to a port uses the same logic,
  and any port works (it doesn't need a road to it).
- **A hauler bought at a settlement appears at that settlement**, is paid for by that territory, and first serves the
  building sites around it (*AI's number*: for 60 s), then goes wherever it's needed.
- **Vehicle upgrades go one model at a time**, never skipping (creative mode may skip). After paying for one, the
  player can order the next at once. Each vehicle pays for every model it climbs, when it next calls at a settlement
  or hub.
- **A road running over or beside a resource building counts as connecting it**; haulers stop on the road there to
  load or unload, then drive on.
- **New roads between settlements are laid straight.** The owner said: don't swing new roads past buildings; leave
  that to the in-game AI (below).
- **No vehicle ever carries more than its capacity.** Big loads take several trips. A few haulers help on one job but
  not close to all (*AI's number*: up to 2, or 40% of the territory's haulers if that's more).
- **Capacities** (current values) are proportional to real life, within ranges the owner set. The owner set the
  ranges; the values inside were fitted by an AI to real-world cargo ratios:

  | Road | Cargo | Allowed | | Sea / air / rail | Cargo | Allowed |
  |---|---|---|---|---|---|---|
  | Porter | 10 | 10–15 | | Sailboat | 30 | 30–60 |
  | Handcart | 16 | 16–28 | | Galleon | 60 | 60–140 |
  | Pack horse | 22 | 22–45 | | Steamship | 185 | 90–320 |
  | Carriage | 60 | 36–80 | | Diesel freighter | 650 | 140–650 |
  | Caravan | 140 | 50–140 | | Container ship | 1,500 | 220–1,500 |
  | Truck | 250 | 60–250 | | Propeller plane | 40 | 40–90 |
  | Electric truck | 400 | 75–400 | | Jet | 220 | 70–220 |
  | Self-driving hauler | 800 | 95–800 | | Wide-body freighter | 550 | 120–550 |
  | | | | | Steam train | 220 | 220–600 |
  | | | | | Diesel train | 1,100 | 320–1,200 |
  | | | | | Electric train | 1,750 | 460–2,500 |

  Do not go outside the "Allowed" range without asking.
- **Load and speed:** a vehicle goes faster the less it carries and slower the more, and a full load must always move
  the most goods per trip. *(AI's numbers: empty 125% speed, full 65%, in `loadSpeed`; for haulers and for boats,
  trains and planes.)*
- **Traffic:** busy roads slow haulers down, and a road that stays jammed gets a **second lane** (owner's choice: a
  second lane, not a parallel road), built automatically and paid in stone by its territory. *(AI's numbers: about
  one hauler per 3 tiles per lane at full speed, slowing to 40% at worst; 0.5 stone per tile.)*
- **Quays** have a storage limit that should almost never be reached (owner: "very very high"); beyond it, goods wait
  at home. *(AI's number: 20,000.)*
- **Timetables:** boats, trains and planes keep a schedule, but wait a little if they're not full and goods are
  actively on their way to them; they never wait past a limit, and leave on schedule if full or nothing is coming.
  *(AI's numbers: 3 s stop, up to 15 s more.)*
- **Upkeep:** porters, horses and drivers eat wheat; trucks use oil; electric vehicles use power; **troops eat wheat**
  too. *(AI's numbers: `feed` and `mw` per model in `CFG.fleet.car.tiers`; troops 0.004 wheat per unit per second in
  `CFG.military.feed`.)*
- **Planes fly straight lines at any angle**, not a tile-by-tile zig-zag.
- **Top bar:** with more than one territory, each resource shows the selected territory's own stock in small type
  under the total (when zoomed in: the territory under the middle of the screen).

- **Request porter** (owner's rule, 2026-11-26): a settlement's card has "Request porter"; after Confirm, one of the
  player's haulers journeys to that settlement from the **nearest area with an abundance** of haulers; if there is no
  abundance, from the area where haulers are **least needed**. If necessary it takes a boat, train, plane or rocket,
  preferring the cheaper one (owner: boats over planes, trains over roads). This is the player's own order, so it does
  not break "no other automatic transfer of haulers". *(AI's choices: "abundance" = a hauler standing idle with nothing
  on its back; "least needed" = the territory with the least goods waiting per hauler (`carNeed`), and that hauler
  sets down its load first; never a territory's last hauler; a hauler already based at that settlement doesn't count;
  link weights rail 1, sea 1.2, air 3; the button is named after the current model, "Request handcart" etc.)*
  **Exception to "haulers ride trains only when they must"**: a called hauler takes the train inside a territory
  whenever it is at least 20% quicker than the road (AI's reading of "trains > long roads, trains > short roads";
  *AI's number*: 20%). The owner was told about this exception and approved publishing it (2026-11-26) without
  answering the question directly: confirm with them if it ever comes up.
- **Upgrades happen whenever an empty hauler stops in a settlement** (owner's rule, 2026-11-26): "if their inventory
  is empty and they go into a settlement, they stop for a few seconds and get upgraded before moving on", also in the
  middle of carrying things back and forth. *(AI's number: 2 s per model, as before.)*
- **Hiring troops and buying haulers can be imported for** (owner, 2026-11-26), like buildings: asked first; the
  purchase happens when the goods arrive. *(AI's choices: the troops' price is the one shown when the player asked;
  the goods are kept aside for the purchase, so a full store can't swallow them.)*
- **Messages must fit the situation** (owner, 2026-11-26): with one territory, nothing may say goods "will be shipped
  in". Check new messages against: one territory or several, a way across or none, another world or not.
- **"Connect to road" must be offered on mining rigs** (and every other building off the road). *(AI's choices: it
  looks 30 tiles for a road or settlement, then up to 90 (`CFG.roads.connectFar`); when no road can be laid the button
  is shown greyed with the reason. The owner's report could not be reproduced on a rig near a road, where the button
  did appear; the far-away case is the one that was fixed.)*

### Troops
- Moving troops between your territories (from a fort or base card): Transfer → how many → choose a territory (listed
  by planet and moon) → confirm. Other worlds go by rocket.
- **Across water, troops march to their port and board a real boat** on the sea route, then march on from the far
  port. **Mechanized infantry and later troops** (needs Electronics) may cross without a boat, but only when no boat
  is free: they stop at the port for a few seconds to convert, are **drawn green**, and are **slow**. Earlier troops
  wait on the quay for a boat.

### Trade and diplomacy
- Trades with computer nations go through ports: goods wait on a quay between the porter and the boat. With your own
  port, your haulers carry outgoing goods to it, and incoming goods land there for your haulers to bring in.
- **Proposals go by envoy**: the player sees "envoy sent", and the answer arrives later as a notification. The wait
  grows with distance. A war between you and them in between does not block an envoy (owner said no). *(AI's numbers:
  2 to 25 s.)*
- **Every answer is one of three: acceptance, refusal, or counter-offer.** A counter-offer can be accepted, rejected
  or countered back. This is for everyone: the player, computer nations (their offers to you always have a Counter…
  button; for a demand, you offer to pay less) and both humans in Rivals. (Computer nations trading with each other
  happens out of sight, so there's no counter step there.)

### The in-game AI (C.A.I.S.) and roads
- **Road restructuring** (an in-game AI command): it weighs each of your roads as a whole against every building that
  needs hauling, and relays a road only when the new shape serves them clearly better overall: swinging past
  buildings where that costs little, staying straight where it wouldn't. Bends must look realistic (*AI's number*:
  at most 50° per swing). How much longer it may make a road grows with its compute: from **20% longer than the road
  as first laid, up to 50%** with enough data centers and power (owner's numbers; `aiRoadStretch`). It checks again
  whenever buildings are added or removed.
- **Spur roads** (short roads out to buildings that no road can be bent to reach): only if the player switches on the
  setting under that command. **Off by default**, and paid in stone.

### Sound
- The sounds are the owner's own recording, cut into `sounds/` (files: `porter`, `handcart`, `horse`, `wagon`,
  `truck`, `autohauler`, `fight`, `worker1-1` … `worker1-6`, `worker2`, `worker3`, `worker4`). The owner approved the
  cuts. `handcart` is the second half of the wagon sound (owner's choice).
- **Which sound where** (owner's choices): porter → porter; handcart → second half of the wagon sound; pack horse →
  horse; carriage and caravan → wagon; truck → truck; **electric truck → silent**; self-driving hauler ("highest
  level truck") → autohauler. Boats, trains and planes: silent for now.
- **Only moving vehicles** make sound (not parked, loading or riding a train).
- **Fighting:** only land battles fought by troops, and only when you're zoomed in on them: your attacks, raids on
  you, and computer nations fighting each other. **No sound in space; missiles make none.** One fighting sound for
  every troop type, for now.
- **Zoom:** full volume only when fully zoomed in; fades more and more as you zoom out; inaudible before buildings turn
  into map icons (owner's rule). *(AI's numbers: silent at or below zoom 13 (icons begin below 10), full at 40, curve
  1.6.)*
- **Clutter** (owner: "great idea, feel free to add other ideas"): one voice per kind of sound; the 3 nearest the
  middle of the screen set its loudness and left-right position; a compressor keeps several kinds at once from
  getting harsh; loops start at a random point with a tiny random speed change. *(AI's numbers: 3 nearest; middle of
  screen loudest, edges 35%.)*
- **Builders** (the little animated workers at a construction site): they talk **only while building** (not while
  waiting for materials) and **only when tapped** while you're **mostly or fully zoomed in** *(AI's number: zoom 25
  or more)*. Each builder keeps his own count: each tap plays one of the six short replies at random until all six
  are used, then `worker2`, then `worker3`, then `worker4`; after that he is silent. The count never resets for that
  builder; another builder starts from the beginning; when the building is finished the builders are gone. A tap
  while he's still talking is ignored. A 💬 shows over a builder while he talks.
- **Mute:** a small speaker icon next to "Do not touch" in the Command panel. **The game starts muted every time it
  is opened** (the setting isn't saved). No volume slider (owner: the phone's volume is enough).
- Gaps between loop repeats are minimised (owner's request) by crossfading each loop's end into its start.
- Multiplayer: each player hears only their own screen and has their own mute.

### Tutorial
- **Offered on every new world** (including someone's very first visit) and to the **second player when they join**.
  No "don't ask again" option: the owner wants it simply very easy to skip. The first card offers **Start the tour**
  or **No thanks** (No thanks closes at once; *AI's choice*: declining the offer isn't treated as skipping mid-way).
- **Style** (owner's choice): guided steps that ring the real button or map spot, on cards with pictures (the game's
  own sprites). **Next** and **Back** on every step.
- **Skip tutorial** is on every step and **asks first** ("Skip the tutorial?" Keep going / Yes, skip).
- **Pausing:** single player pauses while the tutorial is open; **multiplayer keeps running**.
- **Content:** a **core** tour of the early game (17 steps since round 19), then an optional **Advanced** part (10 steps) offered at
  the end of the core. Written **simply and humorously** (owner). **Creative mode and sound/mute are not in it**
  (owner excluded them).
- **The 📖 book button** sits next to the speaker and "Do not touch" in the Command panel and always **starts again
  from step 1** (owner's choice).

### Multiplayer
- **Rivals:** the second player has a full realm of their own, with everything the host has except creative mode.
- **Co-op:** both players command one shared empire.
- **Host a game / Join a game** (owner, 2026-11-26): after Multiplayer, two options. Host: choose all the settings,
  press Start game, a code is generated, and the game does not start until the other player joins. Join: type the
  code and you are taken into that game. The owner asked for **most of the effort to go into making multiplayer
  stable** (it "often would not connect or work properly"). *(AI's choices: 6-character codes; the link is still
  offered as a second way in; all the timings in `MP_NET`.)*

### Round 18 (2026-11-27): taking things down, roads, bridges, placement, market, space gear
The owner answered every question ("push through"; numbers marked *AI's* were left to the AI).
- **Deconstruct** any finished building (owner): "Are you sure?" listing what comes back. Refund: **half of everything
  paid for all its upgrade steps** (`paidFor`); the building is removed completely. The refund waits at the site as a
  yard job for a hauler to carry to the nearest settlement; then a dust cloud for **3 to 5 s** by how advanced it is
  (*AI's split*: by the tech's place in the tree, under 30% → 3 s, under 60% → 4 s, else 5 s; `razeTime`). While it
  comes down it no longer works (`underway` is true for `b.raze`). Allowed in war and in creative mode. Computer
  nations and the in-game AI never deconstruct buildings.
- **Settlement:** its goods (its `b.inv` share) are carried to the other settlements first; its people move to your
  other settlements with room (this territory first, then others on the world; the rest leave: owner answers 4a, 5a);
  its roads stay. The **last** settlement of a territory may go: the land stays yours, empty.
- **Fortress/base:** its troops march to the nearest fortress or base of the territory; with none, to the settlement
  nearest an enemy (at peace: the nearest nation), where they stay as its garrison: settlements with troops count in
  `garrisons()` (they defend, and offer Transfer troops), cap 3× a base's (*AI's number*).
- **Port/station/airport/launch pad:** its vehicles move to your other routes of that kind; with none they wait unused
  (`game.idleFleet`, drawn where they stopped). A plane in the air when your **last airport** goes: **13% survive**
  (owner's number), sit on the ground, can be tapped and scrapped for half a new plane's cost, and are towed at a
  porter's pace to the next airport built. Rockets docked on a deconstructed pad wait for another pad.
- **Rockets whose landing pad is gone** (any cause): another landing pad on that world; else fly back to the world
  they came from (once); else land on open ground with **2% (Mk I) to 10% (Mk IV)** survival (owner), plus a C.A.I.S.
  bonus by the **power it draws** (owner: quantity, not share), **up to 30%** in all (*AI's numbers*: Mk II 5%, Mk III
  7%, +0.1% per MW, all worlds' C.A.I.S. together; `RLAND`, `landChance`). Crashing loses cargo and passengers.
- **Abort** a site (owner): "Are you sure?" **without** listing resources. Delivered materials come back at **half**
  (`razeRefund`); paid-but-not-yet-carried goods go straight back to stock (*AI's reading*: they never left the
  settlement); loads on haulers are set down at the nearest settlement (stored on arrival); rush gold is lost.
  Aborting an upgrade keeps the old building (`b.raze.keep`).
- **The C.A.I.S. guards itself** (owner): while it is a C.A.I.S. with 100% of the energy share (`aiGuards`), Deconstruct
  makes it speak instead: 11 escalating warnings (`AI_WARN`, written by the AI at the owner's request), then a verdict
  on the player's game (`playStyle` / `aiVerdict`): an insult about running out of a resource, a neglected important
  tech, land lost in war, or famine; or, for a good player, grudging respect and "I will be good. Please don't kill
  me." After an insult every further try gets "There is nothing you can do to me." After respect the button works:
  each click shows the plea with **Spare it** / **Flip the kill switch** (= deconstruct). *(AI's choices: 5 verdicts
  in all, 4 insults + respect, owner asked for "five"; thresholds: a resource missing 4+ minutes, an important tech
  skipped while 4+ later ones are done, 60+ tiles lost, 2+ minutes of famine; stats in `game.style`, saved; the talk
  state is in `b.ai.talk`, saved; in co-op each player's dialogue counts on its own screen.)*
- **Roads** (owner): tap a road (zoom 3+): it turns **bright green**, with **Expand** (one more lane, **3 lanes max** =
  highway; same price as the automatic second lane, `LANE.stone` per tile per lane) and **Delete**. Deleting a road
  between settlements warns that it **won't come back** until rebuilt (button "Rebuild the deleted road" on either
  settlement's card; `game.noRoad`, saved); it was free, so nothing comes back. A road out to a building gives back
  half its stone (owner liked the idea). The automatic widening stays as it was (two lanes).
- **The in-game AI may delete roads** (owner): only with Road restructuring on and an energy share of **75%+**.
  *(AI's rule: a little-used settlement road (busy < 0.08, one lane) with another way round at most 25% longer; at
  most one a minute; `aiPruneRoads`.)*
- **Placement of collectors** (owner): cabin, camp, refinery, derrick, farms are blocked where nothing of their kind
  is in reach inside your border, **and** where everything in reach is already claimed by another collector of
  yours, including one under construction (`harvestWhy`, called from `canBuild`; *AI's choice*: "claimed" = within
  that collector's reach; upgrades such as the mining rig aren't checked). Farms need green land or desert in reach
  (home only for desert). Same red ghost and greyed Confirm as before. Collectors left with nothing get a red "!" and
  a card line (`idleCollector`, `drawIdleMarks`). The in-game AI's building goes through `canBuild`, so it obeys.
- **Desert wheat** (owner): sown **3× slower** (*AI's number*, approved) and harvested at **half** (`DESERT_WHEAT`).
  Terraforming turns desert green, which ends both.
- **Bridges** (owner): a basic bridge carries **one kind of traffic at a time**, road haulers or trains, each both
  ways; both give way to **troops**. *(AI's rules, `BRIDGE`: a kind that has waited 20 s goes next, so neither is
  locked out; troops crossing for 20 s pause 6 s to let the others through; checks at the moment of stepping onto
  the bridge, in `moveAlong` (haulers, armies), `stepShipments` (marching troops, trade porters) and the train loop.)*
  Tapping a bridge: **Upgrade** (no tech; its stone again + 2 iron a tile: *AI's prices*, owner liked them) = all
  traffic at once; **Connect to road** (paid in stone, `bridgeRoadPlan`); **Deconstruct** (half the stone back;
  nothing new routes over it; it comes down once the traffic on it has crossed; roads and rail lines over it are cut).
  A **new** settlement whose nearest neighbour is a bridge gets one road over it, free (`roadToBridge`); existing
  settlements are connected by hand. Upgraded bridges are drawn with a second deck.
- **Automatic models cost a little gold** (owner: "a small amount of gold"; *AI's numbers*): electric truck 10,
  self-driving hauler 25, diesel freighter 15, container ship 30, wide-body freighter 30. No gold: the old model stays.
- **Airless worlds** (owner): people and animals hauling wear glass helmets, carts get metal wheels ("the works"),
  trucks become **space buggies** (electric and self-driving versions too), same stats, on any world with no
  breathable air until it is fully terraformed. The look changes when a hauler stops in a settlement, like an
  upgrade (`v.space`, set in `atHub` / `addCar`; sprites `sp_*` in `SHAPES`). Art drawn by the AI.
- **Market** (owner: "not intuitive at all", "hyper-simplify", design left to the AI, cross-checked by a second
  agent): a grid of the resources you know (one always picked, last choice remembered), one line "Wood · you have
  120", amount chips 10 · 50 · 100, two big buttons "Buy 50 for 10 🪙" / "Sell 50 for 6 🪙" with a short reason under a
  greyed one, a fading confirmation, Close. Same prices as before (`MARKET`, `priceOf`, `tradeWhy`, `marketDraw`).

### Round 19 (2026-11-27): a friend's playtest
The owner relayed a friend's four points plus a "frozen" screenshot, and asked for fixes without questions.
- **"Pressed Do not touch and couldn't unclick it":** could not be reproduced (switching off works on a phone-sized
  screen: tap it again → "Switch creative mode off?"). As a safeguard, while creative mode is on the bottom bar shows
  a red **"Creative mode ON · tap to switch off"** button (`.dbg-off` in `#people-rate`) that opens the same question.
- **"Getting porters from the settlement isn't clear":** a tutorial step **"More porters"** (core step 12, the core
  tour is now **17 steps**) rings the settlement and names Buy porter, Upgrade, Market and Request porter.
- **"Don't know how to win, I conquered the whole world":** when no rival nation is left on the home world, once
  (`game.style.won`, saved), a **"🏆 Congratulations!"** box says you have eliminated every rival on the planet, then
  one of **four lines** from inspirational to ominous by aggression (*AI's metrics and weights*, `aggression()`: wars
  you declared ×1, betrayals (alliance or non-aggression treaty broken) ×3, missiles ×0.5, nukes ×3; bands <3, <8,
  <20, more; `WIN_LINES`), with a pointer to the technologies still to discover (`winProgress`). The ominous ones hint
  at rivals from beyond the planet (owner: "hint, hint, wink, wink from outer space"). In Rivals the other player
  counts as a rival. `checkVictory` runs from the home world's tick.
- **"I zoomed out and lost my world"** (owner's rule): when the world you're on has been **off screen, or on screen
  but tiny (under 60 px across, AI's number), for 30 s**, a small **"⟲ Return to map"** button appears at the top right
  under the top bar (`#lost-view`); it takes you back to where you last were on that map (`LV.last`; zoom at least 3).
  Following a planet or moon in the sky counts as away. (`viewingWorld`, `stepLostView` from `frame()`,
  `returnToMap`.)
- **The "frozen" screenshot** (stars only, after a reload): very likely **not a freeze**: the camera had been panned
  into empty space, and the saved camera put it back there on every reload. The game now checks the saved camera on
  load (`saneCamera`): broken values are reset, and a view of empty space is moved back over your land. Not proven:
  the friend's save wasn't available.

### Earlier rounds (done; listed so you know they exist)
Tech tree edits; gun ranges; Casimir drive and Alcubierre drive; megaprojects; all the art redrawn (round 9); walls
(picking ends, straight walls); the transport progression; imports (from your nearest territory on the same planet
first, other worlds only if none); troop transfers; an iPhone freeze fix (the command panel closes when you pick
Expedition, Attack or Fire); diplomacy by envoy; counter-offers; round 18 (2026-11-27, above); round 17 (2026-11-26): multiplayer Host/Join with a 6-character code and
self-healing connections, Request porter, upgrades of empty haulers at any settlement stop, importing to hire troops
and buy haulers, Connect to road reaching 90 tiles, messages that fit one or several territories.

---

## 5. Testing

There is no build. Serve the repository folder and drive the game with Playwright and Chrome.

```bash
cd <repo folder> && python3 -m http.server 8765      # restart it if tests suddenly fail with "connection refused"
cd <repo folder>/tests && node r13.mjs                # run any test
```

- **Paths to change for your machine:** the scripts import Playwright from
  `/opt/npm-tools/node_modules/playwright/index.mjs` and start Chrome at `/usr/bin/google-chrome` with
  `--no-sandbox --use-gl=swiftshader`. On another machine use `import { chromium } from 'playwright'` (after
  `npm i playwright`) and your own Chrome path.
- **Not tested so far:** real iPhone Safari (WebKit could not be installed; phone layouts were tested at phone screen
  sizes in Chrome) and real two-device multiplayer over the internet (only two tabs of one browser).
- **How a test works:** open `http://localhost:8765/?seed=42`, wait until the `#loading` element is gone, clear
  `localStorage`, reload, then in `page.evaluate`: `const G = window.__game; G.stopSaving();`, set things up, and run
  the game with `G.tick(0.05)` in a loop (each call is 0.05 s of game time). `window.__game` exports most functions;
  reach anything else with `(0, eval)('someGlobal(...)')`. Always listen for `pageerror` and print "no errors" when
  there were none.
- **Which test covers what** (all in `tests/`):
  - Regression: `long` (a long game), `ui`, `hud` (top bar at 1300, 1500, 1920 px; a slight overflow at 1500 px is
    old and known), `mob5` and `mobexp` (phone), `flow4`, `stress7`, `artgame`, `wet`.
  - Logistics: `r5rail` (a far site supplied by train), `r9` and `r9ship` (other worlds, colonies, rockets), `r10` and
    `r10b` (troop transfers), `r11` (imports), `r13` (imports across water via ports, riders, troops by boat and
    converting, trades with nations through ports), `r13b` (upgrades, where bought haulers appear, road keeping,
    roadside buildings, in-game AI road restructuring, second lanes, straight planes), `r13c` (no hauler over
    capacity), `r14` (counter-offers, envoy timing, upkeep, load and speed).
  - Diplomacy, war, walls: `r5dip`, `r5wall`, `r5a`, `r6a`.
  - In-game AI and computers: `r6b`, `r6c` (r6c builds 27 buildings with 3 porters: slow on purpose since real loads).
  - Space: `r5pad`, `shut4`, `late4`, `ipbm4`.
  - Multiplayer over a real connection: `r17mp` (`node r17mp.mjs coop` and `rivals`): Host a game → the code → Join a
    game on a phone-sized screen with the code typed in small letters with a space → both in; then the line is cut,
    goes silent, the host reloads, the guest reloads: each time both come back by themselves. It needs a matchmaking
    server on this machine: `npm i peer`, then `node tests/peerserver.cjs` (the test passes `?ps=127.0.0.1:9000`).
  - Round 18: `r18raze` (deconstruct a fort for half, its troops march; abort a site; the C.A.I.S. warnings, verdict,
    plea and kill switch; the last-settlement warning; rocket landing chances; also `node r18raze.mjs phone`),
    `r18map` (the placement rule and greyed Confirm, a road tapped, expanded to three lanes, deleted, kept deleted,
    rebuilt; a bridge's turn-taking, troops first, upgrade, card, deconstruction; automatic-model gold prices),
    `r18market` (the market on phone and desktop sizes).
  - Round 19: `r19` (creative mode off from the bottom bar, the tutorial's porter step, the four congratulations
    wordings and only-once, Return to map after 30 s away and when the world is a dot, a saved camera in empty space
    put back on reload; phone size).
  - Round 17 fixes: `r17fix` (one territory: no "shipped in" wording; upgrades of parked haulers and of one walking in
    empty to load; Connect to road far away and greyed; Request porter across a sea route; importing to buy a hauler
    and to hire troops). It runs about 5 minutes: the imports are carried by a few slow haulers.
  - Multiplayer: `r7mp` (run as `node r7mp.mjs coop`), `r12riv` (Rivals: the second player's farms, research,
    expansion, wars, losing land, trades, reload). `r7mp2` needs a real internet connection and fails offline.
  - Sound: `r15snd` (starts muted, the mute button, the zoom fade, a moving porter's loop, a nations' battle on and off
    screen, a builder's tap sequence, taps ignored when zoomed out), `phone_mute` (the speaker button on a phone
    screen). Chrome is started with `--autoplay-policy=no-user-gesture-required` for these. Nobody has listened to
    the result: tests check volumes and which clip plays, not how it sounds.
  - Tutorial: `r16tut` (offered on a fresh visit, pauses single player, every core step and its ring, Back, the
    Advanced part, skip asks and can be cancelled, the game runs again after skipping, the 📖 button restarts from
    step 1, "No thanks" closes at once). Run `node r16tut.mjs` and `node r16tut.mjs phone`. It must start with a fresh
    browser (no saved game), because a saved game skips the offer.
  - Saving: `r5save`. Other files are older one-off checks.
- **Timing:** tests give the game a fixed amount of time. Since real loads, building takes longer, and some loops were
  lengthened. An error like "Cannot read properties of undefined" right after a build loop usually means the building
  wasn't finished in time. Check that before assuming a bug.

## 6. Publishing

```bash
# 1. In index.html, increase N in both style.css?v=N and game.js?v=N by one.
# 2. Update README.md (what players see) and CLAUDE.md (these notes) if behaviour changed.
git add -A
git commit -m "Short summary of the request"
git push origin main            # the live game updates in a minute or two
```
End commit messages with whatever attribution lines your own environment requires (don't copy another session's).

---

## 7. Known gaps and open items

- **Early building is slow** now that porters carry only 10 and nothing carries more than it holds. The owner chose
  this; upgrading haulers pays off a lot. Watch for complaints and offer options, don't change it unasked.
- **Multiplayer over the real internet is still untested by an AI**: the new connection code was tested between two
  separate browser windows over real WebRTC with a matchmaking server on the same machine (`r17mp`), not between two
  phones through the public PeerJS service. Two devices that both sit behind strict networks can only connect through
  PeerJS's free relay (TURN) servers; if those are down, such a pair cannot connect at all, and only a relay server of
  the owner's own would fix that.
- A phone that is locked or switched to another app freezes the page: the game cannot run or answer until the player
  comes back (then it reconnects by itself). The screen wake lock (`mpAwake`) only prevents the screen sleeping.
- Request porter: a hauler waiting on a quay for a boat that never comes (no boat on the route) waits for ever, like
  goods do. Imports ordered for a purchase (`game.pendingBuys`) are not saved: after a reload the goods still arrive,
  but go into stock and the player buys by hand. Calling a hauler from another world was not tested in a browser.
- Round 18, not tested in a browser: a plane actually crashing when the last airport goes, a towed plane reaching a
  new airport, a rocket turning back or landing on open ground (only the chances were checked), troops crossing a
  basic bridge while a train waits (the rules were checked directly), a new settlement's road over a bridge, the
  space buggies on the Moon (the sprites were checked side by side), and the in-game AI deleting a road.
- Bridges between two **different** territories: roads stay inside one territory (each road belongs to one), so
  "Connect to road" stops at the bridge's end when the far shore is another territory.
- When a deconstructed hub's vessels move to another route they start at its first end, wherever that is.
- In co-op, the C.A.I.S. dialogue count is kept on each player's own screen (the host's game decides only the kill
  switch). Not saved: imports for purchases (as before), a bridge that was coming down (it is saved as gone).
- Round 19: the friend's freeze could not be reproduced without their save; the fix assumes it was the camera in empty
  space (see section 4, Round 19). Nations living only on other worlds don't stop the congratulations (it is about the
  home planet).
- **Rivals:** computer nations raid only the host; their offers go only to the host; fights between computer nations
  and the second player are worked out on the host's side using a copy of the second player's troops.
- Troops sent to another world by rocket: if their launch pad is across water, the march to it may still show a boat
  on the way (old path).
- A side that can fly sends traded goods by plane directly, not via airports.
- Envoys are not saved: reloading the game drops proposals still on the way.
- Computer nations trading with each other have no counter-offers (out of sight).
- Top bar: at about 1500 px width a few items overflow slightly (old, minor).
- Sound was never heard by an AI (they can't listen): it was checked by volumes, timings and which clip plays. Sound
  on a real iPhone was not tested (Safari needs the first tap, which the mute button provides).
- Boats, trains, planes, the electric truck, buildings and missiles have no sound yet (owner's choice for now).
- The tutorial was checked on desktop and phone sizes in Chrome, not on a real iPhone. It explains things in words
  and rings buttons; it doesn't wait for the player to actually do each thing.

## 8. Code style

- Plain functions. A short plain-English comment above each one saying what it does in game terms.
- Two-space indentation; keep the existing comment voice.
- Tuning numbers in `CFG` or in a named const beside the system.
- After every edit, run `node --check game.js` before the tests.
- Don't reformat or reorganise code you aren't changing (the file is large and other notes refer to names in it).

## 9. Keeping these notes up to date

These notes are how the next AI knows what you know. A wrong note is worse than no note: the next AI will trust it
and build on it. So update them **carefully and accurately, as you go**, not only at the end.

### When
- **During the work:** after each stage, add what changed while you still remember exactly how it works.
- **When the owner answers questions:** record each decision right away in section 4, in their meaning, not yours.
- **Before you commit:** re-read every part of this file you touched, and the parts about the systems you changed,
  and check them against the code as it is now.

### What to update
- **Section 4 (decisions):** every new decision the owner makes. Record what they actually decided, close to their
  own words. Mark every number **you** chose as *(AI's number)*, and say which numbers **they** gave. If they change
  an earlier decision, replace the old line (don't leave both), and note what it replaced if that helps.
- **Section 3 (code map):** new or renamed functions, fields and consts that matter; anything you moved or removed.
  Use the exact names as they are in `game.js`, and search the file to confirm each name exists before writing it.
- **Section 5 (tests):** new tests and what they cover; tests whose timing or meaning changed.
- **Section 7 (gaps):** remove gaps you fixed; add new ones, including anything you couldn't test, couldn't finish, or
  noticed but left alone.
- **Section 1 (owner's words):** any new word or phrase of theirs that could be misread, and what it turned out to mean.
- **Top of file:** the date. **Section 2:** the current cache tag.
- **`index.html`:** if what an AI must know first changes, update the off-screen `#ai-notes` block at the top of
  `<body>` too. Keep it off-screen with CSS, **not** with the `hidden` attribute: AI page-readers skip hidden
  elements and HTML comments.
- **`README.md`:** the player-facing description, in the same commit.

### How (accuracy rules)
- **Write only what you have checked** in the code or seen in a test. If you are unsure, check; if you still can't
  tell, write that it's unverified rather than guessing.
- **Be specific:** exact names, numbers and conditions ("only when no boat is free", "off by default"), not vague
  summaries.
- **Keep the owner's decisions separate from your own choices**, always.
- **Don't delete information you don't understand.** If something looks outdated, check the code first; if it really
  is outdated, fix it and say so in your report.
- **Keep it readable:** plain English, the existing structure and headings, short entries. Put new things in the
  section where the next AI will look for them.
- **Mention in your report to the owner** that you updated the notes, and anything important you changed in them.
