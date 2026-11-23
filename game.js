'use strict';
/*
 * Map Factory — playable prototype of the core loop (design v3).
 *
 *   land you own near a settlement -> people capacity -> people regrow -> spend people to claim land
 *   -> deposits inside your territory produce -> resources build settlements
 *
 * Every separate piece of your territory is a country with its own people,
 * stockpile and power. Expeditions found new countries; links move people and
 * cargo between them. Names grow with each country's size.
 *
 * Everything you might want to tune is in CFG below.
 * Add ?seed=123 to the URL to replay a specific map.
 */

// ======================================================================
// CONFIG — all tuning numbers live here
// ======================================================================
const CFG = {
  // The world is a disk floating in space, ringed by an ice wall.
  mapW: 1000, mapH: 1000,
  continentScale: 115,         // bigger = bigger continents (noise feature size, in tiles)
  climateScale: 150,           // bigger = larger desert regions
  iceWall: { min: 2.5, extra: 4 },  // wall thickness in tiles: min + up to extra (wobbles around the rim)
  waterFraction: 0.5,          // share of the disk (inside the wall) that is ocean
  mountainShare: 0.13,         // top X% of land by height becomes mountains
  desertShare: 0.24,           // driest X% of land becomes desert

  startPeople: 100, startRadius: 8,
  // Land holds the capacity: every owned land tile can support this many people...
  landCap: { grass: 0.5, desert: 0.2, mountain: 0.1 },
  // ...but only if a settlement is within `reach` tiles of it. Each tile counts for its nearest settlement,
  // so settlements packed together share the same land. A settlement's level is read off the capacity it serves.
  // Capacity above `powerAbove` only counts with power (`cityUse` MW per settlement that big).
  // People above a country's capacity die off slowly (`shrink` = share of the excess per second).
  settlement: { reach: 12, powerAbove: 170, cityUse: 2, shrink: 0.01,
                levels: [{ name: 'Hamlet', cap: 0 }, { name: 'Village', cap: 50 }, { name: 'Town', cap: 110 }, { name: 'City', cap: 175 }] },
  startResources: { wood: 60, stone: 60, iron: 0, oil: 0, wheat: 120, uranium: 0 },
  // An expedition takes the same share of its country's stockpile as of its people (the send %),
  // and at least this much if home has it: enough for a station with some track, or a cabin and a camp.
  expeditionKit: { wood: 40, stone: 40, wheat: 40 },
  // what one train / ship carries per trip. Goods and people ride the vehicle, so long routes deliver slower and later.
  vehicles: { rail: { cargo: 30, people: 12 }, sea: { cargo: 40, people: 10 } },
  minShare: 0.25,              // each end of a link gets at least 25% of the other end's output, however few people it has

  // people regrowth:  growth/sec = rate * P * (1 - P/C) + base
  growthRate: 0.06, growthBase: 0.3,

  // people spent per tile claimed, by biome
  tileCost: { grass: 0.5, desert: 1.5, mountain: 2.5 },
  // how fast a push claims land: "work" per second; a tile takes (cost / grass cost) work
  pushWorkPerSec: budget => 4 + 3 * Math.sqrt(budget),

  // Collectors harvest the deposit tiles within `collectorReach` of them (their own country's land only). A tile is
  // worked by its nearest collector, so two side by side share the same tiles: more of them on one deposit gives less each.
  collectorReach: 4,
  // Roads: settlements in the same country join up by themselves, each to its nearest neighbours within `roadMax`
  // tiles, along the grid with one or two right-angle turns, when such a route stays on that country's land.
  // Trucks drive them. For show only.
  roadMax: 34, roadLinks: 2, truckSpeed: 5,
  // Every resource can only be stockpiled so far: a country stores `base` plus `perCap` for each person its settlements
  // can house. Collectors set how fast a store fills; settlements set how much it holds. Wood and stone are generous
  // (enough for a long building spree); iron is tighter, because it is what war runs on.
  storage: { wood: { base: 200, perCap: 5 }, stone: { base: 200, perCap: 5 }, iron: { base: 50, perCap: 1 }, oil: { base: 60, perCap: 1 }, wheat: { base: 150, perCap: 2 }, uranium: { base: 40, perCap: 0.2 } },
  // AI nations keep iron under the same rule: they mine the iron in their land, plus a small trickle so none is ever unarmed.
  iron: { aiStart: 30, aiTrickle: 0.15 },
  prodPerTile: { forest: 0.1, stone: 0.12, iron: 0.1, oil: 0.1, gold: 0.05, wheat: 0.065, uranium: 0.02 },   // stone a bit richer: it's in almost everything   // per owned, connected deposit tile, per second

  // tech = the research that unlocks it (none: known from the start). See CFG.techs.
  buildings: {
    // the one housing building. It has no capacity of its own: it unlocks the capacity of the land around it.
    settlement: { cat: 'Housing', name: 'Settlement', cost: { wood: 40, stone: 40 }, people: 20,
               desc: 'Houses the people the land within 12 tiles can support, and grows from hamlet to city as you own more of it. Costs 20 settlers. Spread them out: land is only counted once.' },
    farm:    { cat: 'Food', name: 'Farm', cost: { wood: 20, stone: 5 }, workers: 4, on: ['wheat'], farm: 1,
               desc: 'Turns the plain land within 3 tiles into wheat fields and works them. Your people eat wheat: no new farms, no new people.' },
    farm2:   { cat: 'Food', name: 'Irrigated farm', tech: 'irrigation', from: 'farm', cost: { wood: 20, stone: 20 }, workers: 4, on: ['wheat'], farm: 1.7,
               desc: 'Tap a farm to upgrade it: canals and crop rotation, 1.7x the wheat from the same fields.' },
    farm3:   { cat: 'Food', name: 'Mechanized farm', tech: 'mechfarm', from: 'farm2', cost: { stone: 20, iron: 20, oil: 10 }, workers: 2, on: ['wheat'], farm: 2.8,
               desc: 'Tap an irrigated farm to upgrade it: tractors and harvesters, 2.8x the wheat and fewer workers.' },
    // collectors: a deposit only produces once something works it. Early on that's people.
    cabin:   { cat: 'Resources', name: "Logger's cabin", cost: { wood: 5, stone: 10 }, workers: 5, on: ['forest'],
               desc: 'Cuts the forest within 4 tiles of it. Employs 5 of the domain\'s people. Two close together share the same trees.' },
    camp:    { cat: 'Resources', name: "Miner's camp", cost: { wood: 15, stone: 5 }, workers: 5, on: ['stone', 'iron', 'gold', 'uranium'],
               desc: 'Mines the stone, iron, gold (and later uranium) within 4 tiles. Carts haul what it digs to the nearest settlement. Gold boosts research and your troops. Employs 5 people.' },
    derrick: { cat: 'Resources', name: 'Oil derrick', tech: 'petroleum', cost: { stone: 15, iron: 20 }, workers: 3, on: ['oil'],
               desc: 'Pumps the oil within 4 tiles of it. Oil is only found once you research Petroleum.' },
    rig:     { cat: 'Resources', name: 'Mining rig', tech: 'electricity', cost: { wood: 20, stone: 10, iron: 10 }, use: 4,
               from: ['cabin', 'camp', 'derrick'],
               desc: 'Tap a cabin, camp or derrick to upgrade it: 3x the output and frees its workers, but runs on 4 MW. No power, no output.' },
    // transport: links between your domains. Goods, people and troops ride them.
    port:    { cat: 'Transport', name: 'Port', tech: 'sailing', cost: { wood: 25, stone: 10 }, link: 'sea',
               desc: 'On the coast. Opens a sea route to your nearest port. Ships carry goods, people and troops.' },
    station: { cat: 'Transport', name: 'Rail station', tech: 'steam', cost: { wood: 15, stone: 10, iron: 10 }, link: 'rail',
               desc: 'Lays rail to your nearest station on the same land. Trains are fast and carry a lot.' },
    airport: { cat: 'Transport', name: 'Airport', tech: 'flight', cost: { stone: 40, iron: 30, oil: 20 }, link: 'air',
               desc: 'Planes fly straight to every other airport you own, over land and sea.' },
    // energy: every domain has its own power budget (supply from plants, demand from machines)
    burner:  { cat: 'Energy', name: 'Steam plant', tech: 'steam', cost: { wood: 10, stone: 20 }, gen: 8,
               desc: 'Burns wood for 8 MW of power, up to 0.25 wood/s. It only burns what your domain needs.' },
    oilplant: { cat: 'Energy', name: 'Oil power plant', tech: 'petroleum', cost: { stone: 30, iron: 20 }, gen: 14,
               desc: 'Burns oil for 14 MW, up to 0.3 oil/s. Only burns what the domain needs. No oil, no power.' },
    reactor: { cat: 'Energy', name: 'Nuclear reactor', tech: 'fission', cost: { stone: 80, iron: 60 }, gen: 45,
               desc: '45 MW from a trickle of uranium (up to 0.03/s). No uranium, no power.' },
    solar:   { cat: 'Energy', name: 'Solar panel', tech: 'electricity', cost: { stone: 10, iron: 5 }, gen: 1.5,
               desc: '1.5 MW, free, forever. Each panel takes a tile you can\'t use for anything else.' },
    // military
    base:    { cat: 'Military', name: 'Military base', tech: 'warrior', cost: { wood: 30, stone: 20 }, base: true,
               desc: 'Trains people into military units. Units wait here until you build a fortress, then march to it. Stops when everything is full.' },
    fort:    { cat: 'Military', name: 'Fortress', tech: 'masonry', cost: { stone: 50, wood: 10 }, fort: true,
               desc: 'Holds military units sent from your bases. Attacks are launched from fortresses first.' },
    mortar:  { cat: 'Military', name: 'Cannon', tech: 'gunpowder', cost: { wood: 20, stone: 20, iron: 5 }, weapon: 'shell',
               desc: 'Fires by itself at the buildings of any nation you are at war with, up to 22 tiles away. Shots cost 5 iron.' },
    turret:  { cat: 'Military', name: 'Machine-gun nest', tech: 'firearms', cost: { stone: 25, iron: 15 }, gun: true,
               desc: 'Cuts down enemy troops pushing into your land within 9 tiles of it, by itself, for a little iron.' },
    airdef:  { cat: 'Military', name: 'Air defense', tech: 'flight', cost: { stone: 30, iron: 30 }, use: 2, defense: true,
               desc: 'Shoots down shells and missiles aimed at anything within 14 tiles of it. Each interception costs 8 iron. Uses 2 MW.' },
    silo:    { cat: 'Military', name: 'Missile silo', tech: 'rocketry', cost: { stone: 30, iron: 20, oil: 20 }, use: 3, weapon: 'missile',
               desc: 'Use Fire in the Command menu, then pick a target up to 110 tiles away. Each missile costs 10 oil and 60 iron. Uses 3 MW.' },
  },
  // ---------- technology ----------
  // Every player researches one tech at a time. Speed = perPerson x population (gold adds goldPts per unit mined).
  // A tech costs base x growth^(techs already known). `uses` are the resources it leans on: the next tech is
  // picked among the earliest ones you can research, preferring the ones that use what you produce most.
  research: { perPerson: 0.006, base: 60, growth: 1.2, goldPts: 4, aiMult: 0.5 },
  techs: [
    { id: 'warrior',     name: 'Warrior Code',      era: 0, uses: ['wood'],          tags: ['mil'],   req: [] },
    { id: 'wheel',       name: 'The Wheel',         era: 0, uses: ['wood'],          tags: ['trans'], req: [] },
    { id: 'masonry',     name: 'Masonry',           era: 0, uses: ['stone'],         tags: ['mil', 'trans'], req: [] },
    { id: 'sailing',     name: 'Sailing',           era: 1, uses: ['wood'],          tags: ['trans'], req: ['wheel'] },
    { id: 'metallurgy',  name: 'Metallurgy',        era: 1, uses: ['iron'],          tags: ['mil'],   req: ['warrior'] },
    { id: 'horses',      name: 'Equestrianism',     era: 1, uses: ['wheat'],         tags: ['mil', 'trans'], req: ['wheel'] },
    { id: 'irrigation',  name: 'Irrigation',        era: 1, uses: ['wheat', 'stone'], tags: ['econ'], req: ['masonry'] },
    { id: 'carriages',   name: 'Carriages',         era: 2, uses: ['wood'],          tags: ['trans'], req: ['horses'] },
    { id: 'shipbuilding',name: 'Shipbuilding',      era: 2, uses: ['wood', 'iron'],  tags: ['trans'], req: ['sailing'] },
    { id: 'gunpowder',   name: 'Gunpowder',         era: 2, uses: ['iron', 'stone'], tags: ['mil'],   req: ['metallurgy'] },
    { id: 'firearms',    name: 'Firearms',          era: 3, uses: ['iron'],          tags: ['mil'],   req: ['gunpowder'] },
    { id: 'steam',       name: 'Steam Power',       era: 3, uses: ['wood', 'iron'],  tags: ['econ', 'trans'], req: ['metallurgy', 'carriages'] },
    { id: 'petroleum',   name: 'Petroleum',         era: 3, uses: ['iron'],          tags: ['econ'],  req: ['steam'] },
    { id: 'electricity', name: 'Electricity',       era: 4, uses: ['iron', 'stone'], tags: ['econ'],  req: ['steam'] },
    { id: 'mechfarm',    name: 'Mechanized Farming',era: 4, uses: ['wheat', 'oil'],  tags: ['econ'],  req: ['irrigation', 'petroleum'] },
    { id: 'automobile',  name: 'Automobiles',       era: 4, uses: ['oil', 'iron'],   tags: ['mil', 'trans'], req: ['petroleum'] },
    { id: 'flight',      name: 'Flight',            era: 5, uses: ['oil', 'iron'],   tags: ['trans', 'mil'], req: ['automobile', 'electricity'] },
    { id: 'armor',       name: 'Armored Warfare',   era: 5, uses: ['oil', 'iron'],   tags: ['mil'],   req: ['automobile', 'firearms'] },
    { id: 'rocketry',    name: 'Rocketry',          era: 5, uses: ['oil', 'iron'],   tags: ['mil'],   req: ['flight'] },
    { id: 'fission',     name: 'Nuclear Fission',   era: 5, uses: ['iron', 'stone'], tags: ['econ'],  req: ['electricity'] },
    { id: 'nukes',       name: 'Nuclear Weapons',   era: 6, uses: ['uranium', 'oil'], tags: ['mil'],  req: ['fission', 'rocketry'] },
  ],
  // what each tech does besides unlocking buildings (multipliers stack). Shown in the unlock notification.
  techFx: {
    wheel:        { road: { cargo: 2, speed: 1.25 }, note: 'Handcarts: your haulers carry twice as much' },
    masonry:      { road: { cargo: 1.5, speed: 1.2 }, capMult: 0.25, note: 'Stone roads: carts are faster and carry more · walls between fortresses' },
    sailing:      { note: 'Ships between your domains' },
    metallurgy:   { unit: { hp: 1.8 }, note: 'Iron armour: units are 80% tougher' },
    horses:       { unit: { speed: 1.6 }, road: { speed: 1.5 }, note: 'Cavalry and horse carts: troops and carts move faster' },
    carriages:    { road: { cargo: 2 }, note: 'Carriages: carts carry twice as much again' },
    shipbuilding: { sea: { cargo: 2 }, note: 'Bigger hulls: ships carry twice as much' },
    gunpowder:    { unit: { atk: 1.5 }, note: 'Muskets: units hit 50% harder' },
    firearms:     { unit: { atk: 1.6 }, note: 'Rifles: units hit 60% harder' },
    steam:        { sea: { speed: 1.7, cargo: 1.5 }, note: 'Steamships: ships are faster and carry more' },
    petroleum:    { note: 'Oil deposits appear on the map' },
    electricity:  { capMult: 0.25, note: 'Bases and fortresses hold more' },
    automobile:   { unit: { speed: 1.8 }, road: { speed: 2, cargo: 1.5 }, fuel: true, note: 'Trucks and motorized infantry: much faster, but they burn oil' },
    flight:       { note: 'Planes fly between any of your domains with an airport' },
    armor:        { unit: { hp: 2, atk: 1.5 }, capMult: 0.25, fuel: true, note: 'Tanks: far tougher and stronger, but they burn oil' },
    rocketry:     {},
    fission:      { note: 'Uranium deposits appear on the map' },
    nukes:        { note: 'Your missile silos can carry a nuclear warhead (Command → Fire)' },
  },
  // military units: the newest kind you know is what your bases train (and your older units are re-equipped).
  units: [
    { tech: null,         name: 'Warband',     people: 3, oil: 0, helm: 'helmLeather' },
    { tech: 'metallurgy', name: 'Swordsmen',   people: 4, oil: 0, helm: 'helmBronze' },
    { tech: 'horses',     name: 'Cavalry',     people: 5, oil: 0, helm: 'helmIron' },
    { tech: 'gunpowder',  name: 'Musketeers',  people: 5, oil: 0, helm: 'helmIron' },
    { tech: 'firearms',   name: 'Riflemen',    people: 6, oil: 0, helm: 'helmSteel' },
    { tech: 'automobile', name: 'Motorized infantry', people: 6, oil: 0.3, helm: 'helmModern' },
    { tech: 'armor',      name: 'Tanks',       people: 8, oil: 0.8, helm: 'helmModern' },
  ],
  military: {
    baseCap: 30, fortCap: 60,          // units a base / fortress holds, x (1 + capMult of your techs + 0.05 per tech known)
    train: 0.25,                       // units a base trains per second (x the same tech factor)
    keep: 0.45,                        // bases only recruit while the domain is above this share of its capacity
    speed: 6,                          // tiles per second on foot over land (x unit speed techs)
    transfer: 3,                       // seconds between a base's shipments to its fortresses
    tileWork: 0.6,                     // units lost per tile taken from a nation with no troops left (x their people density)
    kill: 0.08,                        // units one engaged unit kills per second, at equal strength
  },
  // links: what one vehicle carries per trip and how fast it goes (tiles/s), before tech
  transport: { road: { cargo: 8, people: 6, speed: 5 }, sea: { cargo: 25, people: 10, speed: 6 },
               rail: { cargo: 60, people: 20, speed: 14 }, air: { cargo: 30, people: 15, speed: 30 } },
  // food: every person eats `perPerson` wheat a second. A farm's field tile grows `perTile` a second (x farm level).
  wheat: { perPerson: 0.01, perTile: 0.065, radius: 3, start: 120, starveShrink: 0.01 },
  // gold isn't stored: what you mine each second boosts research, troop training and your troops' strength
  gold: { count: 1 / 3000, train: 0.35, trainMax: 0.8, power: 0.07, powerMax: 0.2 },
  oil: { count: 1 / 2600 },            // oil fields per land tile (deserts, grassland), hidden until Petroleum
  uranium: { count: 1 / 6000 },        // uranium per land tile (mountains, deserts), hidden until Nuclear Fission
  // Roads join the settlements of each domain by themselves, for free. Everything moves faster on them.
  // Other buildings join when you connect them (stone per tile). Walls join two fortresses you pick.
  roads: { max: 40, links: 2, connectPerTile: 0.4, connectMin: 4, connectReach: 30, offRoad: 0.5, troopRoad: 2.2 },
  walls: { range: 36, stonePerTile: 1.5, ironPerTile: 0, speed: 0.8, speedTech: { firearms: 0.9, automobile: 1 },
           defense: 3, near: 2, fortDefense: 1.6, fortReach: 9 },
  // Fuel (oil): trucks, planes, ships, motorized units and oil plants burn it every second they run.
  // Before Petroleum, steamships burn wood. A domain with no oil falls back: carriages, sail, grounded planes.
  fuel: { truck: 0.03, plane: 0.3, ship: 0.1, shipWood: 0.12, motor: 0.004, tank: 0.01, oilplant: 0.3, reactor: 0.03 },
  // how far beyond your own land troops can strike (tiles), by tech
  reach: { base: 14, horses: 14, automobile: 30, flight: 25, armor: 10 },
  // a nuclear warhead on one of your missiles: Command → Fire, switch to Nuclear
  nuke: { radius: 11, damage: 40, cost: { uranium: 25, iron: 60, oil: 10 } },
  // AI personalities: each nation draws one (with a little random variation) so every game plays differently.
  personalities: [
    { id: 'warlord',  name: 'Warlord',      aggression: 0.12, military: 0.35, raidEvery: 16, raidShare: 0.5, expand: 0.04, research: 0.8, defense: 1.0, prefer: 'mil' },
    { id: 'expander', name: 'Expansionist', aggression: 0.03, military: 0.15, raidEvery: 30, raidShare: 0.4, expand: 0.09, research: 0.9, defense: 0.9, prefer: 'trans' },
    { id: 'turtle',   name: 'Fortress-builder', aggression: 0.01, military: 0.3, raidEvery: 45, raidShare: 0.3, expand: 0.03, research: 1.0, defense: 1.8, prefer: 'mil' },
    { id: 'scholar',  name: 'Scholar',      aggression: 0.02, military: 0.12, raidEvery: 30, raidShare: 0.4, expand: 0.05, research: 1.8, defense: 1.1, prefer: 'econ' },
    { id: 'opportunist', name: 'Opportunist', aggression: 0.05, military: 0.22, raidEvery: 22, raidShare: 0.45, expand: 0.05, research: 1.0, defense: 1.0, prefer: 'mil', strikesWeak: true },
    { id: 'raider',   name: 'Raider',       aggression: 0.08, military: 0.28, raidEvery: 9, raidShare: 0.22, expand: 0.03, research: 0.85, defense: 0.8, prefer: 'mil' },
  ],
  power: { burnerWood: 0.25, rigMult: 3 },
  // AI nations (v1: static). Taking a tile of theirs costs extra people: defenseBase + defensePerDensity x (their people per tile)
  ai: { count: 7, minDist: 75, radius: [8, 14], tilesPerSettlement: 300, fill: [0.6, 0.9], growth: 0.5,
        defenseBase: 0.5, defensePerDensity: 2.5, killShare: 0.6,
        // v2: nations play the game. Every `think` seconds each one may build a weapon, found a settlement and claim land.
        think: 2, expandAt: 0.75, expandShare: 0.05, maxTiles: 5000, settleGain: 40,
        tilesPerMortar: 500, maxMortars: 4, tilesPerSilo: 1200, maxSilos: 3, tilesPerAirDef: 900, maxAirDefs: 2, tilesPerTurret: 500, maxTurrets: 3,
        // Their mortars fire at your buildings and expeditions in range; their silos only once they're at war with you.
        reloadMult: { shell: 1, missile: 1 },      // they pay for every shot in iron, as you do, so they reload as fast as you
        // Soldiers: a nation whose border touches yours may turn on you (`aggression` = chance per think). At war it sends
        // waves into your land, openfront-style: `raidShare` of its people every `raidEvery` seconds while it is at least
        // `attackAt` full. A wave advances like one of your own pushes (at `raidSpeed` x the pace); each of your tiles costs it
        // the land price plus more the more crowded your country is. A nation boxed in for `boxedThinks` thinks declares war too.
        attackAt: 0.6, raidShare: 0.25, raidEvery: 20, raidSpeed: 0.5, aggression: 0.04, boxedThinks: 8 },
  // weapons: range in tiles, reload in seconds, blast radius in tiles, flight speed, how high the arc is.
  // A blast damages the buildings in it (`damage` hits each). It doesn't kill people on open land: people die when their settlement goes.
  // hp: hits a building can take. Settlements get tougher with each level, and a damaged one holds fewer people:
  // its capacity falls in step with its hit points, and each hit kills that share of the people living there.
  // Damage repairs itself, one hit every `repairSec`.
  hp: { settlement: [8, 12, 18, 25], other: 2, repairSec: 15 },
  // air defense: shoots down an incoming shell or missile whose target is within `range` of it, if loaded and paid for
  airDefense: { range: 14, reload: 3, cost: { iron: 8 } },
  // gun turret: kills soldiers of a push whose front is within `range`, `kills` a second, paying `iron` per soldier
  turret: { range: 9, kills: 6, iron: 0.15 },
  mortarReserve: 20,           // your mortars fire by themselves, but not below this much iron
  weapons: {
    shell:   { name: 'Mortar shell', range: 22, reload: 2.5, radius: 1.5, damage: 1, speed: 24, arc: 0.75, cost: { iron: 5 } },
    missile: { name: 'Missile', range: 110, reload: 10, radius: 3, damage: 5, speed: 36, arc: 0.3, cost: { oil: 10, iron: 60 } },
  },

  // rail: a new station links itself to the nearest station by the cheapest land route
  trackCostPerTile: { wood: 0.15, stone: 0.15 },
  trackWeight: { grass: 1, desert: 1.5, mountain: 3 },   // track through mountains costs 3x
  railMaxLength: 120,          // max weighted track length for one link
  seaMaxLength: 500,           // max sea route length (tiles)
  trainSpeed: 12, shipSpeed: 9,

  expeditionSpeed: 18,         // tiles per second (autopilot only: the playtest bot's expeditions)
  // Expeditions are vehicles you drive: a truck over land, a boat over water. One physics model for both:
  // thrust along the heading, drag from whatever is underneath. Top speed = accel / drag (tiles per second).
  drive: {
    truck: { accel: 26, turn: 2.8, drag: { grass: 2.4, desert: 3.4, mountain: 6.5 } },   // about 11 / 7.5 / 4 tiles a second
    boat: { accel: 9, turn: 1.6, drag: 0.9 },                                            // about 10, and it drifts
    supplies: 90,              // seconds of supplies on board
    starve: 1,                 // people lost per second once they run out
    landReach: 2,              // a boat can put settlers ashore on free land this close
  },
  outpostRadius: 5,            // land claimed on arrival

  // the moon: a smaller world orbiting the disk (visual only, for now)
  // orbit 30 = half the real Earth–Moon distance (the real Moon is ~60 Earth radii away)
  moon: {
    radius: 130, orbit: 30, period: 240,   // radius in tiles; orbit = x disk radius; period in seconds
    plainsShare: 0.42,                     // share of the moon covered by dark basalt plains (the rest is highlands)
    craters: 340,                          // how many craters to scatter (most land on the highlands)
  },
  // the sun: the disk circles it once a "year". The game stays centred on the disk, so normally
  // the sun appears to circle you; lock onto the sun to see your world going around it instead.
  sun: {
    radius: 12,                            // x disk radius (the real Sun is ~109x Earth; scaled down to fit)
    distance: 24,                          // x the Earth-Moon distance (real: ~390x)
    year: 720,                             // seconds per orbit
  },
  // Vulcan: a lava world orbiting the sun, inside your world's orbit
  vulcan: {
    size: 0.7,                             // x your world's radius
    orbit: 0.45,                           // x your world's distance from the sun
    year: 217,                             // seconds per orbit (closer to the sun = faster)
    spin: 90,                              // seconds per turn on its own axis
    lavaShare: 0.2,                        // share of the surface that is open lava sea
  },
  // the outer planets (size = x your world's radius, orbit = x your world's distance from the sun,
  // spin = seconds per turn). Years follow Kepler's law: farther out = slower.
  planets: {
    aries:    { size: 0.53, orbit: 1.5, spin: 120 },   // the red planet
    zeus:     { size: 5.0,  orbit: 3.2, spin: 40 },    // banded gas giant with 3 moons
    poseidon: { size: 3.8,  orbit: 5.0, spin: 50 },    // blue ringed gas giant with 2 moons
    seedWorld: { orbit: 7.5 },                          // the far planet, generated from the map seed
  },

  tickHz: 20,
  zoomMin: 0.0001, zoomMax: 40, startZoom: 14,
  detailZoom: 10,              // >= this: full sprites
  cityZoom: 5,                 // <  this: map view (city icons + deposit markers)
};

// ======================================================================
// small helpers
// ======================================================================
const $ = id => document.getElementById(id);
// a phone or tablet: fingers and on-screen buttons instead of a mouse and keys
const TOUCH = window.matchMedia('(pointer: coarse)').matches;
const say = (desk, touch) => TOUCH ? touch : desk;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash2(x, y, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, s, oct) {
  let sum = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) { sum += amp * vnoise(x * f, y * f, s + i * 131); norm += amp; amp *= 0.5; f *= 2; }
  return sum / norm;
}
function fmtTime(sec) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
function fmtNum(n) { return n >= 1000 ? Math.floor(n).toLocaleString() : String(Math.floor(n)); }
function addCost(a, b) {
  const o = { ...a };
  if (b) for (const [k, v] of Object.entries(b)) o[k] = (o[k] || 0) + v;
  return o;
}

class MinHeap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(v, key) {
    const a = this.k, b = this.v;
    let i = a.length; a.push(key); b.push(v);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p] <= a[i]) break;
      [a[p], a[i]] = [a[i], a[p]]; [b[p], b[i]] = [b[i], b[p]]; i = p;
    }
  }
  pop() {
    const a = this.k, b = this.v, top = b[0];
    const lk = a.pop(), lv = b.pop();
    if (a.length) {
      a[0] = lk; b[0] = lv;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l] < a[m]) m = l;
        if (r < a.length && a[r] < a[m]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; [b[m], b[i]] = [b[i], b[m]]; i = m;
      }
    }
    return top;
  }
}

// ======================================================================
// sprites (same item models as the concept art)
// ======================================================================
// little front-on buildings, reused to draw settlements at each level
const cot = (x, y, w, roof = '#c9553a', wall = '#e8d3a8') => {
  const h = w * 0.7;
  return `<rect x="${x - w / 2}" y="${y - h}" width="${w}" height="${h}" fill="${wall}" stroke="#6b4a2b" stroke-width="0.9"/>
    <path d="M${x - w / 2 - 1.5} ${y - h} L${x} ${y - h - w * 0.6} L${x + w / 2 + 1.5} ${y - h} Z" fill="${roof}" stroke="#6b2b1b" stroke-width="0.9" stroke-linejoin="round"/>`;
};
const blk = (x, w, h, fill) => {
  let win = '';
  for (let y = 9 - h + 3; y < 8; y += 3.5) win += `M${x - w / 2 + 1.5} ${y} H${x + w / 2 - 1.5} `;
  return `<rect x="${x - w / 2}" y="${10 - h}" width="${w}" height="${h}" fill="${fill}" stroke="#2b323d" stroke-width="0.9"/><path d="${win}" stroke="#f2d98a" stroke-width="1.1"/>`;
};
const SHADOW = '<ellipse cx="0" cy="10" rx="13" ry="3" fill="#000" opacity="0.2"/>';
const SETTLE_ART = [
  SHADOW + cot(0, 9, 13),
  SHADOW + cot(-7, 5, 8) + cot(7, 5, 8) + cot(0, 10, 10),
  SHADOW + cot(-9, 6, 8) + cot(9, 6, 8) + `<rect x="-4" y="-9" width="8" height="19" fill="#d9c7a0" stroke="#6b4a2b" stroke-width="0.9"/>
    <path d="M-5.5 -9 L0 -15 L5.5 -9 Z" fill="#4d6f96" stroke="#2c4260" stroke-width="0.9" stroke-linejoin="round"/>
    <path d="M-1.5 -5 H1.5 M-1.5 -1 H1.5" stroke="#6b4a2b" stroke-width="1.2"/>` + cot(-6, 11, 7) + cot(6, 11, 7),
  SHADOW + blk(-9, 6, 12, '#7c8fa4') + blk(9, 6, 15, '#8fa3b8') + blk(-3, 7, 20, '#5f6b7d') + blk(4, 6, 24, '#6f7d92') + cot(-11, 11, 5) + cot(11, 11, 5),
];
// Trees, boulders and ore, seen from above. Several variants of each, built from a few helpers,
// so a forest or a deposit can be drawn as many different pieces instead of one stamp per tile.
const ring = (n, R, r, fill, ox = 0, oy = 0, rot = 0) => Array.from({ length: n }, (_, k) => {
  const a = rot + k / n * Math.PI * 2;
  return `<circle cx="${(ox + Math.cos(a) * R).toFixed(1)}" cy="${(oy + Math.sin(a) * R).toFixed(1)}" r="${r}" fill="${fill}"/>`;
}).join('');
const star = (n, R, r, fill, rot = 0) => `<polygon fill="${fill}" points="${Array.from({ length: n * 2 }, (_, k) => {
  const a = rot + k / (n * 2) * Math.PI * 2, q = k % 2 ? r : R;
  return (Math.cos(a) * q).toFixed(1) + ',' + (Math.sin(a) * q).toFixed(1);
}).join(' ')}"/>`;
const TSHADOW = '<ellipse cx="2.5" cy="3.5" rx="10" ry="8" fill="#000" opacity="0.22"/>';
// a leafy canopy: a lobed dark base, then smaller, lighter clumps climbing towards the light (top left)
const broadleaf = (dark, mid, light, hi) => TSHADOW + ring(7, 6.2, 4.4, dark) + `<circle r="7" fill="${dark}"/>` +
  ring(6, 3.8, 3.6, mid, -0.8, -0.8, 0.4) + ring(4, 2.2, 2.6, light, -1.8, -1.8, 0.9) + ring(3, 1.2, 1.3, hi, -3, -3, 0.2);
// a faceted lump of rock: a base, a lit top, and three sides in different shades
const chunk = p => `<ellipse cx="1.5" cy="5.5" rx="10" ry="4.5" fill="#000" opacity="0.22"/>
  <path d="M-9 3 L-7 -4 L-2 -8 L5 -7 L9 -1 L8 5 L2 8 L-5 7 Z" fill="${p[0]}"/>
  <path d="M-7 -4 L-2 -8 L5 -7 L3 -2 L-3 -1 Z" fill="${p[1]}"/>
  <path d="M-9 3 L-7 -4 L-3 -1 L-4 4 Z" fill="${p[2]}"/>
  <path d="M3 -2 L5 -7 L9 -1 L8 5 L4 3 Z" fill="${p[3]}"/>
  <path d="M-3 -1 L3 -2 L4 3 L-4 4 Z" fill="${p[4]}"/>`;
const at = (x, y, s, inner) => `<g transform="translate(${x} ${y}) scale(${s})">${inner}</g>`;
const fleck = (x, y, s) => `<path d="M${x} ${y - s} L${x + s * 0.6} ${y} L${x} ${y + s} L${x - s * 0.6} ${y} Z" fill="#e3edf4"/>`;
const GREY = ['#7b8289', '#c2c8cd', '#9aa1a8', '#5f666d', '#878e95'], PALE = ['#8a8f8c', '#d2d5cf', '#a9ada8', '#6b706d', '#969a96'];
const RUST = ['#7a4a38', '#bd7b56', '#96604a', '#4f2f25', '#85523f'], DEEP = ['#6a3d33', '#a8654a', '#84503f', '#43261f', '#74463a'];
const SHAPES = {
  farm: `<rect x="-11" y="-9" width="24" height="22" fill="#000" opacity="0.2"/>
    <rect x="-12" y="-1" width="24" height="12" fill="#d9b24a" stroke="#7a5a1a" stroke-width="0.9"/>
    <path d="M-12 3 H12 M-12 7 H12" stroke="#b8902e" stroke-width="1"/>
    <path d="M-10 -1 V-8 L-4 -12 L2 -8 V-1 Z" fill="#b8432f" stroke="#5a1f14" stroke-width="0.9"/>
    <rect x="-6" y="-6" width="4" height="5" fill="#4e3a33"/><circle cx="8" cy="-6" r="3.2" fill="#c9cfd6" stroke="#59616b" stroke-width="0.8"/>`,
  farm2: `<rect x="-11" y="-9" width="24" height="22" fill="#000" opacity="0.2"/>
    <rect x="-12" y="-1" width="24" height="12" fill="#e0bc4e" stroke="#7a5a1a" stroke-width="0.9"/>
    <path d="M-12 5 H12" stroke="#4f8fcf" stroke-width="2"/><path d="M-12 1.5 H12 M-12 8.5 H12" stroke="#b8902e" stroke-width="1"/>
    <path d="M-10 -1 V-8 L-4 -12 L2 -8 V-1 Z" fill="#b8432f" stroke="#5a1f14" stroke-width="0.9"/>
    <rect x="5" y="-12" width="6" height="11" rx="2" fill="#c9cfd6" stroke="#59616b" stroke-width="0.8"/>`,
  farm3: `<rect x="-11" y="-9" width="24" height="22" fill="#000" opacity="0.2"/>
    <rect x="-12" y="-1" width="24" height="12" fill="#e8c652" stroke="#7a5a1a" stroke-width="0.9"/>
    <path d="M-12 3 H12 M-12 7 H12" stroke="#b8902e" stroke-width="1"/>
    <rect x="-11" y="-11" width="10" height="10" fill="#8fa3b8" stroke="#2b323d" stroke-width="0.9"/>
    <rect x="2" y="-9" width="9" height="6" rx="1" fill="#2f8f3f" stroke="#14361a" stroke-width="0.8"/>
    <circle cx="4" cy="-2" r="2" fill="#2b3038"/><circle cx="10" cy="-2" r="2.6" fill="#2b3038"/>`,
  wheatTile: `<path d="M0 10 V-6" stroke="#b8902e" stroke-width="1.4"/>
    <ellipse cx="-2" cy="-6" rx="1.6" ry="3" fill="#e8c652"/><ellipse cx="2" cy="-3" rx="1.6" ry="3" fill="#e8c652"/>
    <ellipse cx="-2" cy="0" rx="1.6" ry="3" fill="#d9b24a"/><ellipse cx="2" cy="3" rx="1.6" ry="3" fill="#d9b24a"/>
    <path d="M-6 10 V-1 M6 10 V0" stroke="#b8902e" stroke-width="1"/><ellipse cx="-6" cy="-2" rx="1.3" ry="2.6" fill="#e8c652"/><ellipse cx="6" cy="-1" rx="1.3" ry="2.6" fill="#e8c652"/>`,
  wheat: `<path d="M0 12 V-8" stroke="#b8902e" stroke-width="1.8"/>
    <ellipse cx="-3" cy="-8" rx="2.4" ry="4.2" fill="#f2c14e" stroke="#8a6a1a" stroke-width="0.6"/><ellipse cx="3" cy="-4" rx="2.4" ry="4.2" fill="#f2c14e" stroke="#8a6a1a" stroke-width="0.6"/>
    <ellipse cx="-3" cy="0" rx="2.4" ry="4.2" fill="#e0b03e" stroke="#8a6a1a" stroke-width="0.6"/><ellipse cx="3" cy="4" rx="2.4" ry="4.2" fill="#e0b03e" stroke="#8a6a1a" stroke-width="0.6"/>`,
  goldI: `<path d="M-11 6 L-7 -2 H7 L11 6 Z" fill="#f2c14e" stroke="#8a6a1a" stroke-width="1"/>
    <path d="M-6 -2 L-3 -9 H3 L6 -2 Z" fill="#ffd970" stroke="#8a6a1a" stroke-width="1"/><path d="M-5 2 H2" stroke="#fff3b0" stroke-width="1.2"/>`,
  oilI: `<path d="M0 -12 C5 -4 9 1 9 5 A9 9 0 0 1 -9 5 C-9 1 -5 -4 0 -12 Z" fill="#2b2f36" stroke="#0f1114" stroke-width="1"/>
    <path d="M-4 3 A4 4 0 0 0 0 8" stroke="#8d969e" stroke-width="1.4" fill="none"/>`,
  research: `<path d="M-4 -12 H4 M-2.5 -12 V-3 L-9 9 A2 2 0 0 0 -7 12 H7 A2 2 0 0 0 9 9 L2.5 -3 V-12" fill="#cfe8ff" stroke="#3d6f9e" stroke-width="1.3" stroke-linejoin="round"/>
    <path d="M-6.5 5 H6.5 L8 9 A1 1 0 0 1 7 10.5 H-7 A1 1 0 0 1 -8 9 Z" fill="#7bd389"/>`,
  derrick: `<rect x="-9" y="-8" width="22" height="22" fill="#000" opacity="0.2"/>
    <path d="M-8 11 L-2 -12 H2 L8 11" fill="none" stroke="#3d434a" stroke-width="2" stroke-linejoin="round"/>
    <path d="M-6 4 H6 M-4 -3 H4" stroke="#3d434a" stroke-width="1.5"/>
    <rect x="-11" y="9" width="22" height="4" rx="1" fill="#2b2f36"/><path d="M-12 -6 L10 -10" stroke="#b8432f" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="9" cy="6" r="3" fill="#2b2f36"/>`,
  post: `<rect x="-9" y="-6" width="22" height="19" fill="#000" opacity="0.22"/>
    <rect x="-11" y="-3" width="16" height="13" fill="#c9a66b" stroke="#5a4310" stroke-width="1"/>
    <path d="M-13 -3 L-3 -11 L7 -3 Z" fill="#8a5a44" stroke="#4a2a1e" stroke-width="1" stroke-linejoin="round"/>
    <circle cx="9" cy="8" r="3.6" fill="none" stroke="#4a2a1e" stroke-width="1.6"/><path d="M9 4.4 V11.6 M5.4 8 H12.6" stroke="#4a2a1e" stroke-width="1"/>`,
  airport: `<rect x="-11" y="-10" width="26" height="25" fill="#000" opacity="0.2"/>
    <rect x="-13" y="-12" width="26" height="24" rx="2" fill="#59616b" stroke="#2b3038" stroke-width="1"/>
    <path d="M-10 8 L10 -8" stroke="#eef1f3" stroke-width="3"/><path d="M-10 8 L10 -8" stroke="#59616b" stroke-width="0.8" stroke-dasharray="2 2"/>
    <path d="M0 -6 L2 -1 L8 1 L8 3 L2 2 L1 7 L3 9 L3 10 L0 9 L-3 10 L-3 9 L-1 7 L-2 2 L-8 3 L-8 1 L-2 -1 Z" fill="#cfe8ff" stroke="#2b3038" stroke-width="0.7"/>`,
  plane: `<path d="M12 0 L4 -2 L-2 -11 L-5 -11 L-1 -2 L-8 -2 L-11 -6 L-13 -6 L-11 0 L-13 6 L-11 6 L-8 2 L-1 2 L-5 11 L-2 11 L4 2 Z" fill="#eef1f3" stroke="#2b3038" stroke-width="1"/>`,
  base: `<rect x="-11" y="-9" width="25" height="23" fill="#000" opacity="0.22"/>
    <rect x="-12" y="-6" width="24" height="17" fill="#6f7a4a" stroke="#2f3520" stroke-width="1"/>
    <path d="M-12 -6 L0 -12 L12 -6" fill="#4f5a32" stroke="#2f3520" stroke-width="1"/>
    <rect x="-3" y="2" width="6" height="9" fill="#2f3520"/><path d="M8 -12 V2" stroke="#3d434a" stroke-width="1.2"/>
    <path d="M8 -12 L14 -10 L8 -8 Z" fill="#7bd389"/>`,
  fort: `<rect x="-11" y="-9" width="25" height="23" fill="#000" opacity="0.22"/>
    <path d="M-12 11 V-6 H-9 V-10 H-5 V-6 H-2 V-10 H2 V-6 H5 V-10 H9 V-6 H12 V11 Z" fill="#9aa1a8" stroke="#3d434a" stroke-width="1"/>
    <path d="M-12 0 H12 M-6 -6 V11 M6 -6 V11" stroke="#7b8289" stroke-width="0.8"/>
    <path d="M-3 11 V5 A3 3 0 0 1 3 5 V11 Z" fill="#2b3038"/><path d="M0 -10 V-16" stroke="#3d434a" stroke-width="1"/><path d="M0 -16 L6 -14 L0 -12 Z" fill="#7bd389"/>`,
  soldier: `<circle cx="0" cy="-6" r="3.2" fill="#7bd389" stroke="#1d4a26" stroke-width="0.9"/>
    <path d="M-6 -8.5 H6 L4 -10.5 H-4 Z" fill="#2f5a2b"/>
    <path d="M-5 7 V0 C-5 -2 -3 -2.5 0 -2.5 C3 -2.5 5 -2 5 0 V7 Z" fill="#7bd389" stroke="#1d4a26" stroke-width="0.9"/>
    <path d="M7 -9 V8" stroke="#d9dde2" stroke-width="1.4"/>`,
  gear: `<circle r="9" fill="#141a25" opacity="0.85"/>` + Array.from({ length: 8 }, (_, k) => `<rect x="-1.8" y="-9.5" width="3.6" height="4" rx="0.8" fill="#f2c14e" transform="rotate(${k * 45})"/>`).join('') +
    `<circle r="6.2" fill="#f2c14e"/><circle r="2.6" fill="#141a25"/>`,
  treeA: broadleaf('#2f5a2b', '#3f7a35', '#56963f', '#7bb85a'),
  treeB: broadleaf('#264d2f', '#33663a', '#447c44', '#5c9652'),
  treeD: broadleaf('#566f2a', '#718f33', '#90ad43', '#b6cc68'),
  treeC: TSHADOW + star(9, 11, 6, '#1c4030') + star(9, 8.2, 4.4, '#28573c', 0.35) + star(8, 5.4, 2.8, '#35704a', 0.7) + star(6, 2.8, 1.4, '#4d8f5f', 0.2),
  rockA: chunk(GREY),
  rockB: at(-4, 1, 0.62, chunk(PALE)) + at(5, -3, 0.5, chunk(GREY)) + at(4, 6, 0.4, chunk(GREY)),
  rockC: at(-5, -3, 0.36, chunk(GREY)) + at(4, -5, 0.3, chunk(PALE)) + at(0, 3, 0.46, chunk(PALE)) + at(8, 4, 0.28, chunk(GREY)) + at(-8, 5, 0.25, chunk(GREY)),
  oreA: chunk(RUST) + fleck(-2, -4.5, 1.7) + fleck(4.5, -1, 1.3) + fleck(-5.5, 2, 1.1),
  oreB: at(-4, 1, 0.62, chunk(DEEP)) + at(5, -3, 0.5, chunk(RUST)) + at(4, 6, 0.4, chunk(RUST)) + fleck(-5, -1, 1.3) + fleck(5, -4.5, 1.1) + fleck(4, 5.5, 0.9),
  oreC: at(-5, -3, 0.36, chunk(RUST)) + at(4, -5, 0.3, chunk(DEEP)) + at(0, 3, 0.46, chunk(RUST)) + at(8, 4, 0.28, chunk(DEEP)) + at(-8, 5, 0.25, chunk(RUST)) + fleck(0, 1.5, 1.1) + fleck(-5, -4, 0.8),
  settle1: SETTLE_ART[0], settle2: SETTLE_ART[1], settle3: SETTLE_ART[2], settle4: SETTLE_ART[3], settlement: SETTLE_ART[1],
  person: `<circle cx="0" cy="-4.5" r="3" fill="#f2c14e" stroke="#5a4310" stroke-width="0.8"/>
    <path d="M-4.5 5 C-4.5 0 -2.5 -0.8 0 -0.8 C2.5 -0.8 4.5 0 4.5 5 Z" fill="#f2c14e" stroke="#5a4310" stroke-width="0.8"/>`,
  house: `<rect x="-7" y="-6" width="18" height="16" fill="#000" opacity="0.22"/>
    <rect x="-9" y="-8" width="18" height="8" fill="#de6d4c"/><rect x="-9" y="0" width="18" height="8" fill="#b04a31"/>
    <rect x="-9" y="-8" width="18" height="16" fill="none" stroke="#6b2b1b" stroke-width="1"/>
    <line x1="-9" y1="0" x2="9" y2="0" stroke="#7d3220" stroke-width="1.2"/><rect x="3" y="-6.5" width="3.2" height="4" fill="#4e3a33"/>`,
  house2: `<rect x="-9" y="-8" width="24" height="20" fill="#000" opacity="0.22"/>
    <rect x="-12" y="-10" width="24" height="10" fill="#7099c4"/><rect x="-12" y="0" width="24" height="10" fill="#4d6f96"/>
    <rect x="-12" y="-10" width="24" height="20" fill="none" stroke="#2c4260" stroke-width="1"/>
    <line x1="-12" y1="0" x2="12" y2="0" stroke="#2c4260" stroke-width="1.2"/>
    <rect x="-8" y="-8" width="3" height="4" fill="#3a3f4a"/><rect x="5" y="-8" width="3" height="4" fill="#3a3f4a"/>`,
  house3: `<rect x="-10" y="-9" width="26" height="25" fill="#000" opacity="0.25"/>
    <rect x="-13" y="-13" width="26" height="26" rx="1.5" fill="#5f6b7d" stroke="#2b323d" stroke-width="1"/>
    <rect x="-11" y="-11" width="10" height="10" fill="#8fa3b8"/><rect x="1" y="-11" width="10" height="10" fill="#7c8fa4"/>
    <rect x="-11" y="1" width="10" height="10" fill="#7c8fa4"/><rect x="1" y="1" width="10" height="10" fill="#8fa3b8"/>
    <path d="M-9 -8 H-3 M-9 -4 H-3 M3 -8 H9 M3 -4 H9 M-9 4 H-3 M-9 8 H-3 M3 4 H9 M3 8 H9" stroke="#f2d98a" stroke-width="1.3"/>`,
  burner: `<rect x="-9" y="-7" width="22" height="20" fill="#000" opacity="0.22"/>
    <rect x="-11" y="-6" width="20" height="16" rx="1.5" fill="#8a5a44" stroke="#4a2a1e" stroke-width="1"/>
    <rect x="3" y="-13" width="5" height="9" fill="#6b4535" stroke="#4a2a1e" stroke-width="0.9"/>
    <path d="M-6 6 C-7 2 -4 0 -3 -2 C-2 1 0 1 0 -1 C2 2 2 5 0 6 Z" fill="#ffb238" stroke="#d9531e" stroke-width="0.9"/>
    <circle cx="5.5" cy="-14" r="2.2" fill="#c8c8c8" opacity="0.7"/>`,
  rig: `<rect x="-8" y="-8" width="22" height="22" fill="#000" opacity="0.2"/>
    <path d="M-9 11 L0 -12 L9 11" fill="none" stroke="#e0a93a" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M-5.5 2 H5.5 M-3 -5 H3" stroke="#e0a93a" stroke-width="1.6"/>
    <rect x="-11" y="9" width="22" height="4" rx="1" fill="#59616b" stroke="#2b3038" stroke-width="0.8"/>
    <path d="M0 -12 V9" stroke="#3d434a" stroke-width="1.6"/><circle cx="0" cy="-12" r="2" fill="#f2c14e" stroke="#5a4310" stroke-width="0.8"/>`,
  solar: `<rect x="-10" y="-8" width="24" height="22" fill="#000" opacity="0.18"/>
    <rect x="-12" y="-11" width="24" height="22" rx="1" fill="#1d3e78" stroke="#c9d3df" stroke-width="1.2"/>
    <path d="M-4 -11 V11 M4 -11 V11 M-12 -3.7 H12 M-12 3.7 H12" stroke="#6f93cf" stroke-width="1"/>
    <path d="M-11 -10 L-6 -10 L-10 -6 Z" fill="#9fc0f0" opacity="0.7"/>`,
  cabin: `<rect x="-9" y="-5" width="22" height="18" fill="#000" opacity="0.22"/>
    <path d="M-12 -1 L0 -11 L12 -1 Z" fill="#7a4a2a" stroke="#3e2414" stroke-width="1" stroke-linejoin="round"/>
    <rect x="-10" y="-1" width="20" height="12" fill="#a0683e" stroke="#3e2414" stroke-width="1"/>
    <path d="M-10 3 H10 M-10 7 H10" stroke="#6e4426" stroke-width="0.9"/><rect x="-3" y="3" width="6" height="8" fill="#3e2414"/>
    <path d="M7 -14 L11 -6 M11 -14 L7 -6" stroke="#cfd5db" stroke-width="1.6"/>`,
  camp: `<rect x="-9" y="-6" width="22" height="19" fill="#000" opacity="0.22"/>
    <path d="M-12 11 L-3 -9 L6 11 Z" fill="#c9a66b" stroke="#5a4310" stroke-width="1" stroke-linejoin="round"/>
    <path d="M-3 -9 V11" stroke="#5a4310" stroke-width="0.9"/><path d="M-6 11 L-3 3 L0 11 Z" fill="#4a3a28"/>
    <path d="M5 -10 L12 -3 M8 -12 L4 -6 L10 -8" stroke="#8d969e" stroke-width="2" stroke-linecap="round"/>
    <path d="M6 -8 L13 1" stroke="#7a4a2a" stroke-width="1.6" stroke-linecap="round"/>`,
  silo: `<rect x="-11" y="-10" width="26" height="25" fill="#000" opacity="0.22"/>
    <rect x="-13" y="-13" width="26" height="26" rx="2" fill="#7d858f" stroke="#2b3038" stroke-width="1"/>
    <rect x="-11.5" y="-11.5" width="23" height="23" rx="1.5" fill="none" stroke="#f2c14e" stroke-width="1.6" stroke-dasharray="3 2.5"/>
    <rect x="-13" y="-4" width="5" height="8" fill="#5a626c" stroke="#2b3038" stroke-width="0.8"/><rect x="8" y="-4" width="5" height="8" fill="#5a626c" stroke="#2b3038" stroke-width="0.8"/>
    <circle r="8" fill="#22262c" stroke="#14171b" stroke-width="1.2"/><circle r="6.2" fill="none" stroke="#454c55" stroke-width="0.9"/>
    <path d="M-5.5 -5.5 L5.5 5.5 M5.5 -5.5 L-5.5 5.5" stroke="#b9c0c6" stroke-width="1.8"/>
    <circle r="4.2" fill="#e8ecef" stroke="#8d969e" stroke-width="0.8"/><circle r="2.5" fill="#f6f8f9"/><circle r="1.5" fill="#d64045"/>`,
  turret: `<ellipse cx="1.5" cy="3" rx="12" ry="10" fill="#000" opacity="0.2"/>` + ring(10, 9, 3, '#8f7a52') + ring(10, 9, 2.3, '#bfa674', -0.4, -0.5) +
    `<circle r="6.6" fill="#4a4034"/><circle r="4.6" fill="#55603a" stroke="#262b18" stroke-width="0.9"/>
    <g transform="rotate(-30)"><rect x="1" y="-2.6" width="12" height="1.8" rx="0.6" fill="#22262c"/><rect x="1" y="0.8" width="12" height="1.8" rx="0.6" fill="#22262c"/>
    <rect x="-3.4" y="-3.4" width="6.8" height="6.8" rx="1.4" fill="#6f7a4a" stroke="#262b18" stroke-width="0.8"/></g>`,
  airdef: `<rect x="-10" y="-9" width="24" height="23" fill="#000" opacity="0.22"/>
    <rect x="-12" y="-12" width="24" height="24" rx="3" fill="#5f6f78" stroke="#263238" stroke-width="1"/>
    <circle r="8.5" fill="#3d4a52" stroke="#1d262b" stroke-width="1"/>
    <g transform="rotate(-35)"><rect x="-6.5" y="-3.2" width="15" height="2.6" rx="1" fill="#dfe6ea" stroke="#59616b" stroke-width="0.6"/>
    <rect x="-6.5" y="0.6" width="15" height="2.6" rx="1" fill="#dfe6ea" stroke="#59616b" stroke-width="0.6"/>
    <path d="M8.5 -3.2 L11 -1.9 L8.5 -0.6 Z M8.5 0.6 L11 1.9 L8.5 3.2 Z" fill="#d64045"/>
    <rect x="-7.5" y="-4.2" width="5" height="8.4" rx="1" fill="#7c8a93" stroke="#263238" stroke-width="0.7"/></g>
    <path d="M-9.5 9.5 A13.5 13.5 0 0 1 -9.5 -9.5" fill="none" stroke="#7bd389" stroke-width="1.3" stroke-dasharray="2.5 2"/>`,
  mortar: `<ellipse cx="1.5" cy="3" rx="12" ry="10" fill="#000" opacity="0.2"/>` + ring(9, 8.6, 3.3, '#8f7a52') + ring(9, 8.6, 2.6, '#bfa674', -0.4, -0.5) +
    `<circle r="6.4" fill="#4a4034"/><circle r="4.2" fill="#6b6f74" stroke="#2b3038" stroke-width="0.9"/>
    <rect x="-2.2" y="-12" width="4.4" height="13" rx="1.6" fill="#3a4049" stroke="#1d2126" stroke-width="0.8" transform="rotate(38)"/>
    <circle cx="6.6" cy="-8.4" r="1.5" fill="#111417"/>`,
  truck: `<ellipse cx="0" cy="8" rx="12" ry="2.5" fill="#000" opacity="0.2"/>
    <rect x="-12" y="-6" width="15" height="11" rx="1" fill="#c9a66b" stroke="#5a4310" stroke-width="1"/>
    <path d="M-12 -2 H3" stroke="#a6844c" stroke-width="0.9"/>
    <path d="M3 -3 H8 L12 1 V5 H3 Z" fill="#2f7de1" stroke="#1c4f99" stroke-width="1" stroke-linejoin="round"/>
    <path d="M5 -1.5 H7.5 L9.8 1 H5 Z" fill="#cfe3ff"/>
    <circle cx="-7" cy="6" r="2.6" fill="#2b3038"/><circle cx="7" cy="6" r="2.6" fill="#2b3038"/>
    <circle cx="-7" cy="6" r="1" fill="#8d969e"/><circle cx="7" cy="6" r="1" fill="#8d969e"/>`,
  bolt: `<path d="M2 -11 L-7 2 H-1 L-3 11 L7 -3 H1 Z" fill="#f2c14e" stroke="#5a4310" stroke-width="0.9" stroke-linejoin="round"/>`,
  station: `<rect x="-10" y="-8" width="24" height="20" fill="#000" opacity="0.22"/>
    <rect x="-12" y="-10" width="24" height="20" rx="2" fill="#a3aab1" stroke="#4c535b" stroke-width="1"/>
    <path d="M-9 -2 V6 M-4 -2 V6 M1 -2 V6 M6 -2 V6" stroke="#6b5240" stroke-width="1.6"/>
    <path d="M-12 0 H12 M-12 4 H12" stroke="#3d434a" stroke-width="1.4"/>
    <rect x="-7" y="-10" width="14" height="6" fill="#c4553a" stroke="#6b2b1b" stroke-width="0.8"/>`,
  port: `<rect x="-12" y="-12" width="24" height="24" rx="2" fill="#4a86ab"/><rect x="-12" y="-12" width="24" height="7" fill="#dccf93"/>
    <rect x="-4" y="-7" width="8" height="18" fill="#a67c52" stroke="#6b4a2b" stroke-width="0.9"/>
    <path d="M-4 -2 H4 M-4 3 H4 M-4 8 H4" stroke="#6b4a2b" stroke-width="0.8"/>
    <circle cx="-5.5" cy="10" r="1.4" fill="#5a3d22"/><circle cx="5.5" cy="10" r="1.4" fill="#5a3d22"/>`,
  tree: `<ellipse cx="1.5" cy="3" rx="7" ry="4" fill="#000" opacity="0.18"/><circle r="7" fill="#3d6b32"/>
    <circle cx="-2" cy="-2" r="4.2" fill="#558a3f"/><circle cx="-3" cy="-3" r="1.6" fill="#72a855"/>`,
  rock: `<ellipse cx="1" cy="4" rx="8" ry="3.5" fill="#000" opacity="0.2"/>
    <path d="M-8 3 L-6 -4 L-1 -7 L5 -5 L8 1 L5 5 L-4 6 Z" fill="#8e959c" stroke="#5f666d" stroke-width="1"/>
    <path d="M-6 -4 L-1 -7 L5 -5 L1 -1 L-4 0 Z" fill="#bcc2c8"/>`,
  ore: `<ellipse cx="1" cy="4" rx="8" ry="3.5" fill="#000" opacity="0.2"/>
    <path d="M-8 2 L-5 -5 L1 -7 L6 -4 L8 2 L4 6 L-4 5 Z" fill="#7a5040" stroke="#45291f" stroke-width="1"/>
    <path d="M-5 -5 L1 -7 L6 -4 L2 0 L-4 -1 Z" fill="#a96d52"/>
    <circle cx="-3" cy="2" r="1.1" fill="#d6e1ea"/><circle cx="3" cy="-2.5" r="0.9" fill="#d6e1ea"/>`,
  boat: `<path d="M-12 0 H12 L8 7 H-8 Z" fill="#a67c52" stroke="#5a3d22" stroke-width="1"/>
    <path d="M0 -12 V0" stroke="#5a3d22" stroke-width="1.5"/><path d="M1 -11 L10 -3 H1 Z" fill="#f4f1e6" stroke="#8d969e" stroke-width="0.6"/>`,
};
// SPR holds each sprite as an SVG image; RAS holds it drawn once into two small bitmaps (large and small).
// The map draws from RAS: stamping a bitmap is many times faster than drawing an SVG image, which the
// browser re-renders from its shapes on every draw, and a forest is thousands of draws a frame.
// pixel art: rows of characters, one per pixel, coloured by the palette ('.' is see-through), centred in the 30x30 box
function pix(rows, pal, scale) {
  const h = rows.length, w = Math.max(...rows.map(r => r.length)), k = scale || Math.min(28 / w, 28 / h);
  let out = `<g shape-rendering="crispEdges">`;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = pal[row[x]];
      if (c) out += `<rect x="${(-w * k / 2 + x * k).toFixed(2)}" y="${(-h * k / 2 + y * k).toFixed(2)}" width="${(k + 0.05).toFixed(2)}" height="${(k + 0.05).toFixed(2)}" fill="${c}"/>`;
    }
  });
  return out + '</g>';
}
const K = '#141018';
Object.assign(SHAPES, {
  // troops: the helmet changes with your army's tech
  helmLeather: pix([
    '....KKKKK....', '...KLLLLLK...', '..KLLHLLLLK..', '..KLHLLLLLK..', '.KLLLLLLLLLK.', '.KDDDDDDDDDK.',
    '.KLK.....KLK.', '.KLK.....KLK.', '..K.......K..'], { K, L: '#9a6638', H: '#c08a52', D: '#6b4222' }),
  helmBronze: pix([
    '......RR.....', '.....RRRR....', '....KKKKK....', '...KBBBBBK...', '..KBHBBBBBK..', '..KBHBBBBBK..',
    '.KBBBBBBBBBK.', '.KBBK...KBBK.', '.KBBK...KBBK.', '.KBBBK.KBBBK.', '..KKK...KKK..'], { K, R: '#c23b2b', B: '#c98a3a', H: '#f0c070' }),
  helmIron: pix([
    '....KKKKK....', '...KIIIIIK...', '..KIHIIIIIK..', '..KIHIIIIIK..', '.KIIIIIIIIIK.', 'KKKKKIIIKKKKK',
    '.....KIK.....', '.....KIK.....', '......K......'], { K, I: '#8d969e', H: '#d2d8dd' }),
  helmSteel: pix([
    '.....KKKKK.....', '....KGGGGGK....', '...KGHGGGGGK...', '...KGGGGGGGK...', 'KKKKGGGGGGGKKKK', 'KGGGGGGGGGGGGGK',
    '.KKKKKKKKKKKKK.'], { K, G: '#6f7a4a', H: '#9aa46c' }),
  helmModern: pix([
    '....KKKKKK....', '...KMMMMMMK...', '..KMHMMMMMMK..', '.KMMMMMMMMMMK.', '.KMMMMMMMMMMK.', '.KSSSSSSSSSSK.',
    '.KMMK....KMMK.', '..KK......KK..'], { K, M: '#4b5536', H: '#748052', S: '#1d2016' }),
  // haulers on the roads: on foot, then a handcart (the Wheel), a horse (Equestrianism), a carriage, a truck
  porter: pix([
    '.....SSS....', '....SSSSS...', '.....FF.....', '....FFF.....', '...TTTTT....', '...TTTTT....',
    '....TTT.....', '....P.P.....', '...P...P....'], { S: '#c9a66b', F: '#e0b48c', T: '#7a5a3a', P: '#3d2a1c' }),
  handcart: pix([
    '..BBBBBBBB......', '.BCCCCCCCCB.....', '.BCCCCCCCCBHHHHH', '.BBBBBBBBBB.....', '....KWWK.........',
    '...KWKKWK.......', '...KWKKWK.......', '....KWWK........'], { K, B: '#6b4222', C: '#c9a66b', H: '#8a5a34', W: '#d9c49a' }),
  horse: pix([
    '..........HH....', '.........HHHH...', '..SSSSS..HHE....', '.SBBBBBSHHH.....', '.HHHHHHHHHH.....',
    '.HHHHHHHHH......', '.H.H....H.H.....', '.H.H....H.H.....', '.K.K....K.K.....'], { K, H: '#8a5532', E: '#141018', S: '#c9a66b', B: '#e8d3a8' }),
  carriage: pix([
    '..WWWWWWW............', '.WWWWWWWWW.......HH..', '.WWWWWWWWW......HHHH.', '.BBBBBBBBBRRRRRHHHE..',
    '.BBBBBBBBB.....HHHH..', '..KWK..KWK.....H..H..', '..KKK..KKK.....H..H..'], { K, W: '#eee6d2', B: '#6b4222', R: '#3d2a1c', H: '#8a5532', E: '#141018' }),
  truck: pix([
    '..........CCCC..', '.BBBBBBBB.CGGCC.', '.BBBBBBBB.CGGCCC', '.BBBBBBBBCCCCCCC', '.BBBBBBBBCCCCCCC',
    '.KKKKKKKKKKKKKKK', '..KWK.....KWK...', '...K.......K....'], { K, B: '#c9a66b', C: '#b8432f', G: '#9fd0ff', W: '#8d969e' }),
  // boats: a rowboat, then sail (Sailing), a galleon (Shipbuilding), a steamship (Steam Power)
  rowboat: pix([
    '........P.......', '.......PFP......', '.......PTP......', '..O.HHHHHHHH.O..', '...OHHHHHHHHO...',
    '....HHHHHHHH....', '.....DDDDDD.....', 'wwwwwwwwwwwwwwww'], { P: '#3d2a1c', F: '#e0b48c', T: '#7a5a3a', O: '#d9c49a', H: '#8a5a34', D: '#6b4222', w: '#9fd0ff' }),
  sailboat: pix([
    '.......M........', '.......MSS......', '.......MSSS.....', '.......MSSSS....', '.......MSSSSS...',
    '.......MSSSSSS..', '.......M........', '..HHHHHHHHHHHH..', '...HHHHHHHHHH...', '....DDDDDDDD....', 'wwwwwwwwwwwwwwww'],
    { M: '#5a3b26', S: '#f4efe0', H: '#a0683e', D: '#6b4222', w: '#9fd0ff' }),
  galleon: pix([
    '.....M....M.....', '....SSS..SSS....', '...SSSSSSSSSS...', '...SSSSSSSSSS...', '....SSS..SSS....',
    '.....M....M..F..', 'HHHHHHHHHHHHHHH.', '.HHGHHGHHGHHHH..', '..DDDDDDDDDDD...', 'wwwwwwwwwwwwwwww'],
    { M: '#5a3b26', S: '#f4efe0', F: '#c23b2b', H: '#8a5a34', G: '#f2c14e', D: '#5a3b26', w: '#9fd0ff' }),
  steamship: pix([
    '.....R..........', '.....R....R.....', '....KKK..KKK....', '....RRR..RRR....', '..WWWWWWWWWWW...',
    '..WGWGWGWGWGW...', 'BBBBBBBBBBBBBBBB', '.BBBBBBBBBBBBBB.', '..RRRRRRRRRRRR..', 'wwwwwwwwwwwwwwww'],
    { K, R: '#b8432f', W: '#eef1f3', G: '#5b8fbf', B: '#2b3038', w: '#9fd0ff' }),
  uranI: pix(['...GGG...', '..GLLLG..', '.GLHHLLG.', 'GLLHLLLLG', 'GLLLLLLLG', '.GLLLLLG.', '..GGGGG..'], { G: '#2e6b1f', L: '#7ee05a', H: '#d6ffb0' }),
  reactor: `<rect x="-12" y="-10" width="27" height="24" fill="#000" opacity="0.2"/>
    <path d="M-12 12 C-9 4 -9 -2 -11 -10 H1 C-1 -2 -1 4 2 12 Z" fill="#dfe4e8" stroke="#59616b" stroke-width="1"/>
    <path d="M-11 -10 H1" stroke="#59616b" stroke-width="1.4"/><circle cx="-5" cy="-13" r="3" fill="#eef1f3" opacity="0.8"/>
    <rect x="3" y="0" width="10" height="12" fill="#8fa3b8" stroke="#2b3038" stroke-width="0.9"/>
    <circle cx="8" cy="5" r="2.6" fill="#7ee05a" stroke="#2e6b1f" stroke-width="0.7"/>`,
  oilplant: `<rect x="-11" y="-9" width="25" height="23" fill="#000" opacity="0.2"/>
    <rect x="-12" y="-2" width="20" height="13" fill="#59616b" stroke="#2b3038" stroke-width="1"/>
    <rect x="8" y="-13" width="4" height="24" fill="#3d434a" stroke="#1d2016" stroke-width="0.8"/>
    <circle cx="10" cy="-15" r="2.6" fill="#2b2f36" opacity="0.7"/>
    <path d="M-8 4 C-8 1 -5 -2 -5 -2 C-5 -2 -2 1 -2 4 A3 3 0 0 1 -8 4 Z" fill="#2b2f36"/>
    <path d="M0 3 H6 M0 6 H6" stroke="#f2c14e" stroke-width="1.2"/>`,
  nuke: `<circle r="12" fill="#f2c14e" stroke="#141018" stroke-width="1.4"/><circle r="2.6" fill="#141018"/>` +
    [0, 120, 240].map(a => `<path d="M0 0 L-5 -9 A10.4 10.4 0 0 1 5 -9 Z" transform="rotate(${a}) translate(0 -1.5)" fill="#141018"/>`).join(''),
});
const SVG = {}, SPR = {}, RAS = {};
for (const [name, inner] of Object.entries(SHAPES)) {
  SVG[name] = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-15 -15 30 30" width="64" height="64">${inner}</svg>`;
  const img = new Image();
  img.onload = () => {
    RAS[name] = [128, 40].map(px => {
      const c = document.createElement('canvas');
      c.width = c.height = px;
      c.getContext('2d').drawImage(img, 0, 0, px, px);
      return c;
    });
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(SVG[name]);
  SPR[name] = img;
}
const DEP_SPRITE = { forest: 'tree', stone: 'rock', iron: 'ore', gold: 'goldI', oil: 'oilI', wheat: 'wheat', uranium: 'uranI' };
const DEP_RES = { forest: 'wood', stone: 'stone', iron: 'iron', gold: 'gold', oil: 'oil', wheat: 'wheat', uranium: 'uranium' };
const DEP_KINDS = ['forest', 'stone', 'iron', 'gold', 'oil', 'wheat', 'uranium'];
const DEP_COLOR = { forest: '#3f7a35', stone: '#a7adb3', iron: '#a8654a', gold: '#e8c040', oil: '#23262b', wheat: '#e0bc4e', uranium: '#7ee05a' };
const BLD_CODE = { settlement: 1, station: 3, port: 4, burner: 6, rig: 7, solar: 8, cabin: 9, camp: 10, silo: 11, mortar: 12, airdef: 13, turret: 14,
  farm: 15, farm2: 16, farm3: 17, derrick: 18, oilplant: 19, airport: 20, base: 21, fort: 22, reactor: 23 };
const BLD_COLOR = { settlement: '#de6d4c', station: '#8f979f', port: '#a67c52',
  burner: '#8a5a44', rig: '#e0a93a', solar: '#1d3e78', cabin: '#a0683e', camp: '#c9a66b', silo: '#6c7480', mortar: '#8f7a52', airdef: '#4f7f8c', turret: '#6f7a4a',
  farm: '#d9b24a', farm2: '#e0bc4e', farm3: '#e8c652', derrick: '#2b2f36', oilplant: '#4a4f57', airport: '#59616b', base: '#6f7a4a', fort: '#9aa1a8', reactor: '#cfd6dc' };
// which building stands on tile i (an index kept beside the list; rebuilt when anything is removed)
let bldVer = 0, bldMapVer = -1;
const bldMap = new Map();
function buildingAt(i) {
  if (!building[i]) return null;
  if (bldMapVer !== bldVer) { bldMap.clear(); bldMapVer = bldVer; }
  let b = bldMap.get(i);
  if (!b || b.i !== i) { b = game.buildings.find(q => q.i === i) || null; if (b) bldMap.set(i, b); }
  return b;
}
// the steps from `have` (or clear land) up to `type`, or null if `have` isn't below `type` on its ladder
function ladderSteps(type, have) {
  const steps = [];
  for (let t = type; t;) {
    if (t === have) return steps;
    steps.unshift(t);
    const f = CFG.buildings[t].from;
    if (Array.isArray(f)) return f.includes(have) ? steps : null;   // a branching ladder: only as an upgrade
    t = f;
  }
  return have ? null : steps;
}
const RES_ICON = { wood: 'tree', stone: 'rock', iron: 'ore', oil: 'oilI', wheat: 'wheat', gold: 'goldI', uranium: 'uranI' };
const RESOURCES = ['wood', 'stone', 'iron', 'oil', 'wheat', 'uranium'];   // what a domain stores (gold goes straight into research)

// ======================================================================
// world state
// ======================================================================
const OCEAN = 0, GRASS = 1, DESERT = 2, MOUNTAIN = 3, ICE = 4, VOID = 5;
const BIOME_NAME = ['Ocean', 'Grassland', 'Desert', 'Mountains', 'Ice wall', 'Space'];
const BIOME_KEY = [null, 'grass', 'desert', 'mountain', null, null];

const params = new URLSearchParams(location.search);
// autosave lives in this browser (localStorage). Opening the game without ?seed= resumes it.
const SAVE_KEY = 'game-trial-save-v2';
const SAVE_V = 1;
const SAVED = (() => { try { const v = JSON.parse(localStorage.getItem(SAVE_KEY)); return v && v.v === SAVE_V ? v : null; } catch (e) { return null; } })();
const SEED = params.has('seed') ? (parseInt(params.get('seed'), 10) || 1) : SAVED ? SAVED.seed : ((Math.random() * 1e6) | 0);
const RESUME = SAVED && SAVED.seed === SEED ? SAVED : null;
const W = CFG.mapW, H = CFG.mapH, N = W * H;
const rng = mulberry32(SEED);
const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIRS8 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [1, 1, 1], [1, -1, 1], [-1, 1, 1], [-1, -1, 1]];
const idx = (x, y) => y * W + x;
const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

const elev = new Float32Array(N), moist = new Float32Array(N), detail = new Float32Array(N);
const oceanDist = new Uint8Array(N);
const iceT = new Float32Array(N);          // 0 = inner face of the ice wall, 1 = outer edge
const biome = new Uint8Array(N);
const isLand = i => biome[i] >= GRASS && biome[i] <= MOUNTAIN;
const DISK = { cx: W / 2, cy: H / 2, R: Math.min(W, H) / 2 - 2 };   // outer edge of the ice wall
const landmass = new Int32Array(N).fill(-1);
const owner = new Uint8Array(N);
const depositOf = new Int16Array(N).fill(-1);
const building = new Uint8Array(N);
const aiOf = new Uint8Array(N);              // which AI nation owns each tile (0 = none; else nation id + 1)
const deposits = [];
let seaLevel = 0, mtnLevel = 0, maxElev = 1;
let spawn = { x: 0, y: 0 };
let capitalTile = 0;

const game = {
  countries: [],          // every domain you have founded (merged ones stay, marked not alive)
  active: 0,              // the domain the HUD is showing
  population: 0, peakPop: 0,
  time: 0, landTiles: 0, ownedCount: 0,
  buildings: [], links: [],
  hubs: { road: [], sea: [], rail: [], air: [] },   // ports, stations, airports (tiles)
  pushes: [], expeditions: [], floats: [],
  convoys: [],                     // haulers and deliveries on the move
  connects: [],                    // roads you built out to your buildings
  walls: [],                       // walls you built between forts
  warhead: 'conventional',         // what your next missile carries
  wallFrom: -1,                    // the fort you're building a wall from (waiting for you to pick the other)
  sendPct: 25, troopPct: 50, tool: null, netDirty: true,
  mode: 'command',                 // 'command': clicks expand / attack · 'build': clicks place the building you picked
  cmd: 'expand',                   // what a click does in command mode: expand, attack, expedition
  ghost: null,                     // the building you're placing: { type, i } until you confirm
  recruit: true,                   // bases train units
  nations: [],                     // AI nations
  research: { done: new Set(), cur: null, pts: 0, rate: 0, gold: 0 },
  armies: [],                      // units on the move (to a fortress, to the front, home again)
  attacks: [],                     // your units pushing into a nation's land
  missiles: [], blasts: [], scorch: [], tracers: [], aiming: false,
  raids: [],                       // waves of a nation's troops pushing into your land
  driving: null,                   // the expedition you're steering right now
  notes: [],                       // notifications (tech discoveries)
};
const frontier = new Set();   // unowned land tiles touching our territory

// ======================================================================
// map generation
// ======================================================================
function generateTerrain() {
  const s = SEED, { cx, cy, R } = DISK;
  const inside = new Uint8Array(N);   // 1 = inside the ice wall (land or ocean)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = idx(x, y);
    detail[i] = fbm(x / 5, y / 5, s + 33, 3);
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, r = Math.hypot(dx, dy);
    if (r > R) { biome[i] = VOID; continue; }
    // ice wall thickness wobbles around the rim (noise sampled on a circle, so it wraps seamlessly)
    const ang = Math.atan2(dy, dx);
    const wall = CFG.iceWall.min + fbm(Math.cos(ang) * 7 + 50, Math.sin(ang) * 7 + 50, s + 61, 3) * CFG.iceWall.extra;
    if (r > R - wall) { biome[i] = ICE; iceT[i] = (r - (R - wall)) / wall; continue; }
    inside[i] = 1;
    const wx = x + (fbm(x / 45, y / 45, s + 5, 3) - 0.5) * 36;
    const wy = y + (fbm(x / 45, y / 45, s + 9, 3) - 0.5) * 36;
    // two scales: big continents + smaller blobs that break off as islands
    const cs = CFG.continentScale;
    let e = fbm(wx / cs, wy / cs, s, 5) * 0.7 + fbm(wx / 32, wy / 32, s + 51, 4) * 0.3;
    // land thins out toward the wall, so the rim is mostly a ring of sea (with some coasts reaching the ice)
    const edge = clamp((R - wall - r) / (R * 0.07), 0, 1);
    e = e * (0.7 + 0.3 * edge) - (1 - edge) * 0.09;
    elev[i] = e;
    moist[i] = fbm(x / CFG.climateScale, y / CFG.climateScale, s + 77, 4);
  }
  const sample = [];
  for (let guard = 0; sample.length < 30000 && guard < 400000; guard++) {
    const i = (rng() * N) | 0;
    if (inside[i]) sample.push(elev[i]);
  }
  sample.sort((a, b) => a - b);
  seaLevel = sample[Math.floor(sample.length * CFG.waterFraction)];

  const landE = [], landM = [];
  for (let i = 0; i < N; i++) if (inside[i] && elev[i] > seaLevel) { landE.push(elev[i]); landM.push(moist[i]); }
  landE.sort((a, b) => a - b); landM.sort((a, b) => a - b);
  mtnLevel = landE[Math.floor(landE.length * (1 - CFG.mountainShare))];
  maxElev = landE[landE.length - 1];
  const dryLevel = landM[Math.floor(landM.length * CFG.desertShare)];

  for (let i = 0; i < N; i++) {
    if (!inside[i]) continue;
    if (elev[i] <= seaLevel) biome[i] = OCEAN;
    else if (elev[i] >= mtnLevel) biome[i] = MOUNTAIN;
    else if (moist[i] <= dryLevel) biome[i] = DESERT;
    else biome[i] = GRASS;
    if (isLand(i)) game.landTiles++;
  }

  // distance from land (or the ice wall), for ocean shading
  oceanDist.fill(255);
  const q = [];
  for (let i = 0; i < N; i++) if (biome[i] !== OCEAN && biome[i] !== VOID) { oceanDist[i] = 0; q.push(i); }
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % W, y = (i / W) | 0, d = oceanDist[i];
    if (d >= 20) continue;
    for (const [dx, dy] of DIRS4) {
      const nx = x + dx, ny = y + dy;
      if (!inb(nx, ny)) continue;
      const n = idx(nx, ny);
      if (oceanDist[n] > d + 1) { oceanDist[n] = d + 1; q.push(n); }
    }
  }

  // landmass ids (rail can only link stations on the same landmass)
  let lm = 0;
  for (let s0 = 0; s0 < N; s0++) {
    if (!isLand(s0) || landmass[s0] >= 0) continue;
    const stack = [s0]; landmass[s0] = lm;
    while (stack.length) {
      const i = stack.pop(), x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of DIRS4) {
        const nx = x + dx, ny = y + dy;
        if (!inb(nx, ny)) continue;
        const n = idx(nx, ny);
        if (isLand(n) && landmass[n] < 0) { landmass[n] = lm; stack.push(n); }
      }
    }
    lm++;
  }
}

// Spawn on open grassland near the middle of the disk: search the central 35% of the
// radius first, and only widen the search if nothing good is found there.
function chooseSpawn() {
  let best = null, bestScore = -1;
  for (const frac of [0.35, 0.55, 0.8]) {
    for (let t = 0; t < 4000; t++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * DISK.R * frac;
      const x = Math.round(DISK.cx + Math.cos(a) * r), y = Math.round(DISK.cy + Math.sin(a) * r);
      if (x < 14 || y < 14 || x >= W - 14 || y >= H - 14 || biome[idx(x, y)] !== GRASS) continue;
      let grass = 0, tot = 0;
      for (let dy = -12; dy <= 12; dy++) for (let dx = -12; dx <= 12; dx++) {
        if (dx * dx + dy * dy > 144) continue;
        tot++; if (biome[idx(x + dx, y + dy)] === GRASS) grass++;
      }
      // mostly "how much grass around", with a small nudge toward the exact centre
      const score = grass / tot - (r / DISK.R) * 0.05;
      if (score > bestScore) { bestScore = score; best = { x, y }; }
    }
    if (bestScore > 0.85) break;
  }
  return best;
}

function growBlob(sx, sy, n, ok) {
  let start = -1;
  for (let r = 0; r < 6 && start < 0; r++)          // nudge to a valid start tile
    for (let dy = -r; dy <= r && start < 0; dy++) for (let dx = -r; dx <= r && start < 0; dx++) {
      if (inb(sx + dx, sy + dy) && ok(idx(sx + dx, sy + dy))) start = idx(sx + dx, sy + dy);
    }
  if (start < 0) return null;
  const tiles = [start], inSet = new Set([start]), front = [start];
  let guard = n * 60;
  while (tiles.length < n && front.length && guard-- > 0) {
    const k = (rng() * front.length) | 0, t = front[k];
    const [dx, dy] = DIRS4[(rng() * 4) | 0];
    const nx = (t % W) + dx, ny = ((t / W) | 0) + dy;
    if (inb(nx, ny)) {
      const ni = idx(nx, ny);
      if (!inSet.has(ni) && ok(ni)) { inSet.add(ni); tiles.push(ni); front.push(ni); continue; }
    }
    if (rng() < 0.2) front.splice(k, 1);
  }
  return tiles;
}

function addDeposit(type, tiles) {
  if (!tiles || tiles.length < 4) return;
  const id = deposits.length;
  let sx = 0, sy = 0;
  for (const t of tiles) { depositOf[t] = id; sx += t % W; sy += (t / W) | 0; }
  deposits.push({ type, tiles, cx: sx / tiles.length, cy: sy / tiles.length });
}

// hidden oil (before Petroleum) is just plain land to the player
const oilKnown = () => game.research.done.has('petroleum');
const uraniumKnown = () => game.research.done.has('fission');
const depVisible = d => d >= 0 && (deposits[d].type !== 'oil' || oilKnown()) && (deposits[d].type !== 'uranium' || uraniumKnown());
const hasDep = i => depVisible(depositOf[i]);
const isField = i => depositOf[i] >= 0 && deposits[depositOf[i]].type === 'wheat';

// ---------- wheat fields: a farm turns the plain land around it into fields ----------
function sowFields(i) {
  const b = buildingAt(i), side = sideOf(i), tiles = [];
  if (!b || b.field != null) return;
  eachInReach(i, t => {
    if (t === i || depositOf[t] >= 0 || building[t] || !isLand(t) || biome[t] === MOUNTAIN || sideOf(t) !== side) return;
    tiles.push(t);
  }, CFG.wheat.radius);
  b.field = deposits.length;
  deposits.push({ type: 'wheat', tiles, cx: i % W, cy: (i / W) | 0, farm: i });
  for (const t of tiles) { depositOf[t] = b.field; repaintTile(t); }
  game.bldDirty = true;
}
function unsowFields(b) {
  if (b.field == null || !deposits[b.field]) return;
  for (const t of deposits[b.field].tiles) if (depositOf[t] === b.field) { depositOf[t] = -1; repaintTile(t); }
  deposits[b.field].tiles = [];
  b.field = null;
}

function generateWorld() {
  generateTerrain();
  spawn = chooseSpawn();
  const d2 = i => ((i % W) - spawn.x) ** 2 + (((i / W) | 0) - spawn.y) ** 2;
  const R = CFG.startRadius;

  // your first settlement: the grass tile closest to the spawn point
  let capD = Infinity;
  capitalTile = idx(spawn.x, spawn.y);
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    const i = idx(spawn.x + dx, spawn.y + dy);
    if (biome[i] === GRASS && dx * dx + dy * dy < capD) { capD = dx * dx + dy * dy; capitalTile = i; }
  }
  const reserved = new Set([capitalTile]);

  // guaranteed starting forest + stone, fully inside the start circle
  const okStart = i => biome[i] === GRASS && depositOf[i] < 0 && !reserved.has(i) && d2(i) <= (R - 1) ** 2;
  const startDeps = [deposits.length];
  addDeposit('forest', growBlob(spawn.x - 5, spawn.y - 1, 18, okStart));
  startDeps.push(deposits.length);
  addDeposit('stone', growBlob(spawn.x + 5, spawn.y + 2, 12, okStart));

  // scattered deposits; iron only in mountains/desert and never near the start
  const specs = [
    { type: 'forest', ok: b => b === GRASS, count: game.landTiles / 650, min: 14, max: 34, minDist: R + 4 },
    { type: 'stone', ok: b => b === GRASS || b === MOUNTAIN, count: game.landTiles / 1700, min: 8, max: 16, minDist: R + 4 },
    { type: 'iron', ok: b => b === MOUNTAIN || b === DESERT, count: game.landTiles / 1400, min: 8, max: 16, minDist: 40 },
    { type: 'gold', ok: b => b === MOUNTAIN || b === DESERT, count: game.landTiles * CFG.gold.count, min: 5, max: 10, minDist: 30 },
    { type: 'oil', ok: b => b === DESERT || b === GRASS, count: game.landTiles * CFG.oil.count, min: 8, max: 18, minDist: 45 },
    { type: 'uranium', ok: b => b === MOUNTAIN || b === DESERT, count: game.landTiles * CFG.uranium.count, min: 4, max: 9, minDist: 60 },
  ];
  for (const sp of specs) {
    let made = 0, tries = 0;
    while (made < sp.count && tries++ < sp.count * 30) {
      const i = (rng() * N) | 0;
      if (!sp.ok(biome[i]) || depositOf[i] >= 0 || d2(i) < sp.minDist ** 2) continue;
      const size = sp.min + ((rng() * (sp.max - sp.min)) | 0);
      const ok = j => sp.ok(biome[j]) && depositOf[j] < 0 && d2(j) > (R + 3) ** 2;
      const before = deposits.length;
      addDeposit(sp.type, growBlob(i % W, (i / W) | 0, size, ok));
      if (deposits.length > before) made++;
    }
  }

  // your home country: claim the start circle, place the first settlement
  const home = newCountry({ res: { ...CFG.startResources } });
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    if (dx * dx + dy * dy > R * R) continue;
    const x = spawn.x + dx, y = spawn.y + dy;
    if (inb(x, y) && biome[idx(x, y)] !== OCEAN) claim(idx(x, y), home.id);
  }
  placeBuilding(capitalTile, 'settlement');
  spawnNations();
  for (const id of startDeps) {
    const d = deposits[id];
    if (!d) continue;
    const mid = t => (t % W - d.cx) ** 2 + (((t / W) | 0) - d.cy) ** 2;   // the middle of the deposit, so its reach covers it
    const t = d.tiles.reduce((a, b) => (mid(a) <= mid(b) ? a : b));
    if (owner[t]) placeBuilding(t, d.type === 'forest' ? 'cabin' : 'camp');
  }
  // and a farm, on clear land a few tiles from the settlement, so your first people have something to eat
  let farmAt = -1, fd = Infinity;
  for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
    const i = idx(spawn.x + dx, spawn.y + dy), d = Math.abs(dx * dx + dy * dy - 16);
    if (owner[i] && biome[i] === GRASS && depositOf[i] < 0 && !building[i] && d < fd) { fd = d; farmAt = i; }
  }
  if (farmAt >= 0) { placeBuilding(farmAt, 'farm'); sowFields(farmAt); }
  recomputeNetwork();
  home.people = Math.min(CFG.startPeople, home.cap);
  game.started = true;
  game.population = game.peakPop = home.people;
}

// ======================================================================
// territory layers
// ======================================================================
// Two 1-px-per-tile layers: a flat tint for every owned tile, and the border
// pixels. Far out, both are drawn (chunky pixel border, like openfront). Close
// up, only the tint is drawn and the border is stroked as thin lines instead.
// Your countries are blue (new colonies too); AI nations use their own colours.
function makeLayer() {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  // x0..y1: bounding box of pixels changed since the last upload (only that part is re-uploaded)
  return { c, g, img: g.createImageData(W, H), dirty: true, x0: 0, y0: 0, x1: W - 1, y1: H - 1 };
}
function markDirty(L, x, y) {
  if (!L.dirty) { L.dirty = true; L.x0 = L.x1 = x; L.y0 = L.y1 = y; return; }
  if (x < L.x0) L.x0 = x; if (x > L.x1) L.x1 = x;
  if (y < L.y0) L.y0 = y; if (y > L.y1) L.y1 = y;
}
function flushLayer(L) {
  if (!L.dirty) return;
  L.g.putImageData(L.img, 0, 0, L.x0, L.y0, L.x1 - L.x0 + 1, L.y1 - L.y0 + 1);
  L.dirty = false;
}
const fillLayer = makeLayer(), borderLayer = makeLayer();
const PIXEL_BORDER_BELOW = 6;   // zoom where the border switches from pixels to lines
const COL = {
  fill: [47, 125, 225, 72], border: [28, 98, 214, 230],
};

function paintTerr(i) {
  const o = i * 4, f = fillLayer.img.data, b = borderLayer.img.data;
  const x = i % W, y = (i / W) | 0;
  markDirty(fillLayer, x, y); markDirty(borderLayer, x, y);
  if (!owner[i]) {
    const a = aiOf[i];
    if (!a) { f[o + 3] = 0; b[o + 3] = 0; return; }
    const col = game.nations[a - 1].col;
    let edge = false;
    for (const [dx, dy] of DIRS4) {
      const nx = x + dx, ny = y + dy;
      if (!inb(nx, ny) || aiOf[idx(nx, ny)] !== a) { edge = true; break; }
    }
    f[o] = col[0]; f[o + 1] = col[1]; f[o + 2] = col[2]; f[o + 3] = 78;
    if (edge) { b[o] = col[0] * 0.75; b[o + 1] = col[1] * 0.75; b[o + 2] = col[2] * 0.75; b[o + 3] = 235; } else b[o + 3] = 0;
    return;
  }
  let border = false;
  for (const [dx, dy] of DIRS4) {
    const nx = x + dx, ny = y + dy;
    if (!inb(nx, ny) || !owner[idx(nx, ny)]) { border = true; break; }
  }
  const fc = COL.fill, bc = COL.border;
  f[o] = fc[0]; f[o + 1] = fc[1]; f[o + 2] = fc[2]; f[o + 3] = fc[3];
  if (border) { b[o] = bc[0]; b[o + 1] = bc[1]; b[o + 2] = bc[2]; b[o + 3] = bc[3]; } else b[o + 3] = 0;
}

function claim(i, cid, conquer = false) {
  if (owner[i] || !isLand(i)) return false;
  const x = i % W, y = (i / W) | 0;
  if (aiOf[i]) {
    if (!conquer) return false;
    const n = game.nations[aiOf[i] - 1];
    n.tiles--; n.sx -= x; n.sy -= y;
    if (n.tiles) { n.lx = n.sx / n.tiles + 0.5; n.ly = n.sy / n.tiles + 0.5; }
    aiOf[i] = 0;                                   // their buildings on this tile are now yours
    provoke(n);
    game.bldDirty = true;
  }
  owner[i] = 1;
  countryOf[i] = cid;
  game.landDirty = true;                           // the settlement in reach of this tile now holds more
  game.ownedCount++;
  frontier.delete(i);
  paintTerr(i);
  addTileStats(game.countries[cid], i);
  if (depositOf[i] >= 0 || building[i]) game.bldDirty = true;   // a deposit's collector may now cover more tiles
  const me = liveCountry(cid);
  for (const [dx, dy] of DIRS4) {
    const nx = x + dx, ny = y + dy;
    if (!inb(nx, ny)) continue;
    const n = idx(nx, ny);
    if (owner[n]) { paintTerr(n); if (liveCountry(countryOf[n]) !== me) game.netDirty = true; }   // touching another country: merge
    else { if (aiOf[n]) { paintTerr(n); const foe = game.nations[aiOf[n] - 1]; if (foe.warFront) foe.warFront.add(i); } if (isLand(n)) frontier.add(n); }
  }
  return true;
}

const tileCost = i => CFG.tileCost[BIOME_KEY[biome[i]]];
// per-country tile stats, kept up to date one tile at a time
function resetTileStats(c) {
  c.tiles = 0; c.sx = 0; c.sy = 0; c.box = [Infinity, Infinity, -Infinity, -Infinity];
  c.geo = { coast: 0, mtn: 0, desert: 0, port: 0 };
}
function addTileStats(c, i) {
  const x = i % W, y = (i / W) | 0, b = c.box;
  c.tiles++; c.sx += x; c.sy += y; c.lx = c.sx / c.tiles + 0.5; c.ly = c.sy / c.tiles + 0.5;
  if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y;
  if (biome[i] === MOUNTAIN) c.geo.mtn++; else if (biome[i] === DESERT) c.geo.desert++;
  if (isCoastal(i)) c.geo.coast++;
}

// ======================================================================
// ======================================================================
// countries: every separate piece of your territory is a country with its own
// name, people and resources. Links move people and cargo between them; when two
// of your countries' borders touch, they merge into one.
// ======================================================================
const comp = new Int32Array(N).fill(-1);        // territory piece id per owned tile
const countryOf = new Int16Array(N).fill(-1);   // which of your countries owns each tile
function countryName(id) {
  const r = mulberry32(Math.floor(hash2(SEED, id + 1, 4242) * 4294967296));
  const short = makeName(r);
  return { short, full: `the Colony of ${short}` };
}
// A country's title grows with its housing (people capacity) and fits its land:
// the Colony of X -> X Harbor / X Hold / X Oasis / X Town -> the Republic of X -> the Federation of X -> the United States of X
const TITLE_TIERS = [
  { cap: 0 },
  { cap: 50, coast: ['{} Harbor', 'Port {}'], mtn: ['{} Hold', '{} Peaks'], desert: ['{} Oasis', '{} Sands'], land: ['{} Town', '{} Crossing', '{} Vale'] },
  { cap: 200, forms: ['the Free State of {}', 'the Republic of {}', 'the Kingdom of {}', 'the Duchy of {}'], coast: ['the Maritime Republic of {}'] },
  { cap: 1000, forms: ['the Federation of {}', 'the {} Commonwealth', 'the Dominion of {}', 'the Union of {}'] },
  { cap: 5000, forms: ['the United States of {}', 'the {} Empire', 'the Grand Union of {}'] },
];
function titleFor(c) {
  const T = TITLE_TIERS[c.tier], n = Math.max(1, c.tiles), g = c.geo;
  if (c.tier === 0) return `the Colony of ${c.short}`;
  const env = g.port || g.coast / n > 0.06 ? 'coast' : g.mtn / n > 0.4 ? 'mtn' : g.desert / n > 0.4 ? 'desert' : 'land';
  const opts = T.forms ? (env === 'coast' && T.coast ? [...T.forms, ...T.coast] : T.forms) : T[env];
  return opts[Math.floor(hash2(SEED, c.id * 7 + c.tier, 5151) * opts.length)].replace('{}', c.short);
}
function retitle(c, quiet) {
  const full = c.capBase + c.pw.capPow;                // housing with full power
  let tier = c.tier;
  while (tier + 1 < TITLE_TIERS.length && full >= TITLE_TIERS[tier + 1].cap) tier++;
  const grew = tier > c.tier;
  c.tier = tier;                                       // a title never shrinks back
  const old = c.full;
  c.full = titleFor(c);
  if (grew && !quiet && old !== c.full) {
    toast(`${old} is now ${c.full}!`);
    floatText(c.lx, c.ly - 3, `Now ${c.full}`, '#f2c14e');
  }
}
// ---------- AI nations (v1: static civilizations in their own colours) ----------
const NATION_COLORS = [[214, 64, 69], [156, 89, 209], [232, 140, 40], [38, 166, 154], [219, 90, 160], [150, 115, 70], [120, 170, 60], [200, 190, 60]];
const NATION_FORMS = ['the Empire of {}', 'the {} Horde', 'the Kingdom of {}', 'the {} Sultanate',
  'the Realm of {}', 'the {} Khanate', 'the Theocracy of {}', 'the {} Imperium'];
function nationName(k) {
  const r = mulberry32(Math.floor(hash2(SEED, k + 1, 9191) * 4294967296));
  const short = makeName(r);
  return { short, full: NATION_FORMS[(r() * NATION_FORMS.length) | 0].replace('{}', short) };
}
// every nation gets a personality (a play style, with its numbers nudged a little) and its own research
let persDeck = [];
function newMind(k, r) {
  const P = CFG.personalities;
  if (!persDeck.length) {                          // deal the personalities out like cards, so a map has a real mix
    persDeck = P.map((p, j) => j);
    for (let j = persDeck.length - 1; j > 0; j--) { const q = Math.floor(r() * (j + 1)); [persDeck[j], persDeck[q]] = [persDeck[q], persDeck[j]]; }
  }
  const base = P[persDeck.pop()], pers = { ...base };
  for (const key of ['aggression', 'military', 'raidEvery', 'raidShare', 'expand', 'research', 'defense']) pers[key] = base[key] * (0.8 + r() * 0.4);
  return { pers, R: new Set(['warrior']), rpts: r() * 30, rcur: null, units: 10 + Math.round(r() * 10) };
}
function spawnNations() {
  const r = mulberry32(Math.floor(hash2(SEED, 77, 31) * 4294967296));
  const A = CFG.ai, centers = [{ x: spawn.x, y: spawn.y }];
  let tries = 0;
  while (game.nations.length < A.count && tries++ < 5000) {
    const x = (r() * W) | 0, y = (r() * H) | 0, c = idx(x, y);
    if ((biome[c] !== GRASS && biome[c] !== DESERT) || owner[c] || aiOf[c]) continue;
    if (centers.some(q => (q.x - x) ** 2 + (q.y - y) ** 2 < A.minDist ** 2)) continue;
    const rad = A.radius[0] + r() * (A.radius[1] - A.radius[0]), R = Math.ceil(rad), lm = landmass[c];
    const tiles = [];
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      if (dx * dx + dy * dy > rad * rad || !inb(x + dx, y + dy)) continue;
      const i = idx(x + dx, y + dy);
      if (isLand(i) && !owner[i] && !aiOf[i] && landmass[i] === lm) tiles.push(i);
    }
    if (tiles.length < 60) continue;
    const k = game.nations.length, col = NATION_COLORS[k % NATION_COLORS.length];
    game.nations.push({ id: k, ...nationName(k), col, hex: `rgb(${col.join(',')})`, people: 0, cap: 0, tiles: 0,
      lx: x + 0.5, ly: y + 0.5, alive: true, growth: 0, ...newMind(k, r) });
    for (const i of tiles) aiOf[i] = k + 1;
    // their settlements: one at the centre, more (spread as far apart as they'll go) in bigger nations
    const spots = tiles.filter(i => depositOf[i] < 0 && (biome[i] === GRASS || biome[i] === DESERT));
    const d2c = (i, px, py) => (i % W - px) ** 2 + (((i / W) | 0) - py) ** 2;
    const towns = [spots.reduce((a, b) => (d2c(a, x, y) <= d2c(b, x, y) ? a : b))];
    const want = clamp(Math.round(tiles.length / A.tilesPerSettlement), 1, 3);
    while (towns.length < want) {
      const far = i => Math.min(...towns.map(t => d2c(i, t % W, (t / W) | 0)));
      towns.push(spots.reduce((a, b) => (far(a) >= far(b) ? a : b)));
    }
    for (const i of towns) if (!building[i]) placeBuilding(i, 'settlement');
    const seen = new Set();
    for (const i of tiles) {
      const d = depositOf[i];
      if (d < 0 || seen.has(d) || building[i] || deposits[d].type === 'oil' || deposits[d].type === 'uranium') continue;
      seen.add(d);
      placeBuilding(i, deposits[d].type === 'forest' ? 'cabin' : 'camp');
    }
    centers.push({ x, y });
  }
  scanNationTiles();
  buildFronts();
  recomputeBuildings();
  for (const n of game.nations) n.people = Math.round(n.cap * (A.fill[0] + r() * (A.fill[1] - A.fill[0])));
  for (let i = 0; i < N; i++) if (aiOf[i]) paintTerr(i);
}
function scanNationTiles() {
  for (const n of game.nations) { n.tiles = 0; n.sx = 0; n.sy = 0; }
  for (let i = 0; i < N; i++) {
    if (!aiOf[i]) continue;
    const n = game.nations[aiOf[i] - 1];
    n.tiles++; n.sx += i % W; n.sy += (i / W) | 0;
  }
}
function recomputeNations() {
  for (const n of game.nations) n.cap = 0;
  for (const b of game.buildings) if (b.type === 'settlement' && aiOf[b.i]) game.nations[aiOf[b.i] - 1].cap += b.base || 0;
  for (const n of game.nations) n.ironCap = CFG.storage.iron.base + CFG.storage.iron.perCap * n.cap;
  for (const n of game.nations) {
    if (n.tiles) { n.lx = n.sx / n.tiles + 0.5; n.ly = n.sy / n.tiles + 0.5; }
    n.people = Math.min(n.people, n.cap);          // lost land or settlements: the people who lived there are gone
    if (n.alive && !n.tiles) { n.alive = false; n.people = 0; toast(`You conquered ${n.full}!`); }
  }
}
const nationAt = i => (aiOf[i] ? game.nations[aiOf[i] - 1] : null);

// ---------- AI nations, v2: they claim land, found settlements, arm themselves and guard their borders ----------
const freeLand = i => isLand(i) && !owner[i] && !aiOf[i];
// each nation's front: the free land touching its border (entries are re-checked when used, so stale ones are harmless)
function buildFronts() {
  for (const n of game.nations) { n.front = new Set(); n.warFront = new Set(); }   // warFront: your tiles touching its border
  for (let i = 0; i < N; i++) {
    if (!aiOf[i]) continue;
    const x = i % W, y = (i / W) | 0, f = game.nations[aiOf[i] - 1].front;
    for (const [dx, dy] of DIRS4) {
      if (!inb(x + dx, y + dy)) continue;
      const nb = idx(x + dx, y + dy);
      if (freeLand(nb)) f.add(nb); else if (owner[nb]) game.nations[aiOf[i] - 1].warFront.add(nb);
    }
  }
}
function aiClaim(n, i) {
  const x = i % W, y = (i / W) | 0;
  aiOf[i] = n.id + 1; n.tiles++; n.sx += x; n.sy += y;
  n.front.delete(i);
  paintTerr(i);
  for (const [dx, dy] of DIRS4) {
    if (!inb(x + dx, y + dy)) continue;
    const nb = idx(x + dx, y + dy);
    if (aiOf[nb]) paintTerr(nb); else if (freeLand(nb)) n.front.add(nb); else if (owner[nb]) n.warFront.add(nb);
  }
  game.landDirty = true;
}
// what one of your tiles costs a nation, beyond the land itself: the more crowded your country, the harder it fights
// a nation takes one of your tiles: the land, and anything built on it, is now theirs
function aiTake(n, i) {
  const x = i % W, y = (i / W) | 0, c = countryAt(i);
  loseSettlement(i);                               // a captured settlement's people are theirs now
  const lost = buildingAt(i);
  if (lost && underway(lost)) removeBuilding(i);   // a half-built site is simply lost
  else if (lost) { if (lost.site) lost.site = null; if (lost.units) { lost.units = 0; lost.incoming = 0; } }   // an upgrade in progress stops   // a captured garrison's troops are gone
  // Recounting every country means scanning the whole map, so only ask for it when this tile could have
  // been holding two parts of your land together (or was the country's last). Otherwise just subtract it.
  const own = (dx, dy) => inb(x + dx, y + dy) && owner[idx(x + dx, y + dy)] ? 1 : 0;
  const N4 = own(0, -1), E4 = own(1, 0), S4 = own(0, 1), W4 = own(-1, 0);
  let parts = N4 + E4 + S4 + W4;
  if (N4 && E4 && own(1, -1)) parts--;
  if (E4 && S4 && own(1, 1)) parts--;
  if (S4 && W4 && own(-1, 1)) parts--;
  if (W4 && N4 && own(-1, -1)) parts--;
  if (c) {
    c.tiles--; c.sx -= x; c.sy -= y;
    if (c.tiles) { c.lx = c.sx / c.tiles + 0.5; c.ly = c.sy / c.tiles + 0.5; }
    if (biome[i] === MOUNTAIN) c.geo.mtn--; else if (biome[i] === DESERT) c.geo.desert--;
    if (isCoastal(i)) c.geo.coast--;
  }
  if (!c || !c.tiles || parts > 1) game.netDirty = true;
  owner[i] = 0; countryOf[i] = -1; game.ownedCount--;
  aiOf[i] = n.id + 1; n.tiles++; n.sx += x; n.sy += y;
  n.warFront.delete(i);
  paintTerr(i);
  for (const [dx, dy] of DIRS4) {
    if (!inb(x + dx, y + dy)) continue;
    const nb = idx(x + dx, y + dy);
    if (owner[nb]) { paintTerr(nb); n.warFront.add(nb); frontier.add(i); }   // still next to your land: you can push back in
    else if (aiOf[nb]) paintTerr(nb);
    else if (freeLand(nb)) n.front.add(nb);
  }
  game.landDirty = game.bldDirty = true;           // your settlements here hold less now, or are theirs
}
// a clear tile of this nation's within `rad` of a point (or -1)
function aiSpot(n, px, py, rad, rnd = Math.random) {
  for (let k = 0; k < 40; k++) {
    const x = Math.round(px + (rnd() - 0.5) * 2 * rad), y = Math.round(py + (rnd() - 0.5) * 2 * rad);
    if (!inb(x, y)) continue;
    const i = idx(x, y);
    if (aiOf[i] === n.id + 1 && !building[i] && depositOf[i] < 0) return i;
  }
  return -1;
}
// attacking a nation (taking its land, shelling it) puts it at war with you: from then on its silos fire too
function provoke(n) {
  if (!n || n.hostile || !n.alive) return;
  n.hostile = true;
  if (game.started) toast(`${n.full} is now at war with you: its missile silos will fire on your buildings.`);
}
// a nation's own research: it leans toward the kind of tech its personality likes
function aiResearch(n, dt) {
  if (!n.rcur) n.rcur = pickTech(n.R, t => (t.tags.includes(n.pers.prefer) ? 0.6 : 0.2) + Math.random() * 0.15);
  if (!n.rcur) return;
  n.rpts += n.people * CFG.research.perPerson * CFG.research.aiMult * n.pers.research * dt;
  const cost = techCost(n.R);
  if (n.rpts >= cost) {
    n.rpts -= cost; n.R.add(n.rcur);
    if (['gunpowder', 'firearms', 'armor', 'rocketry'].includes(n.rcur) && touchesYou(n)) toast(`${n.full} has discovered ${TECH[n.rcur].name}.`);
    n.rcur = null;
  }
}
// most troops a nation keeps under arms, and how fast it trains them
const aiUnitCap = n => (20 + n.cap * n.pers.military * 0.25) * techFactor(n.R);
function aiTrain(n, dt) {
  const u = unitStats(n.R), cap = aiUnitCap(n);
  if (n.units >= cap || n.people < n.cap * 0.45) return;
  const k = Math.min(cap - n.units, 0.18 * techFactor(n.R) * dt * (0.5 + n.pers.military * 2));
  n.units += k; n.people -= k * u.type.people;
}
// your troops near a nation: all your garrisoned units, for an opportunist sizing you up
const yourStrength = () => totalUnits() * unitStats().power;
function aiThink(n) {
  if (!n.alive || !n.tiles) return;
  const A = CFG.ai, P = n.pers, mine = game.buildings.filter(b => aiOf[b.i] === n.id + 1);
  const count = t => mine.reduce((a, b) => a + (b.type === t ? 1 : 0), 0);
  // 1) arm: weapons it has the tech for, more as it grows; a turtle builds defenses first
  const towns = mine.filter(b => b.type === 'settlement');
  const base = towns.length ? towns[(Math.random() * towns.length) | 0].i : idx(Math.floor(n.lx), Math.floor(n.ly));
  const has = t => n.R.has(CFG.buildings[t].tech);
  const wants = [];
  if (has('base') && count('base') < 1 + Math.floor(n.tiles / 2500)) wants.push('base');
  if (has('fort') && count('fort') < Math.min(3, Math.floor(n.tiles / 900 * P.defense))) wants.push('fort');
  if (has('mortar') && count('mortar') < Math.min(A.maxMortars, 1 + Math.floor(n.tiles / A.tilesPerMortar))) wants.push('mortar');
  if (has('turret') && count('turret') < Math.min(A.maxTurrets, Math.floor(n.tiles / A.tilesPerTurret * P.defense))) wants.push('turret');
  if (has('airdef') && count('airdef') < Math.min(A.maxAirDefs, Math.floor(n.tiles / A.tilesPerAirDef * P.defense))) wants.push('airdef');
  if (has('silo') && count('silo') < Math.min(A.maxSilos, 1 + Math.floor(n.tiles / A.tilesPerSilo))) wants.push('silo');
  if (P.id === 'turtle') wants.sort((a, b) => (CFG.buildings[b].gun || CFG.buildings[b].defense || b === 'fort' ? 1 : 0) - (CFG.buildings[a].gun || CFG.buildings[a].defense || a === 'fort' ? 1 : 0));
  const want = wants[0];
  const price = want ? CFG.buildings[want].cost.iron || 0 : 0;      // nations only keep iron, so that's the part they pay
  if (want && (n.iron || 0) >= price) { const sp = aiSpot(n, base % W, (base / W) | 0, 6); if (sp >= 0) { placeBuilding(sp, want); n.iron -= price; game.bldDirty = true; } }
  // mine: a camp on any iron in its land that nobody works yet
  for (const d of deposits) {
    if (d.type !== 'iron' || !d.tiles.length || aiOf[d.tiles[0]] !== n.id + 1) continue;
    const t = d.tiles.find(q => aiOf[q] === n.id + 1 && !isHarvested(q) && !building[q]);
    if (t !== undefined) { placeBuilding(t, 'camp'); game.bldDirty = true; break; }
  }
  // 2) settle: a new settlement where a good patch of its land has none in reach
  const front = [...n.front];
  for (let k = 0; k < 6 && front.length; k++) {
    const f = front[(Math.random() * front.length) | 0], x = f % W, y = (f / W) | 0;
    let c = -1;
    for (const [dx, dy] of DIRS4) { const nb = idx(x + dx * 3, y + dy * 3); if (inb(x + dx * 3, y + dy * 3) && aiOf[nb] === n.id + 1) c = nb; }
    if (c < 0 || isServed(c) || building[c] || depositOf[c] >= 0) continue;
    if (settlementGain(c).gain >= A.settleGain) { placeBuilding(c, 'settlement'); game.bldDirty = true; break; }
  }
  // 3) expand: spend people on the free land nearest its centre, like a slow, steady push
  if (n.people >= n.cap * (P.id === 'expander' ? 0.6 : A.expandAt) && n.tiles < A.maxTiles && front.length) {
    let budget = n.people * P.expand, spent = 0;
    const cands = [];
    for (let k = 0; k < 50; k++) {
      const f = front[(Math.random() * front.length) | 0];
      if (!freeLand(f)) { n.front.delete(f); continue; }
      cands.push({ f, d: Math.hypot(f % W - n.lx, ((f / W) | 0) - n.ly) + Math.random() * 5 });
    }
    n.stuck = cands.length ? 0 : (n.stuck || 0) + 1;
    cands.sort((a, b) => a.d - b.d);
    for (const c of cands) {
      const cost = tileCost(c.f);
      if (!freeLand(c.f) || cost > budget - spent) continue;
      spent += cost; aiClaim(n, c.f);
    }
    n.people -= spent;
  } else if (!front.length) n.stuck = (n.stuck || 0) + 1;
  // 4) war. Every personality has its own reasons: boxed in, plain aggression, a weak neighbour, a tech lead.
  const touching = touchesYou(n);
  if (!n.hostile && touching) {
    let why = null;
    if ((n.stuck || 0) >= A.boxedThinks) why = 'has run out of room and declared war on you!';
    else if (Math.random() < P.aggression * 0.5) why = P.id === 'raider' ? 'is raiding your border!' : 'has turned on you: its troops are massing at your border.';
    else if (P.strikesWeak && n.units * unitStats(n.R).power > yourStrength() * 1.6 + 10 && Math.random() < 0.15) why = 'smells weakness and has declared war on you!';
    else if (P.id === 'scholar' && n.R.size >= game.research.done.size + 3 && Math.random() < 0.1) why = 'is sure its science gives it the edge, and has declared war!';
    if (why) { n.hostile = true; toast(`${n.full} (${P.name}) ${why}`); }
  }
  // at war: send a wave of troops into your land, aimed at your nearest settlement
  const ready = n.units >= Math.max(8, aiUnitCap(n) * 0.35);
  if (n.hostile && ready && game.time - (n.lastRaid ?? -99) >= P.raidEvery &&
      !game.raids.some(r => r.n === n.id) && touching) {
    let tgt = n.warFront.values().next().value, bd = Infinity;
    for (const b of game.buildings) {
      if (!owner[b.i]) continue;
      const d = tileDist(b.i, n.lx, n.ly) - (b.type === 'settlement' ? 15 : 0);
      if (d < bd) { bd = d; tgt = b.i; }
    }
    const budget = Math.floor(n.units * P.raidShare);
    if (budget >= 3) {
      n.units -= budget; n.lastRaid = game.time;
      game.raids.push({ n: n.id, budget, start: budget, work: 0, tx: tgt % W + 0.5, ty: ((tgt / W) | 0) + 0.5, lx: null, ly: null });
      toast(`${n.full} sends ${budget} ${unitStats(n.R).type.name} into your land! Your fortresses defend.`);
    }
  }
  // peace: a nation that has been beaten back and hasn't attacked in a long while may calm down
  if (n.hostile && !game.raids.some(r => r.n === n.id) && n.units < aiUnitCap(n) * 0.15 && game.time - (n.lastRaid ?? 0) > 180 && Math.random() < 0.02 && P.id !== 'warlord') {
    n.hostile = false; toast(`${n.full} has stopped fighting you, for now.`);
  }
}
// does this nation's border touch your land right now? (drops stale entries as it looks)
function touchesYou(n) {
  for (const f of n.warFront) {
    const x = f % W, y = (f / W) | 0;
    if (owner[f]) for (const [dx, dy] of DIRS4) if (inb(x + dx, y + dy) && aiOf[idx(x + dx, y + dy)] === n.id + 1) return true;
    n.warFront.delete(f);
  }
  return false;
}
// your troops defending a domain: they come out of its fortresses first, then its bases
function defenders(C) {
  return garrisons().filter(b => countryAt(b.i) === C && (b.units || 0) > 0).sort((p, q) => (p.type === 'fort' ? 0 : 1) - (q.type === 'fort' ? 0 : 1));
}
function takeDefenders(list, k) {
  for (const b of list) { const t = Math.min(b.units, k); b.units -= t; k -= t; if (k <= 0) break; }
}
// one wave of a nation's troops. It fights the troops in your domain's fortresses and bases, and takes the
// tiles of yours nearest its target as it wins. Your people defend their homes a little too.
function stepRaid(r, dt) {
  const n = game.nations[r.n], A = CFG.ai, M = CFG.military;
  if (!n.alive) { r.done = true; return; }
  const cands = [];
  for (const f of n.warFront) {
    const x = f % W, y = (f / W) | 0;
    let touching = false;
    if (owner[f]) for (const [dx, dy] of DIRS4) if (inb(x + dx, y + dy) && aiOf[idx(x + dx, y + dy)] === n.id + 1) touching = true;
    if (!touching) { n.warFront.delete(f); continue; }
    cands.push({ f, C: countryAt(f), d: Math.hypot(x - r.tx, y - r.ty) + Math.random() * 3 });
  }
  cands.sort((a, b) => a.d - b.d);
  if (!cands.length) { r.done = true; n.units += r.budget; return; }
  if (r.lx == null) { r.lx = cands[0].f % W + 0.5; r.ly = ((cands[0].f / W) | 0) + 0.5; }
  const C = cands[0].C, us = unitStats(), them = nationStats(n);
  const def = C ? defenders(C) : [], have = def.reduce((a, b) => a + b.units, 0);
  const eng = Math.min(r.budget, have, 25 + r.budget * 0.5);
  if (have >= 0.5) {                               // your garrison comes out to meet them
    const k = M.kill * dt * eng;
    const ourKill = Math.min(r.budget, k * us.atk * 1.15 * Math.max(1, defenseMult(cands[0].f) * 0.8) / them.hp);   // defenders fight harder from forts and walls
    const theirKill = Math.min(have, k * them.atk / us.hp);
    r.budget -= ourKill; takeDefenders(def, theirKill);
    r.killed = (r.killed || 0) + ourKill; r.lost = (r.lost || 0) + theirKill;
  }
  const odds = r.budget / (r.budget + (have >= 0.5 ? eng * 1.15 : 0) + 1e-6);
  r.work += (1.5 + 1.2 * Math.sqrt(Math.max(0, r.budget))) * odds * A.raidSpeed * 2 * dt;
  for (const c of cands) {
    if (r.work < 1 || r.budget < 0.5) break;
    const w = tileCost(c.f) / CFG.tileCost.grass * defenseMult(c.f);   // forts and walls make your land harder to take
    if (w > r.work) break;
    r.work -= w;
    const militia = c.C ? 0.15 * c.C.people / Math.max(1, c.C.tiles) : 0;    // your people fight for their homes
    r.budget -= militia / them.hp;
    if (c.C) c.C.people = Math.max(0, c.C.people - militia * A.killShare);
    aiTake(n, c.f);
    r.lx = c.f % W + 0.5; r.ly = ((c.f / W) | 0) + 0.5;
  }
  if (r.budget < 0.5) {
    r.done = true; r.budget = 0;
    toast(`${n.full}'s attack was beaten back: ${Math.round(r.killed || 0)} of theirs fell, you lost ${Math.round(r.lost || 0)}.`);
  }
}
// their weapons: mortars shoot at anything of yours in range; silos join in once the nation is at war with you
function aiFire() {
  const A = CFG.ai;
  let yours = null;
  for (const b of game.buildings) {
    const k = aiOf[b.i], def = CFG.buildings[b.type];
    if (!k || !def.weapon || (b.ready || 0) > game.time) continue;
    const n = game.nations[k - 1], Wp = CFG.weapons[def.weapon];
    if (!n.alive || !n.hostile) continue;
    if ((n.iron || 0) < (Wp.cost.iron || 0)) continue;              // can't afford the shot: same price as yours
    const bx = b.i % W + 0.5, by = ((b.i / W) | 0) + 0.5;
    let tgt = null, bd = Wp.range;
    for (const e of game.expeditions) { const d = Math.hypot(e.x - bx, e.y - by); if (!e.done && d < bd) { bd = d; tgt = [e.x, e.y]; } }
    if (!tgt) {
      yours = yours || game.buildings.filter(q => owner[q.i]);
      for (const q of yours) { const d = tileDist(q.i, bx, by); if (d < bd && !isRuin(q)) { bd = d; tgt = tileCenter(q.i); } }
    }
    if (!tgt) continue;
    launchShot(b, tgt[0], tgt[1], def.weapon, n);
    n.iron -= Wp.cost.iron || 0;
    b.rd = Wp.reload * A.reloadMult[def.weapon]; b.ready = game.time + b.rd;
    if (!n.warned) { n.warned = true; toast(`${n.full} is firing on you! Keep out of range of its mortars, or knock them out.`); }
  }
}
// extra people it costs to take one tile of a nation's land: the more crowded they are, the harder they fight
const defenseAt = i => {
  const n = nationAt(i);
  return n ? Math.round(n.units || 0) : 0;
};

const depBox = () => ({ forest: 0, stone: 0, iron: 0, gold: 0, oil: 0, wheat: 0, uranium: 0 });
const resBox = () => ({ wood: 0, stone: 0, iron: 0, oil: 0, wheat: 0, uranium: 0 });
const newPower = () => ({ burners: 0, solar: 0, oilplants: 0, reactors: 0, need: 0, capPow: 0, workers: 0, fields: 0,
  rigDep: depBox(), colDep: depBox() });
// people not working a collector: only they can be sent on pushes and expeditions
const freePeople = c => Math.max(0, c.people - c.pw.workers);
function newCountry({ people = 0, res = {} } = {}) {
  const id = game.countries.length;
  const c = { id, ...countryName(id), people, cap: 0, growth: 0, tier: 0, geo: { coast: 0, mtn: 0, desert: 0, port: 0 }, sx: 0, sy: 0,
    box: [Infinity, Infinity, -Infinity, -Infinity],
    res: { ...resBox(), ...res }, rates: resBox(), prod: resBox(),
    ownedDep: depBox(), tiles: 0, lx: 0, ly: 0, alive: true, mergedInto: -1,
    capBase: 0, capPow: 0, sat: 1, pw: newPower(), mw: { gen: 0, max: 0, need: 0, burn: 0 } };
  game.countries.push(c);
  return c;
}
function liveCountry(id) {                       // follows merges to the country that exists now
  let c = game.countries[id];
  while (c && !c.alive && c.mergedInto >= 0) c = game.countries[c.mergedInto];
  return c && c.alive ? c : null;
}
const countryAt = i => (owner[i] ? liveCountry(countryOf[i]) : null);
const activeCountry = () => liveCountry(game.active) || liveCountry(0) || game.countries.find(c => c.alive);

function mergeCountry(from, into) {
  into.people += from.people;
  for (const b of game.buildings) if (b.site && b.site.country === from.id) b.site.country = into.id;
  for (const r in from.res) into.res[r] += from.res[r];
  from.alive = false; from.mergedInto = into.id; from.people = 0;
  if (game.active === from.id) game.active = into.id;
  toast(`${from.short} has merged into ${into.full}`);
}

function recomputeNetwork() {
  // 1) find the separate pieces of territory
  comp.fill(-1);
  let nc = 0;
  const stack = [];
  for (let s0 = 0; s0 < N; s0++) {
    if (!owner[s0] || comp[s0] >= 0) continue;
    comp[s0] = nc; stack.push(s0);
    while (stack.length) {
      const i = stack.pop(), x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of DIRS4) {
        const nx = x + dx, ny = y + dy;
        if (!inb(nx, ny)) continue;
        const n = idx(nx, ny);
        if (owner[n] && comp[n] < 0) { comp[n] = nc; stack.push(n); }
      }
    }
    nc++;
  }
  // 2) each piece is one country: whichever owns most of it. Countries that now share a piece merge.
  const tally = Array.from({ length: nc }, () => new Map());
  for (let i = 0; i < N; i++) {
    if (!owner[i]) continue;
    const c = liveCountry(countryOf[i]), k = c ? c.id : -1, m = tally[comp[i]];
    m.set(k, (m.get(k) || 0) + 1);
  }
  const pieceCountry = new Int32Array(nc);
  for (let pc = 0; pc < nc; pc++) {
    let best = -1, bestN = -1;
    for (const [k, n] of tally[pc]) if (k >= 0 && (n > bestN || (k === 0 && n === bestN))) { best = k; bestN = n; }
    if (best < 0) best = newCountry().id;
    for (const [k] of tally[pc]) if (k >= 0 && k !== best && game.countries[k].alive) mergeCountry(game.countries[k], game.countries[best]);
    pieceCountry[pc] = best;
  }
  // 3) relabel tiles and recount every country
  for (const c of game.countries) resetTileStats(c);
  for (let i = 0; i < N; i++) {
    if (!owner[i]) continue;
    const c = game.countries[pieceCountry[comp[i]]];
    countryOf[i] = c.id;
    addTileStats(c, i);
  }
  game.netDirty = false;
  if (game.started) for (const c of game.countries) {
    if (!c.alive || c.tiles) continue;               // every tile of it was taken
    c.alive = false; c.people = 0;
    toast(`${c.full} has fallen!`);
  }
  if (game.started && !game.over && !game.countries.some(c => c.alive)) {
    game.over = true; game.driving = null; game.aiming = false;
    $('toast').classList.add('show'); clearTimeout(toastTimer);
    $('toast').textContent = `Your last country has fallen. ${say('Press N', 'Tap New map in the Build menu')} to start a new map.`;
  }
  recomputeBuildings();
}

// everything that depends on buildings (housing, power, workers, collectors, titles, nation housing).
// Only loops the buildings and deposits, so it's cheap enough to run whenever something changes.
// ======================================================================
// roads and walls
// Roads join the settlements of each domain (and of each nation) by themselves. A road is found with A*
// over the land: it bends around hills and water, keeps to its owner's land and follows roads already
// there. Then it's straightened wherever it can see ahead and rounded at the bends, so it winds the way
// a real one does. Your other buildings join the network when you connect them; walls join two forts.
// Everything that travels (haulers, troops) picks the quickest mix of road and open country.
// ======================================================================
const NET = new Uint8Array(N);                     // bit 1: a road of yours on this tile, bit 2: one of your walls
const DEFM = new Uint8Array(N);                    // your walls and forts: how much harder this tile is to take (x10)
let roads = [], roadsDirty = true, roadsAt = -9, graphNet = null;
// ---------- A* over tiles (8 directions), with a cost for stepping onto each tile ----------
const AS_G = new Float32Array(N), AS_STAMP = new Int32Array(N), AS_FROM = new Int32Array(N);
let asRun = 0;
const D8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
function tilePath(a, b, cost, maxExp = 30000) {
  asRun++;
  const bx = b % W, by = (b / W) | 0;
  const heapI = [], heapF = [];
  const push = (i, f) => {
    let k = heapI.length; heapI.push(i); heapF.push(f);
    while (k > 0) { const p = (k - 1) >> 1; if (heapF[p] <= f) break; heapI[k] = heapI[p]; heapF[k] = heapF[p]; k = p; }
    heapI[k] = i; heapF[k] = f;
  };
  const pop = () => {
    const top = heapI[0], li = heapI.pop(), lf = heapF.pop();
    if (heapI.length) {
      let k = 0;
      for (;;) {
        let c = 2 * k + 1;
        if (c >= heapI.length) break;
        if (c + 1 < heapI.length && heapF[c + 1] < heapF[c]) c++;
        if (heapF[c] >= lf) break;
        heapI[k] = heapI[c]; heapF[k] = heapF[c]; k = c;
      }
      heapI[k] = li; heapF[k] = lf;
    }
    return top;
  };
  AS_STAMP[a] = asRun; AS_G[a] = 0; AS_FROM[a] = -1;
  push(a, Math.hypot(a % W - bx, ((a / W) | 0) - by));
  let exp = 0;
  while (heapI.length && exp++ < maxExp) {
    const i = pop();
    if (i === b) break;
    const x = i % W, y = (i / W) | 0, g = AS_G[i];
    for (const [dx, dy, d] of D8) {
      const nx = x + dx, ny = y + dy;
      if (!inb(nx, ny)) continue;
      const n = idx(nx, ny), c = n === b ? 1 : cost(n);
      if (c === Infinity) continue;
      if (dx && dy && (cost(idx(x + dx, y)) === Infinity || cost(idx(x, y + dy)) === Infinity)) continue;   // no squeezing past corners
      const ng = g + d * c;
      if (AS_STAMP[n] === asRun && AS_G[n] <= ng) continue;
      AS_STAMP[n] = asRun; AS_G[n] = ng; AS_FROM[n] = i;
      push(n, ng + Math.hypot(nx - bx, ny - by));
    }
  }
  if (AS_STAMP[b] !== asRun) return null;
  const out = [];
  for (let i = b; i >= 0; i = AS_FROM[i]) out.push(i);
  return out.reverse();
}
// the cost of a road (or wall) crossing a tile of `side`'s land
const netCost = (side, follow) => i => {
  if (!isLand(i) || sideOf(i) !== side) return Infinity;
  let c = biome[i] === MOUNTAIN ? 6 : biome[i] === DESERT ? 1.3 : 1;
  if (follow && (NET[i] & 1)) c *= 0.45;           // join the roads already there rather than run beside them
  else if (building[i]) c *= 4;
  return c;
};
// tiles -> a smooth line: straighten wherever the way ahead is clear, round the bends, then space the points evenly
function smoothLine(tiles, ok) {
  const P = tiles.map(t => [t % W + 0.5, ((t / W) | 0) + 0.5]);
  const clear = (p, q) => {
    const n = Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) * 2);
    for (let k = 1; k < n; k++) { const x = p[0] + (q[0] - p[0]) * k / n, y = p[1] + (q[1] - p[1]) * k / n; if (!ok(idx(Math.floor(x), Math.floor(y)))) return false; }
    return true;
  };
  const key = [P[0]];
  for (let i = 0; i < P.length - 1;) {
    let j = Math.min(P.length - 1, i + 24);
    while (j > i + 1 && !clear(P[i], P[j])) j--;
    key.push(P[j]); i = j;
  }
  let pts = key;
  for (let it = 0; it < 2; it++) {                 // Chaikin: cut every corner, twice
    if (pts.length < 3) break;
    const q = [pts[0]];
    for (let k = 0; k < pts.length - 1; k++) {
      const [x0, y0] = pts[k], [x1, y1] = pts[k + 1];
      q.push([x0 * 0.75 + x1 * 0.25, y0 * 0.75 + y1 * 0.25], [x0 * 0.25 + x1 * 0.75, y0 * 0.25 + y1 * 0.75]);
    }
    q.push(pts[pts.length - 1]); pts = q;
  }
  const out = [pts[0]], cum = [0];
  for (let k = 1; k < pts.length; k++) {           // a point every half tile
    const [x0, y0] = pts[k - 1], [x1, y1] = pts[k], d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(d * 2));
    for (let s = 1; s <= n; s++) { const p = [x0 + (x1 - x0) * s / n, y0 + (y1 - y0) * s / n]; cum.push(cum[cum.length - 1] + d / n); out.push(p); }
  }
  const tl = [];
  for (const p of out) { const t = idx(Math.floor(p[0]), Math.floor(p[1])); if (tl[tl.length - 1] !== t) tl.push(t); }
  return { pts: out, cum, len: cum[cum.length - 1], tiles: tl };
}
function makeLine(a, b, side, follow, maxExp) {
  const path = tilePath(a, b, netCost(side, follow), maxExp);
  if (!path) return null;
  const cost = netCost(side, false);
  return smoothLine(path, i => cost(i) <= 1.5 || i === a || i === b);
}
// Roads: each settlement to its nearest neighbours of the same side (a domain of yours, or a nation), within reach.
// A road that's still all on its side's land is kept as it was; only new or broken ones are worked out again.
function buildRoads() {
  const old = new Map(roads.map(r => [r.key, r]));
  const S = game.buildings.filter(b => b.type === 'settlement' && sideOf(b.i) && !underway(b));
  const bySide = new Map();
  for (const b of S) { const sd = sideOf(b.i); if (!bySide.has(sd)) bySide.set(sd, []); bySide.get(sd).push(b); }
  const next = [], RC = CFG.roads;
  let budget = 40;                                 // new roads worked out per pass, so a big change can't stall a frame
  for (const [side, list] of bySide) {
    // a minimum spanning tree (every settlement joined) plus a second link where it's short
    const pos = list.map(b => [b.i % W, (b.i / W) | 0]);
    const pairs = [];
    for (let k = 0; k < list.length; k++) for (let j = k + 1; j < list.length; j++) {
      const d = Math.hypot(pos[k][0] - pos[j][0], pos[k][1] - pos[j][1]);
      if (d <= RC.max) pairs.push([d, k, j]);
    }
    pairs.sort((p, q) => p[0] - q[0]);
    const root = list.map((_, k) => k), find = k => (root[k] === k ? k : (root[k] = find(root[k])));
    const deg = list.map(() => 0), chosen = [];
    for (const [d, k, j] of pairs) {
      if (find(k) !== find(j)) { root[find(k)] = find(j); chosen.push([k, j]); deg[k]++; deg[j]++; }
      else if (deg[k] < RC.links && deg[j] < RC.links && d < RC.max * 0.6) { chosen.push([k, j]); deg[k]++; deg[j]++; }
    }
    for (const [k, j] of chosen) {
      const a = list[k].i, b = list[j].i, key = Math.min(a, b) + ':' + Math.max(a, b);
      const was = old.get(key);
      if (was && was.side === side && was.tiles.every(t => sideOf(t) === side || building[t])) { next.push(was); continue; }
      if (budget-- <= 0) { roadsDirty = true; if (was) next.push(was); continue; }
      const L = makeLine(a, b, side, side > 0, 12000);
      if (L) next.push({ ...L, key, side, kind: 'road', a, b });
    }
  }
  roads = next;
  if (budget > 0) roadsDirty = false;
  roadsAt = game.time;
  markNet();
}
// your road and wall tiles, how hard your tiles are to take, and the network graph troops and haulers route over
function markNet() {
  NET.fill(0);
  for (const r of roads) if (r.side > 0) for (const t of r.tiles) NET[t] |= 1;
  game.connects = game.connects.filter(c => building[c.a] && owner[c.a]);
  for (const c of game.connects) for (const t of c.tiles) if (owner[t]) NET[t] |= 1;
  game.walls = game.walls.filter(w => building[w.a] === BLD_CODE.fort && building[w.b] === BLD_CODE.fort && owner[w.a] && owner[w.b]);
  for (const w of game.walls) for (const t of w.tiles) if (owner[t]) NET[t] |= 2;
  graphNet = null;
  markDefense();
}
function markDefense() {
  DEFM.fill(0);
  const WC = CFG.walls;
  for (const b of game.buildings) {
    if (b.type !== 'fort' || !owner[b.i] || underway(b)) continue;
    eachInReach(b.i, t => { if (owner[t]) DEFM[t] = Math.max(DEFM[t], WC.fortDefense * 10); }, WC.fortReach);
  }
  for (const w of game.walls) for (const t of w.tiles) {
    eachInReach(t, u => { if (owner[u]) DEFM[u] = Math.max(DEFM[u], u === t ? WC.defense * 10 : 18); }, WC.near);
  }
}
const defenseMult = i => (DEFM[i] ? DEFM[i] / 10 : 1);
// the network as a graph: nodes where lines end or meet, edges along the lines between them
function netGraph() {
  if (graphNet) return graphNet;
  const lines = [...roads.filter(r => r.side > 0), ...game.connects.map(c => ({ ...c, kind: 'road' })), ...game.walls.map(w => ({ ...w, kind: 'wall' }))];
  const ends = new Set();
  for (const L of lines) { ends.add(L.tiles[0]); ends.add(L.tiles[L.tiles.length - 1]); }
  const nodes = new Map(), node = (t, p) => { if (!nodes.has(t)) nodes.set(t, { t, x: p[0], y: p[1], adj: [] }); return nodes.get(t); };
  for (const L of lines) {
    let k0 = 0;
    for (let k = 1; k < L.pts.length; k++) {
      const t = idx(Math.floor(L.pts[k][0]), Math.floor(L.pts[k][1]));
      if (k < L.pts.length - 1 && !ends.has(t)) continue;
      const A = node(idx(Math.floor(L.pts[k0][0]), Math.floor(L.pts[k0][1])), L.pts[k0]), B = node(t, L.pts[k]);
      if (A !== B) {
        const len = L.cum[k] - L.cum[k0];
        A.adj.push({ to: B, len, L, k0, k1: k, kind: L.kind }); B.adj.push({ to: A, len, L, k0: k, k1: k0, kind: L.kind });
      }
      k0 = k;
    }
  }
  graphNet = { nodes: [...nodes.values()], lines };
  return graphNet;
}
// The quickest way from (ax, ay) to (bx, by) for something that moves at prof.off off-road, prof.road on roads
// and prof.wall along walls (0: not allowed): straight across country, or across to a road, along the network,
// and across again at the far end. { pts, spd, len (seconds) }
function findRoute(ax, ay, bx, by, prof) {
  const direct = Math.hypot(bx - ax, by - ay) / prof.off;
  const G = netGraph();
  const plain = { pts: [[ax, ay], [bx, by]], spd: [prof.off], len: direct };
  if (!G.nodes.length || direct < 3) return plain;
  const near = (x, y) => G.nodes.map(n => [Math.hypot(n.x - x, n.y - y), n]).sort((p, q) => p[0] - q[0]).slice(0, 5);
  const dist = new Map(), prev = new Map(), done = new Set();
  for (const [d, n] of near(ax, ay)) { dist.set(n, d / prof.off); prev.set(n, null); }
  const exits = near(bx, by);
  for (let guard = 0; guard < 5000; guard++) {
    let u = null, ud = Infinity;
    for (const [n, d] of dist) if (!done.has(n) && d < ud) { ud = d; u = n; }
    if (!u) break;
    done.add(u);
    for (const e of u.adj) {
      const sp = e.kind === 'wall' ? prof.wall : prof.road;
      if (!sp) continue;
      const nd = ud + e.len / sp;
      if (nd < (dist.get(e.to) ?? Infinity)) { dist.set(e.to, nd); prev.set(e.to, { from: u, e }); }
    }
  }
  let best = null, bt = direct;
  for (const [d, n] of exits) { const t = (dist.get(n) ?? Infinity) + d / prof.off; if (t < bt) { bt = t; best = n; } }
  if (!best) return plain;
  const legs = [];
  for (let n = best; prev.get(n); n = prev.get(n).from) legs.push(prev.get(n).e);
  legs.reverse();
  let first = best;
  for (let n = best; prev.get(n); n = prev.get(n).from) first = prev.get(n).from;
  const pts = [[ax, ay], [first.x, first.y]], spd = [prof.off];
  for (const e of legs) {
    const st = e.k1 > e.k0 ? 2 : -2, sp = e.kind === 'wall' ? prof.wall : prof.road;
    for (let k = e.k0 + st; st > 0 ? k < e.k1 : k > e.k1; k += st) { pts.push(e.L.pts[k]); spd.push(sp); }
    pts.push(e.L.pts[e.k1]); spd.push(sp);
  }
  pts.push([bx, by]); spd.push(prof.off);
  return { pts, spd, len: bt };
}
// what each kind of vehicle is right now, by tech (and, for the ones that burn oil, fuel)
const roadTier = R => R.has('automobile') ? 'truck' : R.has('carriages') ? 'carriage' : R.has('horses') ? 'horse' : R.has('wheel') ? 'handcart' : 'porter';
const boatTier = R => R.has('steam') ? 'steamship' : R.has('shipbuilding') ? 'galleon' : R.has('sailing') ? 'sailboat' : 'rowboat';
// a hauler in domain C: how fast it goes on and off the road, and what it carries
function haulProf(C) {
  const st = linkStats('road', techIn(C));
  return { off: st.speed * CFG.roads.offRoad, road: st.speed, wall: 0, cargo: st.cargo };
}
// troops: on foot (or horse, or truck) off-road; faster on roads, and along walls
function troopProf() {
  const u = unitStats(), R = unitTech(), WC = CFG.walls;
  let wf = WC.speed;
  for (const [t, v] of Object.entries(WC.speedTech)) if (R.has(t)) wf = Math.max(wf, v);
  const road = Math.min(60, u.speed * CFG.roads.troopRoad);
  return { off: u.speed, road, wall: road * wf };
}
// ---------- drawing ----------
function roadLook(R) {                             // dirt track, stone road (Masonry), asphalt (Automobiles)
  if (R.has('automobile')) return { edge: 'rgba(20,22,26,0.7)', fill: 'rgba(70,74,80,0.95)', w: 0.34, dash: 'rgba(242,193,78,0.85)' };
  if (R.has('masonry')) return { edge: 'rgba(60,60,58,0.6)', fill: 'rgba(176,172,160,0.95)', w: 0.3, dash: null, cobble: true };
  return { edge: 'rgba(70,50,30,0.5)', fill: 'rgba(176,140,96,0.85)', w: 0.24, dash: null };
}
function traceLine(L) {
  const step = Math.max(1, Math.round(4 / Math.max(1, cam.zoom)));
  ctx.beginPath();
  for (let k = 0; k < L.pts.length; k += step) { const [sx, sy] = toScreen(L.pts[k][0], L.pts[k][1]); k ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }
  const [ex, ey] = toScreen(...L.pts[L.pts.length - 1]); ctx.lineTo(ex, ey);
}
function drawRoads(z) {
  if (z < 1) return;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const groups = new Map();
  const look = side => side > 0 ? roadLook(game.research.done) : roadLook(game.nations[-side - 1].R);
  for (const r of roads) { const k = r.side > 0 ? 'me' : 'n' + r.side; if (!groups.has(k)) groups.set(k, { L: look(r.side), lines: [] }); groups.get(k).lines.push(r); }
  if (game.connects.length) { if (!groups.has('me')) groups.set('me', { L: look(1), lines: [] }); groups.get('me').lines.push(...game.connects); }
  for (const { L, lines } of groups.values()) {
    const w = Math.max(1.4, z * L.w);
    for (const pass of [0, 1]) {
      for (const r of lines) { traceLine(r); ctx.strokeStyle = pass ? L.fill : L.edge; ctx.lineWidth = pass ? w : w + Math.max(1.4, z * 0.1); ctx.stroke(); }
    }
    if (L.dash && z >= 4) for (const r of lines) { traceLine(r); ctx.setLineDash([z * 0.35, z * 0.45]); ctx.lineWidth = Math.max(1, z * 0.04); ctx.strokeStyle = L.dash; ctx.stroke(); ctx.setLineDash([]); }
    if (L.cobble && z >= 6) for (const r of lines) { traceLine(r); ctx.setLineDash([z * 0.08, z * 0.14]); ctx.lineWidth = w * 0.55; ctx.strokeStyle = 'rgba(120,116,106,0.5)'; ctx.stroke(); ctx.setLineDash([]); }
  }
  // walls: thick stone, with battlements up close (concrete once you have Electricity)
  if (game.walls.length) {
    const concrete = game.research.done.has('electricity');
    for (const wl of game.walls) {
      traceLine(wl); ctx.strokeStyle = 'rgba(30,32,36,0.75)'; ctx.lineWidth = Math.max(3, z * 0.62); ctx.stroke();
      traceLine(wl); ctx.strokeStyle = concrete ? '#c8ccd0' : '#9aa1a8'; ctx.lineWidth = Math.max(2, z * 0.45); ctx.stroke();
      if (z >= 3) { traceLine(wl); ctx.setLineDash([z * 0.22, z * 0.22]); ctx.lineCap = 'butt'; ctx.strokeStyle = concrete ? '#e6e9ec' : '#c5cad0'; ctx.lineWidth = Math.max(1.2, z * 0.2); ctx.stroke(); ctx.setLineDash([]); ctx.lineCap = 'round'; }
    }
  }
  ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
  // the nations' roads have a little traffic of their own, to look lived in (yours carry real haulers)
  if (z < 2.5) return;
  for (const r of roads) {
    if (r.side > 0 || r.len < 4) continue;
    const u = (game.time * 3 / r.len + hash2(r.a % 9973, r.b % 9973, 81)) % 2, d = (u >= 1 ? 2 - u : u) * r.len;
    let k = 0;
    while (k < r.cum.length - 1 && r.cum[k] < d) k++;
    const [sx, sy] = toScreen(...r.pts[k]);
    if (sx < -20 || sy < -20 || sx > cw + 20 || sy > ch + 20) continue;
    const spr = roadTier(game.nations[-r.side - 1].R), size = Math.max(10, z * 1.0);
    ctx.save(); ctx.translate(sx, sy); if (u >= 1) ctx.scale(-1, 1);
    if (RAS[spr]) ctx.drawImage(RAS[spr][size * dpr > 44 ? 0 : 1], -size / 2, -size / 2, size, size);
    ctx.restore();
  }
}

// ---------- settlements: the land holds the capacity, a settlement unlocks what's in its reach ----------
const servStamp = new Int32Array(N), servD = new Uint16Array(N), servBy = new Int32Array(N);
let servN = 0;
const sideOf = i => (owner[i] ? countryOf[i] + 1 : -aiOf[i]);        // whose land a tile is: +country, -nation, 0 nobody
const landCapAt = i => CFG.landCap[BIOME_KEY[biome[i]]] || 0;
const isServed = i => servStamp[i] === servN;
function eachInReach(i, fn, R = CFG.settlement.reach) {             // every tile within R (a settlement's reach, by default) of tile i
  const cx = i % W, cy = (i / W) | 0;
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const d2 = dx * dx + dy * dy;
    if (d2 <= R * R && inb(cx + dx, cy + dy)) fn(idx(cx + dx, cy + dy), d2);
  }
}
// Each owned land tile goes to the nearest settlement of the same country (or nation) within reach;
// a settlement's `base` is the capacity of the land it ends up with.
function recomputeLand() {
  servN++;
  const S = game.buildings.filter(b => b.type === 'settlement');
  S.forEach((b, k) => {
    const side = sideOf(b.i);
    b.base = 0; b.tiles = 0; b._n = -1;
    if (side) eachInReach(b.i, (t, d2) => {
      if (sideOf(t) !== side || !isLand(t)) return;
      if (servStamp[t] !== servN || d2 < servD[t]) { servStamp[t] = servN; servD[t] = d2; servBy[t] = k; }
    });
  });
  S.forEach((b, k) => {
    if (sideOf(b.i)) eachInReach(b.i, t => { if (servStamp[t] === servN && servBy[t] === k) { b.base += landCapAt(t); b.tiles++; } });
    b.full = b.base;                                 // what it would hold undamaged
    if (b.dmg) b.base *= Math.max(0, 1 - b.dmg / hpOf(b));
  });
  game.landDirty = false;
  roadsDirty = true;
}
// what a settlement holds right now: the part above `powerAbove` only counts as far as its country has power
function settlementCap(b) {
  const T = CFG.settlement.powerAbove, base = b.base || 0;
  if (base <= T || !owner[b.i]) return base;
  const c = countryAt(b.i);
  return T + (base - T) * (c ? c.sat : 1);
}
function levelOfCap(cap) {
  const L = CFG.settlement.levels;
  let k = 0;
  while (k + 1 < L.length && cap >= L[k + 1].cap) k++;
  return k;
}
const settlementLevel = b => levelOfCap(settlementCap(b));
// hits a building can take; a settlement's toughness goes by the size it would be undamaged
const hpOf = b => (b.type === 'settlement' ? CFG.hp.settlement[levelOfCap(b.full ?? b.base ?? 0)] : CFG.hp.other);
// a settlement shelled down to nothing is a ruin: it stays on the map, houses nobody, and isn't worth another shell until it mends
const isRuin = b => b.type === 'settlement' && hpOf(b) - (b.dmg || 0) < 1;
// what a new settlement on tile i would add: the land in reach that nothing serves yet (and how much is already taken)
function settlementGain(i) {
  const side = sideOf(i);
  let gain = 0, fresh = 0, shared = 0;
  if (side) eachInReach(i, t => {
    if (sideOf(t) !== side || !isLand(t)) return;
    if (isServed(t)) shared++; else { fresh++; gain += landCapAt(t); }
  });
  return { gain, fresh, shared };
}

// ---------- collectors: each works the deposit tiles within its reach ----------
const HARVESTS = { cabin: ['forest'], camp: ['stone', 'iron', 'gold', 'uranium'], derrick: ['oil'], rig: ['forest', 'stone', 'iron', 'gold', 'oil', 'uranium'],
  farm: ['wheat'], farm2: ['wheat'], farm3: ['wheat'] };
const harvStamp = new Int32Array(N), harvD = new Uint16Array(N), harvBy = new Int32Array(N);
let harvN = 0;
const isHarvested = i => harvStamp[i] === harvN;
// can a collector of this type work tile t? `side` is whose land it stands on (see sideOf): yours or a nation's
const harvestable = (t, side, kinds) => hasDep(t) && sideOf(t) === side && kinds.includes(deposits[depositOf[t]].type);
// Every deposit tile goes to the nearest collector that can work it. For your countries the counts land in the
// country's totals (people-run and rig-run separately) and on the collector itself (b.work, for the hover text).
// Nations mine the same way; all that matters for them is how many iron tiles they work.
function recomputeHarvest() {
  harvN++;
  const R = CFG.collectorReach, list = game.buildings.filter(b => HARVESTS[b.type] && sideOf(b.i) && !underway(b));
  for (const n of game.nations) n.ironTiles = 0;
  list.forEach((b, k) => {
    const side = sideOf(b.i), kinds = HARVESTS[b.type];
    b.work = depBox();
    eachInReach(b.i, (t, d2) => {
      if (!harvestable(t, side, kinds)) return;
      if (harvStamp[t] !== harvN || d2 < harvD[t]) { harvStamp[t] = harvN; harvD[t] = d2; harvBy[t] = k; }
    }, R);
  });
  list.forEach((b, k) => {
    const mine = owner[b.i], pw = mine ? game.countries[countryOf[b.i]].pw : null, into = mine ? (b.type === 'rig' ? pw.rigDep : pw.colDep) : null;
    eachInReach(b.i, t => {
      if (harvStamp[t] !== harvN || harvBy[t] !== k || depositOf[t] < 0) return;
      const kind = deposits[depositOf[t]].type;
      b.work[kind]++;
      if (mine) { into[kind]++; if (kind === 'wheat') pw.fields += CFG.buildings[b.type].farm || 1; }
      else if (kind === 'iron') game.nations[aiOf[b.i] - 1].ironTiles++;
    }, R);
  });
}
// what a new collector of this type on tile i would work: tiles nobody works yet, by kind, and tiles already taken
function harvestGain(i, type) {
  const side = sideOf(i), kinds = HARVESTS[type], fresh = depBox();
  let shared = 0;
  if (side) eachInReach(i, t => {
    if (!harvestable(t, side, kinds)) return;
    if (isHarvested(t)) shared++; else fresh[deposits[depositOf[t]].type]++;
  }, CFG.collectorReach);
  return { fresh, shared };
}

function recomputeBuildings() {
  recomputeLand();
  for (const c of game.countries) { c.capBase = 0; c.ownedDep = depBox(); c.pw = newPower(); c.geo.port = 0; }
  for (const b of game.buildings) {
    if (!owner[b.i] || underway(b)) continue;      // an AI nation's building, or one still being built
    const def = CFG.buildings[b.type], c = game.countries[countryOf[b.i]];
    if (b.type === 'settlement') {
      const T = CFG.settlement.powerAbove;
      c.capBase += Math.min(b.base, T); c.pw.capPow += Math.max(0, b.base - T);
      if (b.base > T) c.pw.need += CFG.settlement.cityUse;
      const lvl = settlementLevel(b);              // tell the player when one grows up (not on the first look, and never twice)
      if (b.peak !== undefined && lvl > b.peak && game.started) {
        floatText(b.i % W + 0.5, ((b.i / W) | 0) - 1.5, `Now a ${CFG.settlement.levels[lvl].name}`, '#f2c14e');
      }
      b.peak = Math.max(b.peak ?? lvl, lvl);
    }
    if (def.use) c.pw.need += def.use;
    if (b.type === 'burner') c.pw.burners++;
    if (b.type === 'solar') c.pw.solar++;
    if (b.type === 'oilplant') c.pw.oilplants++;
    if (b.type === 'reactor') c.pw.reactors++;
    if (def.workers) c.pw.workers += def.workers;
    if (b.type === 'port') c.geo.port++;
  }
  recomputeHarvest();
  for (const c of game.countries) c.cap = c.capBase + c.pw.capPow * c.sat;
  for (const c of game.countries) if (c.alive && c.tiles) retitle(c, !game.started);
  for (const d of deposits) for (const t of d.tiles) if (owner[t] && depositOf[t] >= 0) game.countries[countryOf[t]].ownedDep[d.type]++;
  recomputeNations();
  game.bldDirty = false;
  roadsDirty = true;                               // settlements or land changed: the roads are checked again (at most once a second)
  markDefense();
}

// ======================================================================
// logistics: every domain keeps its own (hidden) stock. Links join domains: sea routes, rail and air
// (inside a domain, roads do the carrying). A vehicle shuttles along each link. It carries each end's share of the other's new output
// (as before), people moving toward room, and consignments: goods bound for a construction site somewhere,
// which board first. A consignment rides link after link until it reaches its domain. Troops use the links too.
// ======================================================================
const CARGO_RES = RESOURCES;
const emptyBox = resBox;
const boxSum = o => { let t = 0; for (const k in o) t += o[k] || 0; return t; };
const underway = b => !!(b.site && b.site.type === b.type);       // still being built (an upgrade keeps working meanwhile)
// what one vehicle on a link of this kind carries, and how fast, with your techs
function linkStats(kind, R = game.research.done) {
  const T = CFG.transport[kind], st = { cargo: T.cargo, people: T.people, speed: T.speed };
  for (const id of R) {
    const fx = CFG.techFx[id] && CFG.techFx[id][kind];
    if (fx) { st.cargo *= fx.cargo || 1; st.people *= fx.cargo || 1; st.speed *= fx.speed || 1; }
  }
  return st;
}
function unloadAt(L, C) {
  const cg = L.cargo;
  if (cg && C) {
    for (const r of CARGO_RES) C.res[r] += cg[r] || 0;
    C.people += cg.people || 0;
    for (const q of cg.req || []) deliver(q, C);
  }
  L.cargo = null; L.to = -1;
}
// a consignment has reached domain C: hand it to its site, or send it on toward its domain
function deliver(q, C) {
  const dest = liveCountry(q.dest);
  const dump = () => { for (const r in q.res) C.res[r] += q.res[r]; };
  if (!dest) return dump();
  if (dest === C) {
    const b = buildingAt(q.site);
    if (!b || !b.site) return dump();
    for (const r in q.res) {
      const give = Math.min(q.res[r], b.site.need[r] || 0);
      b.site.need[r] = (b.site.need[r] || 0) - give; C.res[r] += q.res[r] - give;
    }
    return;
  }
  const hop = routesTo(dest).get(C.id);
  if (!hop) return dump();                         // the way on is gone: it waits here, and the site asks again
  hop.L.req[hop.end].push(q);
}
// what share of `from`'s output goes to `to` over one link
function outputShare(from, to) {
  const m = CFG.minShare, pop = from.people + to.people;
  return clamp(pop > 0 ? to.people / pop : 0.5, m, 1 - m) / Math.max(1, from.nLinks);
}
function loadAt(L, src, dst, end) {
  L.cargo = null; L.to = -1;
  if (!src || !dst || src === dst) return;
  if (!L.req) L.req = { a: [], b: [] };
  const V = linkStats(L.kind, techIn(src)), cargo = { ...resBox(), people: 0, req: [] };
  let room = V.cargo;
  const waiting = L.req[end];                      // consignments first: they're what a site is waiting for
  while (waiting.length && room >= 1) {
    const q = waiting[0], tot = boxSum(q.res);
    if (tot <= room) { cargo.req.push(waiting.shift()); room -= tot; continue; }
    const k = room / tot, part = { dest: q.dest, site: q.site, res: {} };
    for (const r in q.res) { part.res[r] = q.res[r] * k; q.res[r] -= part.res[r]; }
    cargo.req.push(part); room = 0;
  }
  const box = L.out[end];                          // then the share of output waiting at this stop
  let total = 0;
  for (const r of CARGO_RES) total += Math.floor(box[r] || 0);
  const k = total > room ? room / total : 1;
  for (const r of CARGO_RES) { cargo[r] = Math.floor(Math.floor(box[r] || 0) * k); box[r] -= cargo[r]; }
  const full = c => (c.cap > 0 ? c.people / c.cap : 0);   // people in a domain with no settlement stay put
  if (full(src) > full(dst) + 0.05) {
    cargo.people = Math.floor(Math.min(V.people, Math.max(0, dst.cap - dst.people), freePeople(src) * 0.5));
    src.people -= cargo.people;
  }
  if (cargo.people + cargo.req.length + CARGO_RES.reduce((t, r) => t + cargo[r], 0) > 0) { L.cargo = cargo; L.to = dst.id; }
}
// goods (and people) on their way to a domain right now
function incomingTo(C) {
  const inc = { ...resBox(), people: 0 };
  for (const L of game.links) {
    if (L.cargo && liveCountry(L.to) === C) {
      for (const r in inc) inc[r] += L.cargo[r] || 0;
      for (const q of L.cargo.req || []) if (liveCountry(q.dest) === C) for (const r in q.res) inc[r] += q.res[r];
    }
    if (!L.out) continue;                          // plus what's waiting at the other end's stop for it
    const A = countryAt(L.a), B = countryAt(L.b);
    if (B === C && A !== C) for (const r of CARGO_RES) inc[r] += Math.floor(L.out.a[r] || 0);
    if (A === C && B !== C) for (const r of CARGO_RES) inc[r] += Math.floor(L.out.b[r] || 0);
  }
  return inc;
}
// the domains joined by links: for each domain, its links and who is at the other end
let graphCache = null, graphStamp = -1, graphVer = 0;
function linkGraph() {
  const stamp = game.time + ':' + graphVer;
  if (graphCache && graphStamp === stamp) return graphCache;
  const g = new Map(), add = (C, e) => { if (!g.has(C.id)) g.set(C.id, []); g.get(C.id).push(e); };
  for (const L of game.links) {
    const A = countryAt(L.a), B = countryAt(L.b);
    if (!A || !B || A === B) continue;
    add(A, { L, end: 'a', to: B }); add(B, { L, end: 'b', to: A });
  }
  graphCache = g; graphStamp = stamp;
  return g;
}
// every domain that can reach `to`, nearest (fewest links) first: the link it boards first and at which end.
// get(to.id) is null (you're there); get(id) is undefined when there's no way.
function routesTo(to) {
  const g = linkGraph(), hop = new Map([[to.id, null]]), q = [to];
  for (let h = 0; h < q.length; h++) {
    const C = q[h];
    for (const e of g.get(C.id) || []) {
      if (hop.has(e.to.id)) continue;
      hop.set(e.to.id, { L: e.L, end: e.end === 'a' ? 'b' : 'a', next: C });
      q.push(e.to);
    }
  }
  return hop;
}
// Every second: each construction site takes what its own domain has, then asks the nearest linked domains
// that can spare it (keeping what their own sites need) to send the rest. Nothing is sent twice.
function dispatchSupplies() {
  const sites = game.buildings.filter(b => b.site);
  if (!sites.length) return;
  const moving = new Map(), reserve = new Map();
  const count = q => { if (!moving.has(q.site)) moving.set(q.site, resBox()); const m = moving.get(q.site); for (const r in q.res) m[r] += q.res[r]; };
  for (const L of game.links) {
    if (L.req) for (const e of ['a', 'b']) for (const q of L.req[e]) count(q);
    if (L.cargo && L.cargo.req) for (const q of L.cargo.req) count(q);
  }
  for (const b of sites) {
    const C = liveCountry(b.site.country);
    if (!C) continue;
    if (!reserve.has(C.id)) reserve.set(C.id, resBox());
    for (const r in b.site.need) reserve.get(C.id)[r] += b.site.need[r];
  }
  for (const b of [...sites]) {
    const S = b.site, C = countryAt(b.i);
    if (!C) { cancelSite(b); continue; }           // the land it stood on was lost
    S.country = C.id;
    for (const r in S.need) { const take = Math.min(S.need[r], Math.max(0, C.res[r])); C.res[r] -= take; S.need[r] -= take; }
    if (boxSum(S.need) < 0.01) { if (!S.convoy) startDelivery(b); continue; }
    const routes = routesTo(C), mv = moving.get(b.i) || resBox();
    S.waiting = null;
    for (const r in S.need) {
      let want = S.need[r] - (mv[r] || 0);
      if (want < 0.05) continue;
      for (const [id, hop] of routes) {
        if (!hop) continue;
        const D = game.countries[id], keep = (reserve.get(id) || {})[r] || 0, spare = D.res[r] - keep;
        if (spare < 0.5) continue;
        const amt = Math.min(spare, want);
        D.res[r] -= amt; want -= amt;
        hop.L.req[hop.end].push({ dest: C.id, site: b.i, res: { [r]: amt } });
        if (want < 0.05) break;
      }
      if (want >= 0.05 && !(mv[r] > 0)) S.waiting = r;   // nobody linked to it has any: it waits for production
    }
  }
}
function finishSite(b) {
  const S = b.site;
  b.site = null;
  placeBuilding(b.i, S.type);
  planCache.key = null;
  afterBuilt(b.i, S.type, null);                   // a hub links to whatever other hubs stand now (some may have finished meanwhile)
  floatText(b.i % W + 0.5, ((b.i / W) | 0) - 1, `${CFG.buildings[S.type].name} finished`, '#7bd389');
  recomputeBuildings();
}
function cancelSite(b) {
  if (b.site.type === b.type) removeBuilding(b.i); else b.site = null;
}
// which of your countries is closest to a spot (measured to its border)
function nearestCountryTo(tx, ty) {
  let best = -1, bd = Infinity;
  for (const i of frontier) {
    const d = (i % W - tx) ** 2 + (((i / W) | 0) - ty) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  if (best >= 0) {
    const x = best % W, y = (best / W) | 0;
    for (const [dx, dy] of DIRS4) {
      const nx = x + dx, ny = y + dy;
      if (inb(nx, ny) && owner[idx(nx, ny)]) { const c = countryAt(idx(nx, ny)); if (c) return { country: c, tile: best }; }
    }
  }
  return { country: activeCountry(), tile: best >= 0 ? best : idx(spawn.x, spawn.y) };
}

// ======================================================================
// research: one tech at a time, faster the more people you have (gold you mine speeds it up too).
// The next tech is picked among the earliest ones open to you, leaning toward what your land produces.
// ======================================================================
const TECH = Object.fromEntries(CFG.techs.map((t, k) => [t.id, { ...t, k }]));
const isUnlocked = type => { const t = CFG.buildings[type].tech; return !t || game.research.done.has(t); };
const techCost = R => CFG.research.base * Math.pow(CFG.research.growth, R.size);
// what a tech does, in a few words: the buildings it opens, its effects, the unit it brings
function techSummary(id) {
  const parts = [];
  const blds = Object.values(CFG.buildings).filter(b => b.tech === id).map(b => b.name);
  if (blds.length) parts.push('Unlocks ' + blds.join(', '));
  const fx = CFG.techFx[id];
  if (fx && fx.note) parts.push(fx.note);
  const u = CFG.units.find(q => q.tech === id);
  if (u) parts.push(`Your bases now train ${u.name}`);
  return parts.join(' · ');
}
// how much a player leans on each resource: its output (and a little of its stock), as shares of the total
function resourceProfile() {
  const p = resBox();
  for (const c of game.countries) if (c.alive) for (const r in p) p[r] += (c.prod[r] || 0) + Math.max(0, c.res[r] || 0) * 0.002;
  const tot = boxSum(p) || 1;
  for (const r in p) p[r] /= tot;
  return p;
}
// The open techs are those whose requirements you know. Only the earliest era (and the one after it) are in
// reach, so progress follows history. Among those, the one using what you have most wins; a tech whose
// resources you don't have only goes first when nothing else makes sense.
function pickTech(R, score) {
  const open = CFG.techs.filter(t => !R.has(t.id) && t.req.every(q => R.has(q)));
  if (!open.length) return null;
  const minEra = Math.min(...open.map(t => t.era));
  let best = null, bs = -Infinity;
  for (const t of open) {
    if (t.era > minEra + 1) continue;
    const sc = score(t) - 0.3 * (t.era - minEra) - TECH[t.id].k * 0.001;
    if (sc > bs) { bs = sc; best = t; }
  }
  return best ? best.id : null;
}
function playerTechScore() {
  const P = resourceProfile();
  return t => Math.max(...t.uses.map(r => P[r] || 0));
}
// ---------- fuel: a domain with no oil can't use the techs that burn it ----------
// trucks fall back to carriages, steamships to sail (before Petroleum they burn wood), planes stay grounded
const FUEL_TECHS = ['automobile', 'armor'];
const techCache = new Map();
function techIn(C) {
  const R = game.research.done;
  if (!C) return R;
  const noShip = R.has('steam') && (R.has('petroleum') ? C.noOil : C.noWood);
  if (!C.noOil && !noShip) return R;
  const key = [...R].join(',') + (C.noOil ? '|o' : '') + (noShip ? '|s' : '');
  if (!techCache.has(key)) {
    const S = new Set(R);
    if (C.noOil) for (const t of FUEL_TECHS) S.delete(t);
    if (noShip) S.delete('steam');
    techCache.set(key, S);
  }
  return techCache.get(key);
}
// your army as a whole: motorized troops and tanks need oil somewhere in the empire
let empireOil = 1;
function unitTech() {
  const R = game.research.done;
  if (empireOil >= 0.5 || !FUEL_TECHS.some(t => R.has(t))) return R;
  const key = [...R].join(',') + '|units';
  if (!techCache.has(key)) { const S = new Set(R); for (const t of FUEL_TECHS) S.delete(t); techCache.set(key, S); }
  return techCache.get(key);
}
// gold isn't stored: the gold you mine each second boosts research, troop training and your troops' strength
function goldBoost(g = game.goldRate || 0) {
  const G = CFG.gold, r = Math.sqrt(Math.max(0, g));
  return { train: Math.min(G.trainMax, G.train * r), power: Math.min(G.powerMax, G.power * r), research: g * CFG.research.goldPts };
}
// troops: the newest kind your techs allow, and how strong, tough and fast they are (yours get the gold bonus)
function unitStats(R = unitTech()) {
  let hp = 1, atk = 1, speed = CFG.military.speed, type = CFG.units[0];
  for (const id of R) {
    const fx = CFG.techFx[id] && CFG.techFx[id].unit;
    if (fx) { hp *= fx.hp || 1; atk *= fx.atk || 1; speed *= fx.speed || 1; }
  }
  for (const u of CFG.units) if (!u.tech || R.has(u.tech)) type = u;
  const mine = R === game.research.done || R === unitTech();
  if (mine) { const g = goldBoost().power; hp *= 1 + g; atk *= 1 + g; }
  return { hp, atk, speed, type, power: hp * atk, helm: type.helm };
}
// bases and fortresses hold more, and bases train faster, the more you know
function techFactor(R) {
  let m = 1 + 0.05 * R.size;
  for (const id of R) m += (CFG.techFx[id] && CFG.techFx[id].capMult) || 0;
  return m;
}
const garrisonCap = b => Math.round((b.type === 'fort' ? CFG.military.fortCap : CFG.military.baseCap) * techFactor(game.research.done));
function researchTick(dt, gold) {
  const RS = game.research;
  if (!RS.cur) { RS.cur = pickTech(RS.done, playerTechScore()); if (!RS.cur) { RS.rate = 0; return; } }
  RS.rate = game.population * CFG.research.perPerson;
  RS.gold = goldBoost(gold).research;
  RS.pts += (RS.rate + RS.gold) * dt;
  const cost = techCost(RS.done);
  if (RS.pts >= cost) { RS.pts -= cost; completeTech(RS.cur); }
}
function completeTech(id, quiet = false) {
  const RS = game.research, t = TECH[id];
  RS.done.add(id); RS.cur = null;
  graphVer++;
  if (id === 'petroleum') { revealOil('oil'); game.bldDirty = true; }
  if (id === 'fission') { revealOil('uranium'); game.bldDirty = true; }
  if (quiet) return;
  notify(`🔬 ${t.name} discovered`, techSummary(id));
  RS.cur = pickTech(RS.done, playerTechScore());
  if (buildOpen) renderBuildMenu();
}
// research progress as a share of the current tech
const researchFrac = () => { const RS = game.research; return RS.cur ? clamp(RS.pts / techCost(RS.done), 0, 1) : 1; };

// ---------- route finding ----------
const gScore = new Float32Array(N), cameFrom = new Int32Array(N);
const seen = new Int32Array(N), closed = new Int32Array(N);
let stampN = 0;

// cheapest land route from a new station to the nearest existing one (A*, 8 directions)
function railPath(start, targets, maxLen = CFG.railMaxLength) {
  const st = ++stampN;
  const tset = new Set(targets);
  const tx = targets.map(t => t % W), ty = targets.map(t => (t / W) | 0);
  const h = i => {
    const x = i % W, y = (i / W) | 0;
    let m = Infinity;
    for (let k = 0; k < tx.length; k++) {
      const dx = Math.abs(x - tx[k]), dy = Math.abs(y - ty[k]);
      const d = Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
      if (d < m) m = d;
    }
    return m;
  };
  const heap = new MinHeap();
  seen[start] = st; gScore[start] = 0; cameFrom[start] = -1;
  heap.push(start, h(start));
  while (heap.size) {
    const cur = heap.pop();
    if (closed[cur] === st) continue;
    closed[cur] = st;
    if (cur !== start && tset.has(cur)) {
      const path = [];
      for (let p = cur; p !== -1; p = cameFrom[p]) path.push(p);
      return { path: path.reverse(), to: cur, weighted: gScore[cur] };
    }
    const g = gScore[cur];
    const x = cur % W, y = (cur / W) | 0;
    for (const [dx, dy, diag] of DIRS8) {
      const nx = x + dx, ny = y + dy;
      if (!inb(nx, ny)) continue;
      const n = idx(nx, ny);
      if (!isLand(n) || closed[n] === st) continue;
      if (diag && (!isLand(idx(x + dx, y)) || !isLand(idx(x, y + dy)))) continue;
      const ng = g + CFG.trackWeight[BIOME_KEY[biome[n]]] * (diag ? 1.414 : 1);
      if (ng > maxLen) continue;
      if (seen[n] !== st || ng < gScore[n]) { seen[n] = st; gScore[n] = ng; cameFrom[n] = cur; heap.push(n, ng + h(n)); }
    }
  }
  return null;
}

// shortest sea route from a new port to the nearest existing port (BFS over ocean)
function seaPath(port, targets) {
  const st = ++stampN;
  const oceanNeighbors = t => {
    const out = [], x = t % W, y = (t / W) | 0;
    for (const [dx, dy] of DIRS8) {
      const nx = x + dx, ny = y + dy;
      if (inb(nx, ny) && biome[idx(nx, ny)] === OCEAN) out.push(idx(nx, ny));
    }
    return out;
  };
  const goal = new Map();
  for (const t of targets) for (const n of oceanNeighbors(t)) goal.set(n, t);
  const q = [];
  for (const n of oceanNeighbors(port)) { seen[n] = st; cameFrom[n] = -1; gScore[n] = 1; q.push(n); }
  for (let hd = 0; hd < q.length; hd++) {
    const cur = q[hd];
    if (goal.has(cur)) {
      const path = [];
      for (let p = cur; p !== -1; p = cameFrom[p]) path.push(p);
      return { path: [port, ...path.reverse(), goal.get(cur)], to: goal.get(cur) };
    }
    if (gScore[cur] > CFG.seaMaxLength) continue;
    const x = cur % W, y = (cur / W) | 0;
    for (const [dx, dy, diag] of DIRS8) {
      const nx = x + dx, ny = y + dy;
      if (!inb(nx, ny)) continue;
      const n = idx(nx, ny);
      if (biome[n] !== OCEAN || seen[n] === st) continue;
      if (diag && biome[idx(x + dx, y)] !== OCEAN && biome[idx(x, y + dy)] !== OCEAN) continue;
      seen[n] = st; cameFrom[n] = cur; gScore[n] = gScore[cur] + 1; q.push(n);
    }
  }
  return null;
}

// a straight run of tiles from a to b (planes fly straight: this is just their track)
function straightPath(a, b) {
  const ax = a % W, ay = (a / W) | 0, bx = b % W, by = (b / W) | 0, n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)));
  const out = [];
  for (let k = 0; k <= n; k++) out.push(idx(Math.round(ax + (bx - ax) * k / n), Math.round(ay + (by - ay) * k / n)));
  return out;
}
const linkKind = type => CFG.buildings[type] && CFG.buildings[type].link;
const LINK_NAME = { road: 'road', sea: 'sea route', rail: 'rail line', air: 'air route' };
const HUB_NAME = { road: 'caravan post', sea: 'port', rail: 'station', air: 'airport' };
// what placing a hub (port, station, airport) at tile i would link to (cached while hovering)
let planCache = { key: null, val: null };
function linkPlan(i, type) {
  const kind = linkKind(type), hubs = game.hubs[kind];
  const key = `${type}:${i}:${hubs.length}`;
  if (planCache.key === key) return planCache.val;
  let val;
  const others = hubs.filter(t => t !== i && owner[t] && (kind === 'sea' || kind === 'air' || landmass[t] === landmass[i]));
  if (!hubs.length) val = { note: `Your first ${HUB_NAME[kind]}: it links up when you build a second one in another domain` };
  else if (!others.length) val = { note: kind === 'road' || kind === 'rail' ? `No other ${HUB_NAME[kind]} on this landmass. Use ports to cross water.` : `No other ${HUB_NAME[kind]} to link to yet` };
  else if (kind === 'air') {
    val = { routes: others.map(t => ({ path: straightPath(i, t), to: t })), tiles: 0, extra: null };
    val.tiles = Math.round(Math.min(...val.routes.map(r => r.path.length)));
  } else if (kind === 'sea') {
    const r = seaPath(i, others);
    val = r ? { routes: [{ path: r.path, to: r.to }], tiles: r.path.length, extra: null } : { note: 'No sea route to your other ports' };
  } else {
    const max = kind === 'road' ? CFG.railMaxLength * 1.4 : CFG.railMaxLength * 1.6;
    const r = railPath(i, others, max);
    if (!r) val = { note: `No ${HUB_NAME[kind]} within reach over land. It will be built unlinked.` };
    else {
      const per = kind === 'rail' ? { wood: 0.15, stone: 0.15, iron: 0.05 } : { stone: 0.06 };
      const tc = {};
      for (const [k, v] of Object.entries(per)) tc[k] = Math.ceil(v * r.weighted);
      val = { routes: [{ path: r.path, to: r.to }], tiles: r.path.length, extra: tc };
    }
  }
  planCache = { key, val };
  return val;
}

// ======================================================================
// buildings
// ======================================================================
function isCoastal(i) {
  const x = i % W, y = (i / W) | 0;
  for (const [dx, dy] of DIRS4) {
    const nx = x + dx, ny = y + dy;
    if (inb(nx, ny) && biome[idx(nx, ny)] === OCEAN) return true;
  }
  return false;
}
function canBuild(i, type) {
  if (!isLand(i)) return biome[i] === OCEAN ? "Can't build on water" : biome[i] === ICE ? "Can't build on the ice wall" : "That's outer space";
  if (!owner[i]) return 'Must be inside your territory';
  const def = CFG.buildings[type], have = building[i] ? buildingAt(i) : null;
  if (have && have.site) return 'Already under construction here';
  if (Array.isArray(def.from)) {                   // upgrade only (mining rig)
    if (!have || !def.from.includes(have.type)) return `Place it on a ${def.from.map(t => CFG.buildings[t].name.toLowerCase()).join(' or ')} to upgrade it`;
  } else if (have) {
    if (have.type === type) return `Already a ${def.name.toLowerCase()}`;
    if (!ladderSteps(type, have.type)) return 'Something is already built here';
  } else if (hasDep(i) && !isField(i) && (!def.on || def.farm)) return "Can't build on a resource deposit (collectors can go beside it)";
  if (type === 'port' && !isCoastal(i)) return 'Ports must be on the coast';
  return null;
}
function planFor(i, type) {
  return linkKind(type) && !canBuild(i, type) ? linkPlan(i, type) : null;
}
// cost to put `type` on tile i: the ladder steps from whatever is there now, plus any track
function totalCost(type, plan, i = -1) {
  const have = i >= 0 && building[i] ? buildingAt(i).type : null;
  let cost = {};
  for (const t of ladderSteps(type, have) || [type]) cost = addCost(cost, CFG.buildings[t].cost);
  return addCost(cost, plan && plan.extra);
}
function missingFor(cost, C = activeCountry()) {
  for (const [r, n] of Object.entries(cost)) if (!C || C.res[r] < n) return r;
  return null;
}
// what this domain is short of, to pay `cost` right now
function shortfall(cost, C) {
  const out = {};
  for (const [r, n] of Object.entries(cost)) if (C.res[r] < n) out[r] = n - Math.max(0, C.res[r]);
  return out;
}
// what the domains linked to C (not C itself) hold, together
function linkedStock(C) {
  const tot = resBox();
  for (const [id, hop] of routesTo(C)) if (hop) for (const r of RESOURCES) tot[r] += Math.max(0, game.countries[id].res[r]);
  return tot;
}
const empireCap = () => game.countries.reduce((a, c) => a + (c.alive ? c.cap : 0), 0);
function placeBuilding(i, type) {
  if (isField(i)) {                                // building over a field: that tile stops growing wheat
    const d = deposits[depositOf[i]]; depositOf[i] = -1; d.tiles = d.tiles.filter(t => t !== i); repaintTile(i);
  }
  const old = buildingAt(i);
  if (old) { old.type = type; building[i] = BLD_CODE[type]; return old; }   // upgrade in place
  building[i] = BLD_CODE[type];
  const b = { i, type };
  game.buildings.push(b);
  return b;
}
// once a building stands: farms sow their fields, hubs link up
function afterBuilt(i, type, plan) {
  const def = CFG.buildings[type], b = buildingAt(i);
  if (def.farm && b && b.field == null) sowFields(i);
  if (def.base || def.fort) b.units = b.units || 0;
  const kind = def.link;
  if (kind) {
    if (!game.hubs[kind].includes(i)) game.hubs[kind].push(i);
    const p = plan || linkPlan(i, type);
    for (const r of (p && p.routes) || []) {
      if (!owner[r.to] || !buildingAt(r.to)) continue;
      game.links.push({ kind, a: i, b: r.to, path: r.path, t: 0, dir: 1, req: { a: [], b: [] } });
    }
    if (p && p.routes && p.routes.length) floatText(i % W + 0.5, (i / W) | 0, `${LINK_NAME[kind][0].toUpperCase() + LINK_NAME[kind].slice(1)}: ${p.tiles} tiles`, '#7bd389');
    planCache.key = null;
    graphVer++;
  }
}
// Build on tile i. The domain it stands in pays. If that domain is short, the building goes up as a
// construction site (a gear turns over it) and the rest is shipped in from your linked domains.
function tryBuild(i, type) {
  const def = CFG.buildings[type];
  if (!isUnlocked(type)) { toast(`${def.name} needs ${TECH[def.tech].name}`); return false; }
  const why = canBuild(i, type);
  if (why) { toast(why); return false; }
  const C = countryAt(i), plan = planFor(i, type), cost = totalCost(type, plan, i);
  const settlers = def.people || 0;                // a settlement is founded by people, like an expedition
  if (freePeople(C) < settlers) { toast(`${C.short} needs ${settlers} free people to found a settlement`); return false; }
  const short = shortfall(cost, C);
  if (Object.keys(short).length) {
    const linked = linkedStock(C), lack = Object.keys(short).find(r => linked[r] < short[r]);
    if (lack) {
      const any = [...routesTo(C).values()].some(h => h);
      toast(any ? `Not enough ${lack}: ${C.short} and the domains linked to it have ${fmtNum(Math.max(0, C.res[lack]) + linked[lack])} of ${cost[lack]}`
        : `${C.short} has only ${fmtNum(Math.max(0, C.res[lack]))} ${lack} and no link to your other domains. Link them with ports, rail stations or airports.`);
      return false;
    }
  }
  C.people -= settlers;
  for (const [r, n] of Object.entries(cost)) C.res[r] -= Math.min(n, Math.max(0, C.res[r]));
  // every building is a construction site until its materials arrive: carted out from the nearest settlement,
  // and shipped in from your linked domains first if this one is short
  const site = { type, need: short, country: C.id, plan, cost };
  const old = buildingAt(i);
  let b = old;
  if (old) old.site = site;
  else { building[i] = BLD_CODE[type]; b = { i, type, site }; game.buildings.push(b); bldVer++; }
  if (Object.keys(short).length) toast(`${def.name} under construction in ${C.short}: waiting for ${Object.entries(short).map(([r, n]) => `${Math.ceil(n)} ${r}`).join(', ')} from your other domains`);
  else startDelivery(b);
  return true;
}

// ======================================================================
// pushes (left-click) and expeditions (right-click)
// ======================================================================
let pushId = 0;
// people per click come from the country that will do the work
const sendFrom = C => Math.floor((C ? freePeople(C) : 0) * game.sendPct / 100);

function startPush(tx, ty) {
  const b = biome[idx(tx, ty)];
  if (b === OCEAN) return toast(`Can't expand into water. ${say('Right-click', 'Long-press')} to send a boat expedition.`);
  if (b === ICE || b === VOID) return toast('Nothing to claim there: that is the edge of the world.');
  if (!frontier.size) return toast('Nowhere left to expand');
  const { country: src } = nearestCountryTo(tx, ty);
  const n = sendFrom(src);
  if (n < 1) return toast(`${src.short} doesn't have enough people. Wait for them to regrow.`);
  src.people -= n;
  game.pushes.push({ id: pushId++, country: src.id, tx, ty, budget: n, start: n, work: 0, mx: null, my: null, lx: null, ly: null });
}

function stepPush(p, dt) {
  const owner0 = liveCountry(p.country);           // follow merges
  if (!owner0) { p.done = true; return; }
  const cid = p.country = owner0.id;
  p.work += CFG.pushWorkPerSec(p.budget) * dt;
  const grassCost = CFG.tileCost.grass;
  if (p.work < 1) return;
  // The front: this country's frontier tiles within a band of the closest one to the target.
  // Inside the band, pick randomly (preferring tiles already hugged by territory),
  // so the border advances as a wide, slightly ragged front instead of a spike.
  let minD = Infinity;
  const mine = [];
  for (const i of frontier) {
    if (aiOf[i]) continue;                         // people only claim free land: taking a nation's land is for troops
    const x = i % W, y = (i / W) | 0;
    let on = 0, ours = false;
    for (const [dx, dy] of DIRS4) {
      const nx = x + dx, ny = y + dy;
      if (!inb(nx, ny)) continue;
      const n = idx(nx, ny);
      if (owner[n]) { on++; const c = liveCountry(countryOf[n]); if (c && c.id === cid) ours = true; }
    }
    if (!ours) continue;
    const d = Math.hypot(x - p.tx, y - p.ty);
    mine.push({ i, d, on });
    if (d < minD) minD = d;
  }
  const band = 4 + Math.sqrt(p.start) * 1.3;
  const cands = [];
  for (const m of mine) if (m.d <= minD + band) cands.push({ i: m.i, s: (m.d - minD) / band * 1.2 - m.on * 0.45 + rng() });
  cands.sort((a, b) => a.s - b.s);
  for (const c of cands) {
    if (owner[c.i] || aiOf[c.i]) continue;
    const cost = tileCost(c.i), work = cost / grassCost;
    if (cost > p.budget) continue;
    if (work > p.work) break;
    p.work -= work; p.budget -= cost;
    claim(c.i, cid);
    // marker follows the part of the front closest to the target
    const cx = c.i % W + 0.5, cy = ((c.i / W) | 0) + 0.5;
    if (p.lx == null || Math.hypot(cx - p.tx, cy - p.ty) < Math.hypot(p.lx - p.tx, p.ly - p.ty) + 1.5) { p.lx = cx; p.ly = cy; }
    if (p.work < 1) break;
  }
  const cheapest = cands.length ? Math.min(...cands.slice(0, 40).map(c => tileCost(c.i))) : Infinity;
  if (!cands.length || p.budget < cheapest || p.budget < grassCost) p.done = true;
}

// the tile just outside a country's border that's closest to a spot (falls back to its centre)
function borderTileOf(C, tx, ty) {
  let best = -1, bd = Infinity;
  for (const i of frontier) {
    const d = (i % W - tx) ** 2 + (((i / W) | 0) - ty) ** 2;
    if (d >= bd) continue;
    const x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of DIRS4) {
      const n = idx(x + dx, y + dy);
      if (inb(x + dx, y + dy) && owner[n] && liveCountry(countryOf[n]) === C) { best = i; bd = d; break; }
    }
  }
  return best >= 0 ? best : idx(Math.floor(C.lx), Math.floor(C.ly));
}
// Right-click sends an expedition out of the country you're viewing, from its border nearest the click.
// You drive it yourself (see driveStep); `auto` is the old straight-line trip, kept for the playtest bot.
function launchExpedition(tx, ty, { auto = false } = {}) {
  const t = idx(tx, ty);
  if (owner[t]) return toast(`That land is already yours. ${say('Right-click', 'Long-press')} outside your border to send an expedition that way.`);
  if (auto) {
    if (!isLand(t)) return toast('Pick a land tile for the expedition');
    if (aiOf[t]) return toast(`That's ${nationAt(t).full}. Take it by pushing in from your border (${say('left-click', 'tap')}), or shell it first.`);
  }
  const src = activeCountry() || nearestCountryTo(tx, ty).country;
  const tile = borderTileOf(src, tx, ty);
  const n = sendFrom(src);
  if (n < 2) return toast(`${src.short} doesn't have enough people for an expedition`);
  let [sx, sy] = [tile % W + 0.5, ((tile / W) | 0) + 0.5];
  const crossesWater = (ax, ay) => {
    const d = Math.hypot(tx - ax, ty - ay), steps = Math.ceil(d);
    for (let k = 1; k < steps; k++) if (biome[idx(Math.floor(ax + (tx - ax) * k / steps), Math.floor(ay + (ty - ay) * k / steps))] === OCEAN) return true;
    return false;
  };
  const bySea = biome[t] === OCEAN || crossesWater(sx, sy);
  if (bySea) {                                     // boats leave from your nearest port, if you have one
    const ports = game.hubs.sea.filter(pt => countryAt(pt) === src);
    if (ports.length) {
      const pt = ports.reduce((a, b) => (Math.hypot(a % W - tx, ((a / W) | 0) - ty) <= Math.hypot(b % W - tx, ((b / W) | 0) - ty) ? a : b));
      [sx, sy] = [pt % W + 0.5, ((pt / W) | 0) + 0.5];
    }
  }
  let kind = 'truck';
  if (bySea && !auto) {                            // a boat needs water to start on: the sea beside your coast nearest the target
    let best = -1, bd = Infinity;
    for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
      const x = Math.floor(sx) + dx, y = Math.floor(sy) + dy, d = dx * dx + dy * dy;
      if (d < bd && inb(x, y) && biome[idx(x, y)] === OCEAN) { bd = d; best = idx(x, y); }
    }
    if (best < 0) {                                // not by the border tile: any coast of this domain, nearest the target
      let cd = Infinity;
      for (let i = 0; i < N; i++) {
        if (!owner[i] || liveCountry(countryOf[i]) !== src) continue;
        const d = (i % W - tx) ** 2 + (((i / W) | 0) - ty) ** 2;
        if (d >= cd) continue;
        const x = i % W, y = (i / W) | 0;
        for (const [ddx, ddy] of DIRS4) if (inb(x + ddx, y + ddy) && biome[idx(x + ddx, y + ddy)] === OCEAN) { cd = d; best = idx(x + ddx, y + ddy); break; }
      }
    }
    if (best >= 0) { kind = 'boat'; sx = best % W + 0.5; sy = ((best / W) | 0) + 0.5; }
    // no coast of its own: it sets out over land, and takes to the water when it reaches the shore
  }
  src.people -= n;
  const kit = {};                                  // supplies to get the colony started, if home can spare them
  for (const r of CARGO_RES) {
    const want = Math.max(CFG.expeditionKit[r] || 0, src.res[r] * game.sendPct / 100);
    kit[r] = Math.floor(Math.min(want, src.res[r]));
    src.res[r] -= kit[r];
  }
  const e = { x: sx, y: sy, tx: tx + 0.5, ty: ty + 0.5, n, kit, from: src.id, auto };
  if (!auto) {
    Object.assign(e, { kind, vx: 0, vy: 0, a: Math.atan2(ty + 0.5 - sy, tx + 0.5 - sx), supplies: CFG.drive.supplies, trail: [[sx, sy]] });
    takeWheel(e);
    toast(`${kind === 'boat' ? 'Boat' : 'Wagon'} ready with ${n} people${kind !== 'boat' && bySea ? ' (it becomes a boat at the shore)' : ''}. ${say('Arrow keys or WASD to drive, Space to settle, Esc to let go', 'Steer with the pad, and tap Settle when you like the spot')}.`);
  }
  game.expeditions.push(e);
}
function takeWheel(e) {
  stopFollow(); cam.anim = null;
  game.driving = e;
  if (e) { setTool(null); setAiming(false); cam.zoom = Math.max(cam.zoom, 9); }
}
// X: hop into the next expedition that's waiting for a driver
function nextVehicle() {
  const list = game.expeditions.filter(e => !e.auto && !e.done);
  if (!list.length) return toast(`No expedition is out. ${say('Right-click', 'Long-press')} outside your border to send one.`);
  takeWheel(list[(list.indexOf(game.driving) + 1) % list.length]);
}
// expeditions go anywhere but the ice wall and outer space: over land they're a wagon (or truck), on water a boat
const canDriveOn = (e, x, y) => inb(Math.floor(x), Math.floor(y)) &&
  (biome[idx(Math.floor(x), Math.floor(y))] === OCEAN || isLand(idx(Math.floor(x), Math.floor(y))));

function stepExpedition(e, dt) {
  if (!e.auto) return driveStep(e, dt);
  const dx = e.tx - e.x, dy = e.ty - e.y, d = Math.hypot(dx, dy);
  const step = CFG.expeditionSpeed * dt;
  if (d <= step) { e.x = e.tx; e.y = e.ty; e.done = true; arrive(e); return; }
  e.x += dx / d * step; e.y += dy / d * step;
}
// One physics model for every vehicle: thrust along the heading, drag from what's underneath.
// A truck grips (no sideways slide) and crawls through desert and mountains; a boat drifts and turns wide.
function driveStep(e, dt) {
  const under = biome[idx(Math.floor(e.x), Math.floor(e.y))];
  if (inb(Math.floor(e.x), Math.floor(e.y))) {
    const k = under === OCEAN ? 'boat' : 'truck';
    if (k !== e.kind) { e.kind = k; e.vx *= 0.4; e.vy *= 0.4; if (game.driving === e) toast(k === 'boat' ? 'Into the water: the expedition takes to its boat' : 'Ashore: the expedition goes on by land'); }
  }
  const D = CFG.drive, V = D[e.kind], on = game.driving === e && !buildOpen && !modalOpen;
  const key = (...ks) => on && ks.some(k => keys.has(k));
  const thr = key('arrowup', 'w') ? 1 : key('arrowdown', 's') ? -0.5 : 0;
  const turn = (key('arrowright', 'd') ? 1 : 0) - (key('arrowleft', 'a') ? 1 : 0);
  e.a += turn * V.turn * dt;
  const hx = Math.cos(e.a), hy = Math.sin(e.a);
  const drag = e.kind === 'boat' ? V.drag : V.drag[BIOME_KEY[biome[idx(Math.floor(e.x), Math.floor(e.y))]]] || 3;
  e.vx += (hx * thr * V.accel - e.vx * drag) * dt;
  e.vy += (hy * thr * V.accel - e.vy * drag) * dt;
  if (e.kind === 'truck') {                        // wheels: kill the sideways part of the motion quickly
    const f = e.vx * hx + e.vy * hy, k = Math.exp(-10 * dt);
    e.vx = f * hx + (e.vx - f * hx) * k; e.vy = f * hy + (e.vy - f * hy) * k;
  }
  const nx = e.x + e.vx * dt, ny = e.y + e.vy * dt;
  if (canDriveOn(e, nx, e.y)) e.x = nx; else e.vx = 0;      // blocked (coast, ice wall): slide along it
  if (canDriveOn(e, e.x, ny)) e.y = ny; else e.vy = 0;
  const last = e.trail[e.trail.length - 1];
  if (Math.hypot(e.x - last[0], e.y - last[1]) > 1.5) { e.trail.push([e.x, e.y]); if (e.trail.length > 600) e.trail.shift(); }
  e.supplies -= dt;
  if (e.supplies < 0) {
    e.n -= D.starve * dt;
    if (e.n < 1) {
      e.done = true;
      if (game.driving === e) game.driving = null;
      toast('The expedition ran out of supplies and was lost.');
    }
  }
}
// where this expedition would settle right now: under a truck, or the nearest shore for a boat.
// { i, how: 'found' | 'join' } or null when there's nowhere (deep water, an AI nation's land)
function settleSite(e) {
  const cx = Math.floor(e.x), cy = Math.floor(e.y), R = e.kind === 'boat' ? CFG.drive.landReach : 0;
  let best = null, bd = Infinity;
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const x = cx + dx, y = cy + dy;
    if (!inb(x, y)) continue;
    const i = idx(x, y);
    if (!isLand(i) || aiOf[i]) continue;
    const d = dx * dx + dy * dy + (owner[i] ? 100 : 0);        // free land first; your own land only if that's all there is
    if (d < bd) { bd = d; best = { i, how: owner[i] ? 'join' : 'found' }; }
  }
  return best;
}
function settleExpedition(e) {
  const site = settleSite(e);
  if (!site) {
    const here = idx(Math.floor(e.x), Math.floor(e.y));
    return toast(aiOf[here] ? `This is ${nationAt(here).full}. Drive on to free land.` : 'Bring the boat alongside free land first.');
  }
  e.tx = site.i % W + 0.5; e.ty = ((site.i / W) | 0) + 0.5;
  e.n = Math.floor(e.n);
  e.done = true;
  game.driving = null;
  arrive(e);
  const c = countryAt(site.i);
  if (c) game.active = c.id;
}

// an expedition that lands on free land founds a new country (a colony) with its own people and stockpile
function arrive(e) {
  const cx = Math.floor(e.tx), cy = Math.floor(e.ty);
  const there = countryAt(idx(cx, cy));
  if (there) {                                     // your territory got there first: they just join that country
    there.people += e.n;
    for (const r in e.kit) there.res[r] += e.kit[r];
    floatText(e.tx, e.ty, `${e.n} joined ${there.short}`, '#f2c14e');
    return;
  }
  const col = newCountry({ people: e.n, res: e.kit });
  const r = CFG.outpostRadius;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (dx * dx + dy * dy > r * r + 1) continue;
    const x = cx + dx, y = cy + dy;
    if (inb(x, y)) claim(idx(x, y), col.id);
  }
  // the settlers found a settlement: on the landing spot, or the nearest clear tile if that's a deposit
  let site = -1, sd = Infinity;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const x = cx + dx, y = cy + dy, d = dx * dx + dy * dy;
    if (d >= sd || !inb(x, y)) continue;
    const t = idx(x, y);
    if (owner[t] && countryOf[t] === col.id && depositOf[t] < 0 && !building[t]) { site = t; sd = d; }
  }
  if (site >= 0) placeBuilding(site, 'settlement');
  recomputeNetwork();
  const live = liveCountry(col.id);
  if (live !== col) { toast(`The settlers joined ${live.full}`); return; }
  const kitTxt = Object.entries(e.kit).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${k}`).join(', ') || 'nothing';
  toast(`Founded ${col.full}! Its settlement grows as you claim the land around it. It has its own stockpile (${kitTxt}); link it home to share people and cargo.`);
}


const tileDist = (i, x, y) => Math.hypot(i % W - x, ((i / W) | 0) - y);
// ======================================================================
// military: bases train people into units; units march to fortresses; attacks are launched from
// fortresses first (bases only when they're closer to the fight, or the fortresses are empty).
// Units travel over your land on foot and ride your links between domains.
// ======================================================================
const garrisons = () => game.buildings.filter(b => owner[b.i] && (b.type === 'base' || b.type === 'fort') && !underway(b));
const unitsIn = C => garrisons().reduce((a, b) => a + (countryAt(b.i) === C ? b.units || 0 : 0), 0);
function totalUnits() {
  let n = 0;
  for (const b of garrisons()) n += b.units || 0;
  for (const a of game.armies) n += a.n;
  for (const a of game.attacks) n += a.units;
  return n;
}
// a route for troops from tile g to a point in domain T: on foot inside a domain, riding links between domains.
// { pts: [[x, y]...], spd: [tiles/s per leg], len } or null when there's no way.
function armyRoute(g, tx, ty, T) {
  const A = countryAt(g);
  if (!A || !T) return null;
  const prof = troopProf(), pts = [], spd = [];
  const add = (r) => { if (!pts.length) pts.push(r.pts[0]); for (let k = 1; k < r.pts.length; k++) { pts.push(r.pts[k]); spd.push(r.spd[k - 1]); } };
  let [cx, cy] = tileCenter(g), C = A, guard = 0;
  if (A !== T) {
    const routes = routesTo(T);
    if (!routes.get(A.id)) return null;
    while (C !== T && guard++ < 40) {
      const hop = routes.get(C.id), L = hop.L, path = hop.end === 'a' ? L.path : [...L.path].reverse();
      const vs = Math.max(linkStats(L.kind, techIn(C)).speed, prof.off);
      add(findRoute(cx, cy, ...tileCenter(path[0]), prof));          // to the stop, by road where it helps
      const ride = { pts: [tileCenter(path[0])], spd: [] };
      for (let k = 1; k < path.length; k += 2) { ride.pts.push(tileCenter(path[k])); ride.spd.push(vs); }
      ride.pts.push(tileCenter(path[path.length - 1])); ride.spd.push(vs);
      add(ride);
      [cx, cy] = tileCenter(path[path.length - 1]);
      C = hop.next;
    }
  }
  add(findRoute(cx, cy, tx, ty, prof));
  let len = 0;
  for (let k = 1; k < pts.length; k++) len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]) / spd[k - 1];
  return { pts, spd, len };
}
// ---------- convoys: haulers taking a harvest to a settlement, deliveries to building sites and bases ----------
// a domain's settlement nearest a spot (by travel time for a hauler), or null if it has none
function nearestSettlement(C, x, y) {
  let best = null, bd = Infinity;
  for (const b of game.buildings) {
    if (b.type !== 'settlement' || underway(b) || countryAt(b.i) !== C) continue;
    const d = Math.hypot(b.i % W + 0.5 - x, ((b.i / W) | 0) + 0.5 - y);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}
function sendConvoy(C, from, to, cargo, purpose, extra = {}) {
  const prof = haulProf(C), r = findRoute(...from, ...to, prof);
  const cv = { country: C.id, cargo, purpose, pts: r.pts, spd: r.spd, k: 0, f: 0, x: from[0], y: from[1], tier: roadTier(techIn(C)), ...extra };
  game.convoys.push(cv);
  return cv;
}
// a collector's harvest goes to the nearest settlement; once there it's in the domain's stock
function sendHaul(b, C) {
  const cargo = b.buf;
  b.buf = {}; b.haulT = 0;
  const S = nearestSettlement(C, ...tileCenter(b.i));
  if (!S) { storeIn(C, cargo); return; }           // no settlement in this domain: it goes straight into stock
  sendConvoy(C, tileCenter(b.i), tileCenter(S.i), cargo, 'haul', { from: b.i, to: S.i });
}
function storeIn(C, cargo) {
  for (const r in cargo) {
    if (!cargo[r]) continue;
    const cap = C.store ? C.store[r] : Infinity;
    C.res[r] += Math.max(0, Math.min(cargo[r], cap - C.res[r]));
  }
}
// goods leave the settlement nearest where they're needed, and arrive with the convoy
function startDelivery(b) {
  const C = countryAt(b.i), S = C && nearestSettlement(C, ...tileCenter(b.i));
  if (!C || !S || S.i === b.i) { finishSite(b); return; }
  b.site.convoy = true;
  sendConvoy(C, tileCenter(S.i), tileCenter(b.i), { ...b.site.cost }, 'site', { to: b.i });
}
function stepConvoy(cv, dt) {
  moveAlong(cv, dt);
  if (!cv.done) return;
  const C = liveCountry(cv.country);
  if (cv.purpose === 'haul') { if (C) storeIn(C, cv.cargo); return; }
  const b = buildingAt(cv.to);
  if (cv.purpose === 'site') { if (b && b.site) finishSite(b); else if (C) storeIn(C, cv.cargo); return; }
  if (cv.purpose === 'supply') { if (b) { b.oil = (b.oil || 0) + (cv.cargo.oil || 0); b.supplying = false; } else if (C) storeIn(C, cv.cargo); }
}
// anything that follows a route (troops, convoys): move along its legs at each leg's speed
function moveAlong(a, dt) {
  let move = dt;
  while (move > 0 && a.k < a.pts.length - 1) {
    const [x0, y0] = a.pts[a.k], [x1, y1] = a.pts[a.k + 1], seg = Math.hypot(x1 - x0, y1 - y0), sp = a.spd[a.k] || 1;
    const left = seg - a.f, step = sp * move;
    if (step < left) { a.f += step; move = 0; } else { move -= left / sp; a.f = 0; a.k++; }
  }
  if (a.k >= a.pts.length - 1) { [a.x, a.y] = a.pts[a.pts.length - 1]; a.done = true; return; }
  const [x0, y0] = a.pts[a.k], [x1, y1] = a.pts[a.k + 1], seg = Math.hypot(x1 - x0, y1 - y0) || 1;
  a.x = lerp(x0, x1, a.f / seg); a.y = lerp(y0, y1, a.f / seg);
  a.ang = Math.atan2(y1 - y0, x1 - x0);
  a.onRoad = (a.spd[a.k] || 0) > (a.spd[0] || 0) * 1.2 || NET[idx(Math.floor(a.x), Math.floor(a.y))] > 0;
}
function sendArmy(from, n, route, purpose, extra = {}) {
  from.units -= n;
  const a = { n, pts: route.pts, spd: route.spd, k: 0, f: 0, x: route.pts[0][0], y: route.pts[0][1], purpose, home: from.i, ...extra };
  game.armies.push(a);
  return a;
}
function stepArmy(a, dt) {
  moveAlong(a, dt);
  if (a.done) armyArrives(a);
}
function armyArrives(a) {
  if (a.purpose === 'attack') {
    const at = game.attacks.find(q => q.id === a.attack);
    if (at && !at.done) { at.units += a.n; at.coming -= a.n; return; }
  }
  const b = buildingAt(a.dest) || buildingAt(a.home);
  if (b && owner[b.i] && (b.type === 'base' || b.type === 'fort')) { b.units = (b.units || 0) + a.n; if (a.purpose === 'garrison') b.incoming = Math.max(0, (b.incoming || 0) - a.n); return; }
  const g = garrisons().sort((p, q) => tileDist(p.i, a.x, a.y) - tileDist(q.i, a.x, a.y))[0];
  if (g) g.units = (g.units || 0) + a.n;           // its own fort is gone: the nearest one takes them in
}
// bases train units while their domain has people to spare; full bases send units on to fortresses with room
let transferTimer = 0;
function militaryTick(dt) {
  const M = CFG.military, us = unitStats(), tf = techFactor(game.research.done);
  for (const b of garrisons()) {
    b.units = b.units || 0;
    if (b.type !== 'base' || !game.recruit) continue;
    const C = countryAt(b.i), cap = garrisonCap(b);
    b.training = false;
    if (!C || b.units >= cap || C.people < C.cap * M.keep + us.type.people) continue;
    // late units need oil: it's carted out to the base from the nearest settlement
    if (us.type.oil && (b.oil || 0) < 4 && !b.supplying && C.res.oil >= 1) {
      const S = nearestSettlement(C, ...tileCenter(b.i)), amt = Math.min(20, C.res.oil);
      C.res.oil -= amt;
      if (S) { b.supplying = true; sendConvoy(C, tileCenter(S.i), tileCenter(b.i), { oil: amt }, 'supply', { to: b.i }); }
      else b.oil = (b.oil || 0) + amt;
    }
    let n = Math.min(M.train * tf * (1 + goldBoost().train) * dt, cap - b.units);
    if (us.type.oil) n = Math.min(n, Math.max(0, b.oil || 0) / us.type.oil);
    if (n <= 0) continue;
    C.people -= n * us.type.people;
    if (us.type.oil) b.oil -= n * us.type.oil;
    b.units += n; b.training = true;
  }
  transferTimer += dt;
  if (transferTimer < M.transfer) return;
  transferTimer = 0;
  const forts = garrisons().filter(b => b.type === 'fort');
  for (const b of garrisons()) {
    if (b.type !== 'base' || b.units < 1) continue;
    let best = null, bl = Infinity, route = null;
    for (const f of forts) {
      const room = garrisonCap(f) - (f.units || 0) - (f.incoming || 0);
      if (room < 1) continue;
      const r = armyRoute(b.i, ...tileCenter(f.i), countryAt(f.i));
      if (r && r.len < bl) { bl = r.len; best = f; route = r; }
    }
    if (!best) continue;
    const n = Math.floor(Math.min(b.units, garrisonCap(best) - (best.units || 0) - (best.incoming || 0)));
    if (n < 1) continue;
    best.incoming = (best.incoming || 0) + n;
    sendArmy(b, n, route, 'garrison', { dest: best.i });
  }
}
// a nation's troops: how tough and strong (from its own techs), and how hard it defends
function nationStats(n) {
  const u = unitStats(n.R || new Set());
  return { ...u, def: (n.pers ? n.pers.defense : 1) };
}
// where your land touches a nation's, nearest a spot: [the nation's tile, your tile beside it] or null
function frontWith(n, tx, ty) {
  let best = null, bd = Infinity;
  for (const i of frontier) {
    if (aiOf[i] !== n.id + 1) continue;
    const d = (i % W - tx) ** 2 + (((i / W) | 0) - ty) ** 2;
    if (d >= bd) continue;
    const x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of DIRS4) {
      const nb = idx(x + dx, y + dy);
      if (inb(x + dx, y + dy) && owner[nb]) { best = [i, nb]; bd = d; break; }
    }
  }
  return best;
}
let attackId = 0;
// how far past your own land your troops can strike, in tiles (more with horses, trucks, planes, tanks)
function strikeReach() {
  const R = unitTech(), c = CFG.reach;
  let r = c.base;
  for (const k of ['horses', 'automobile', 'flight', 'armor']) if (R.has(k)) r += c[k];
  return r;
}
// where an attack on nation n near (tx, ty) would start: your tile nearest the spot (within reach), and their
// tile nearest that. { ours, theirs, gap } or null when it's out of reach.
function strikePlan(n, tx, ty) {
  const reach = strikeReach(), id = n.id + 1;
  let ours = -1, od = Infinity;
  for (let dy = -reach; dy <= reach; dy += 1) for (let dx = -reach; dx <= reach; dx += 1) {
    const x = tx + dx, y = ty + dy, d = dx * dx + dy * dy;
    if (d >= od || d > reach * reach || !inb(x, y)) continue;
    if (owner[idx(x, y)]) { od = d; ours = idx(x, y); }
  }
  if (ours < 0) return null;
  const ox = ours % W, oy = (ours / W) | 0;
  let theirs = -1, td = Infinity;
  const R2 = Math.ceil(Math.sqrt(od)) + 2;
  for (let dy = -R2; dy <= R2; dy++) for (let dx = -R2; dx <= R2; dx++) {
    const x = ox + dx, y = oy + dy, d = dx * dx + dy * dy;
    if (d < td && inb(x, y) && aiOf[idx(x, y)] === id) { td = d; theirs = idx(x, y); }
  }
  if (theirs < 0) return null;
  return { ours, theirs, gap: Math.sqrt(td) };
}
// Send troops at a nation: troopPct of all your garrisoned units, from the fortresses nearest the front
// (a base only goes first when it's nearer than any fortress with troops, or the fortresses run dry).
// If your land doesn't touch theirs, the troops march across the gap (if it's within reach) and take a foothold.
function launchAttack(n, tx, ty) {
  const plan = strikePlan(n, tx, ty);
  if (!plan) { toast(`${n.full} is out of reach there: your troops can strike up to ${strikeReach()} tiles past your border (more with Equestrianism, Automobiles and Flight).`); return false; }
  const far = plan.gap > 1.5, T = countryAt(plan.ours);
  const [sx, sy] = tileCenter(far ? plan.theirs : plan.ours);
  const all = garrisons().filter(b => (b.units || 0) >= 1);
  const avail = all.reduce((a, b) => a + Math.floor(b.units), 0);
  const want = Math.floor(avail * game.troopPct / 100);
  if (want < 1) {
    toast(isUnlocked('base') ? 'No troops ready. Your military bases train them (and fortresses hold them).' : `You need military units to attack: research ${TECH.warrior.name} and build a military base.`);
    return false;
  }
  const opts = [];
  for (const b of all) { const r = armyRoute(b.i, sx, sy, T); if (r) opts.push({ b, r }); }
  if (!opts.length) { toast(`None of your troops can reach ${T.short}: link it to a domain with a fortress or base (port, rail or airport).`); return false; }
  const forts = opts.filter(o => o.b.type === 'fort').sort((p, q) => p.r.len - q.r.len);
  const bases = opts.filter(o => o.b.type === 'base').sort((p, q) => p.r.len - q.r.len);
  const nearFort = forts.length ? forts[0].r.len : Infinity;
  const order = [...bases.filter(o => o.r.len < nearFort), ...forts, ...bases.filter(o => o.r.len >= nearFort)];
  const at = { id: attackId++, nation: n.id, tx, ty, units: 0, coming: 0, work: 0, lx: sx, ly: sy, country: T.id, start: 0, far, beach: plan.theirs };
  let left = want;
  for (const o of order) {
    if (left < 1) break;
    const k = Math.min(Math.floor(o.b.units), left);
    if (k < 1) continue;
    sendArmy(o.b, k, o.r, 'attack', { attack: at.id });
    at.coming += k; left -= k;
  }
  at.start = at.coming;
  game.attacks.push(at);
  provoke(n);
  toast(`${at.coming} ${unitStats().type.name} march on ${n.full}${far ? `, ${Math.round(plan.gap)} tiles past your border` : ''}. They attack as they arrive.`);
  return true;
}
// one attack: your units at the front fight the nation's troops, and take its land as they win.
// Lanchester-style: each side kills in proportion to the units in the fight, its attack and the other's toughness.
function stepAttack(at, dt) {
  const n = game.nations[at.nation], M = CFG.military;
  if (!n || !n.alive) { at.done = true; return; }
  if (at.units < 0.5) { if (at.coming < 0.5) at.done = true; return; }
  const us = unitStats(), them = nationStats(n);
  const eng = Math.min(at.units, Math.max(0, n.units), 25 + at.units * 0.5);   // how many meet at the front
  if (n.units >= 0.5) {
    const k = M.kill * dt * eng;
    const ourKill = Math.min(n.units, k * us.atk / them.hp);
    const theirKill = Math.min(at.units, k * them.atk * them.def / us.hp);
    n.units -= ourKill; at.units -= theirKill; at.killed = (at.killed || 0) + ourKill; at.lost = (at.lost || 0) + theirKill;
  }
  const odds = at.units / (at.units + (n.units >= 0.5 ? eng * them.def : 0) + 1e-6);
  at.work += (1.5 + 1.2 * Math.sqrt(at.units)) * odds * dt * Math.sqrt(us.speed / M.speed);
  if (at.work < 1) return;
  if (at.far && !at.landed) {                      // troops that crossed open country first take a foothold
    let b = at.beach;
    if (aiOf[b] !== n.id + 1) { const p = strikePlan(n, Math.floor(at.lx), Math.floor(at.ly)); b = p ? p.theirs : -1; }
    if (b < 0) { at.done = true; return; }
    const C = liveCountry(at.country);
    if (!C) { at.done = true; return; }
    claim(b, C.id, true); at.landed = true; at.work -= 1;
    at.lx = b % W + 0.5; at.ly = ((b / W) | 0) + 0.5;
    return;
  }
  const aiForts = game.buildings.filter(b => b.type === 'fort' && aiOf[b.i] === n.id + 1);
  // the front: tiles of that nation (or free land) touching your land, nearest the target
  const cands = [];
  for (const i of frontier) {
    if (owner[i] || (aiOf[i] && aiOf[i] !== n.id + 1) || !isLand(i)) continue;
    const x = i % W, y = (i / W) | 0;
    if (Math.abs(x - at.lx) > 14 || Math.abs(y - at.ly) > 14) continue;   // the fighting stays where the troops are
    const d = Math.hypot(x - at.tx, y - at.ty);
    cands.push({ i, s: d + Math.random() * 4 - (aiOf[i] ? 3 : 0) });
  }
  cands.sort((a, b) => a.s - b.s);
  const militia = 0.12 * n.people / Math.max(1, n.tiles);      // no troops left: their people still fight a little
  for (const c of cands.slice(0, 60)) {
    let w = tileCost(c.i) / CFG.tileCost.grass;
    if (aiOf[c.i] && aiForts.some(f => tileDist(f.i, c.i % W, (c.i / W) | 0) <= CFG.walls.fortReach)) w *= CFG.walls.fortDefense;   // their forts hold their ground
    if (w > at.work) break;
    at.work -= w;
    if (aiOf[c.i]) {
      at.units -= (n.units >= 0.5 ? M.tileWork * 0.1 : M.tileWork * militia) / us.hp;
      n.people = Math.max(0, n.people - militia * 2);
    }
    const C = liveCountry(at.country) || countryAt(nearestFrontierOwned(c.i));
    if (!C) continue;
    claim(c.i, C.id, true);
    at.lx = c.i % W + 0.5; at.ly = ((c.i / W) | 0) + 0.5;
    if (at.units < 0.5 || at.work < 1) break;
  }
  if (at.units < 0.5) at.units = 0;
  if (!cands.some(c => aiOf[c.i] === n.id + 1)) at.done = true;   // nothing of theirs left to take here
}
// your tile next to i (for a new tile's domain)
function nearestFrontierOwned(i) {
  const x = i % W, y = (i / W) | 0;
  for (const [dx, dy] of DIRS4) { const nb = idx(x + dx, y + dy); if (inb(x + dx, y + dy) && owner[nb]) return nb; }
  return i;
}
// an attack that's over: the survivors go back to the nearest fortress (or base) with room
function endAttack(at) {
  if (at.units >= 1) {
    const C = liveCountry(at.country);
    const g = garrisons().filter(b => !C || countryAt(b.i) === C).sort((p, q) => tileDist(p.i, at.lx, at.ly) - tileDist(q.i, at.lx, at.ly) + (p.type === 'fort' ? -5 : 0))[0]
      || garrisons()[0];
    const n = Math.floor(at.units);
    if (g) {
      const r = armyRoute(nearestFrontierOwned(idx(Math.floor(at.lx), Math.floor(at.ly))), ...tileCenter(g.i), countryAt(g.i));
      if (r) game.armies.push({ n, pts: r.pts, spd: r.spd, k: 0, f: 0, x: r.pts[0][0], y: r.pts[0][1], purpose: 'home', home: g.i, dest: g.i });
      else g.units = (g.units || 0) + n;
    }
  }
  const nat = game.nations[at.nation];
  if (at.start >= 1) toast(`Attack on ${nat ? nat.short : 'the enemy'} is over: ${Math.round(at.killed || 0)} of theirs fell, you lost ${Math.round(at.lost || 0)}${at.units >= 1 ? `, ${Math.floor(at.units)} are heading back` : ''}.`);
}

// ======================================================================
// simulation tick
// ======================================================================
let netTimer = 0, landTimer = 0, aiTimer = 0, aiFireTimer = 0, supplyTimer = 0;
function tick(dt) {
  game.time += dt;
  netTimer += dt;
  landTimer += dt;
  if (game.netDirty && netTimer > 0.25) { recomputeNetwork(); netTimer = 0; landTimer = 0; }   // only when domains merge
  else if (game.bldDirty || (game.landDirty && landTimer > 0.3)) { recomputeBuildings(); landTimer = 0; }   // the border moved: settlements hold more (or less)

  // every domain: power, fuel, harvests (carted to its settlements), food, and its people
  let pop = 0, gold = 0;
  const WH = CFG.wheat, F = CFG.fuel, B = CFG.buildings;
  // what burns oil (and wood, for early steamships) in each domain this second
  for (const c of game.countries) { c.fuel = 0; c.fuelWood = 0; c.prod = resBox(); c.goldRate = 0; }
  const R0 = game.research.done;
  for (const cv of game.convoys) if (cv.tier === 'truck') { const C = liveCountry(cv.country); if (C) C.fuel += F.truck; }
  for (const L of game.links) {
    const A = countryAt(L.a), Bc = countryAt(L.b);
    if (!A || !Bc || A === Bc) continue;
    if (L.kind === 'air') { A.fuel += F.plane / 2; Bc.fuel += F.plane / 2; }
    if (L.kind === 'sea' && R0.has('steam')) {
      if (R0.has('petroleum')) { A.fuel += F.ship / 2; Bc.fuel += F.ship / 2; } else { A.fuelWood += F.shipWood / 2; Bc.fuelWood += F.shipWood / 2; }
    }
  }
  const ut = unitStats(R0).type, perUnit = ut.tech === 'armor' ? F.tank : ut.tech === 'automobile' ? F.motor : 0;
  if (perUnit) {
    for (const b of garrisons()) { const C = countryAt(b.i); if (C) C.fuel += (b.units || 0) * perUnit; }
    for (const a of game.armies) { const C = countryAt(a.home); if (C) C.fuel += a.n * perUnit; }
    for (const at of game.attacks) { const C = liveCountry(at.country); if (C) C.fuel += at.units * perUnit; }
  }
  // harvests: each collector piles up what it works; a hauler takes a cartload to the nearest settlement
  for (const c of game.countries) if (c.alive) {
    c.staff = c.pw.workers > 0 ? Math.min(1, c.people / c.pw.workers) : 1;   // too few people: collectors slow down
  }
  for (const b of game.buildings) {
    if (!owner[b.i] || !HARVESTS[b.type] || !b.work || underway(b)) continue;
    const C = countryAt(b.i);
    if (!C || !C.alive) continue;
    const rig = b.type === 'rig', farm = B[b.type].farm || 1;
    if (!b.buf) b.buf = {};
    for (const k of DEP_KINDS) {
      const n = b.work[k];
      if (!n) continue;
      const rate = k === 'wheat' ? n * WH.perTile * farm * C.staff : n * CFG.prodPerTile[k] * (rig ? CFG.power.rigMult * (C.sat ?? 1) : C.staff);
      if (k === 'gold') { gold += rate; C.goldRate += rate; continue; }     // gold isn't stored: it boosts things as it's mined
      const r = DEP_RES[k];
      b.buf[r] = (b.buf[r] || 0) + rate * dt; C.prod[r] += rate;
    }
    b.haulT = (b.haulT || 0) + dt;
    const load = boxSum(b.buf);
    if (load >= haulProf(C).cargo * 0.5 || (load >= 1 && b.haulT > 12)) sendHaul(b, C);   // a cart sets off half full, or after a short wait
  }
  game.goldRate = gold;
  for (const c of game.countries) {
    if (!c.alive) continue;
    // power: solar first (free), then reactors (uranium), oil plants (oil), steam plants (wood).
    // Short of power, every machine in the domain slows down evenly.
    const P = c.pw;
    let need = P.need, made = Math.min(need, P.solar * B.solar.gen);
    const burnFrom = (count, gen, perMax, stock) => {
      const max = count * gen;
      let out = Math.min(Math.max(0, need - made), max), use = max ? out / gen * (perMax) : 0;
      if (use * dt > Math.max(0, stock)) { const k = use ? Math.max(0, stock) / (use * dt) : 0; use *= k; out *= k; }
      made += out;
      return { use, max };
    };
    const rx = burnFrom(P.reactors, B.reactor.gen, F.reactor, c.res.uranium);
    const op = burnFrom(P.oilplants, B.oilplant.gen, F.oilplant, c.res.oil - c.fuel * dt);
    const bn = burnFrom(P.burners, B.burner.gen, CFG.power.burnerWood, c.res.wood);
    c.res.uranium -= rx.use * dt; c.fuel += op.use; c.res.wood -= bn.use * dt;
    c.sat = need > 0 ? Math.min(1, made / need) : 1;
    c.mw = { gen: made, max: P.solar * B.solar.gen + rx.max + op.max + bn.max, need, burn: bn.use };
    c.housing = c.capBase + P.capPow * c.sat;
    c.store = {};                                  // how much of each resource this domain can hold
    for (const r in CFG.storage) c.store[r] = CFG.storage[r].base + CFG.storage[r].perCap * c.housing;
    // fuel: oil burned by trucks, planes, ships, motorized troops and oil plants; wood by early steamships
    c.res.oil -= c.fuel * dt; c.res.wood -= c.fuelWood * dt;
    c.noOil = c.res.oil <= 0 && c.fuel > 0; c.noWood = c.res.wood <= 0 && c.fuelWood > 0;
    if (c.res.oil < 0) c.res.oil = 0;
    if (c.res.wood < 0) c.res.wood = 0;
    for (const r of RESOURCES) c.rates[r] = c.prod[r];
    c.rates.wood -= bn.use + c.fuelWood; c.rates.oil -= c.fuel; c.rates.uranium -= rx.use;
    // food: everyone eats. Short of wheat, nobody new is born; out of wheat, people go hungry and leave.
    const eat = c.people * WH.perPerson;
    c.res.wheat -= eat * dt;
    c.rates.wheat -= eat;
    c.eat = eat;
    c.foodCap = c.prod.wheat / WH.perPerson;      // how many people the fields feed
    const starving = c.res.wheat <= 0;
    if (starving) c.res.wheat = 0;
    c.cap = c.housing;
    if (starving && c.people > c.foodCap) {        // the stores are empty: people drift down to what the fields feed
      c.growth = -Math.max(0.05, (c.people - c.foodCap) * WH.starveShrink);
      c.people = Math.max(c.foodCap, c.people + c.growth * dt);
      c.hungry = true;
    } else if (c.cap > 0 && c.people < c.cap && (c.prod.wheat >= eat || c.res.wheat > eat * 30)) {
      c.hungry = false;
      c.growth = CFG.growthRate * c.people * (1 - c.people / c.cap) + CFG.growthBase;
      if (c.prod.wheat < eat) c.growth = Math.min(c.growth, 0.2);   // living off the stores: slowly
      else c.growth = Math.min(c.growth, (c.foodCap - c.people) * 0.5 + 0.05);   // no faster than the food allows
      c.people = Math.min(c.cap, c.people + Math.max(0, c.growth) * dt);
    } else if (c.people > c.cap + 0.5) {           // more people than the land in reach of its settlements can hold
      c.hungry = false;
      c.growth = -(c.people - c.cap) * CFG.settlement.shrink - 0.05;
      c.people = Math.max(c.cap, c.people + c.growth * dt);
    } else { c.growth = 0; c.hungry = c.prod.wheat < eat; }
    pop += c.people;
  }
  empireOil = game.countries.reduce((a, c) => a + (c.alive ? c.res.oil : 0), 0);
  game.population = pop;
  if (pop > game.peakPop) game.peakPop = pop;
  researchTick(dt, gold);
  militaryTick(dt);

  for (const p of game.pushes) stepPush(p, dt);
  gunStep(dt);
  for (const r of game.raids) stepRaid(r, dt);
  for (const r of game.raids) if (r.done && r.budget >= 0.5) game.nations[r.n].units += r.budget;
  game.raids = game.raids.filter(r => !r.done);
  for (const p of game.pushes) if (p.done && p.budget > 0) { const c = liveCountry(p.country); if (c) c.people += p.budget; }
  game.pushes = game.pushes.filter(p => !p.done);
  for (const a of game.armies) stepArmy(a, dt);
  game.armies = game.armies.filter(a => !a.done);
  for (const cv of game.convoys) stepConvoy(cv, dt);
  game.convoys = game.convoys.filter(cv => !cv.done);
  for (const at of game.attacks) stepAttack(at, dt);
  for (const at of game.attacks) if (at.done) endAttack(at);
  game.attacks = game.attacks.filter(at => !at.done);
  for (const e of game.expeditions) stepExpedition(e, dt);
  game.expeditions = game.expeditions.filter(e => !e.done);
  for (const m of game.missiles) { m.t += dt / m.dur; if (m.t >= 1) { m.done = true; explode(m.x1, m.y1, m); } else if (m.t > 0.45) tryIntercept(m); }
  for (const tr of game.tracers) tr.t += dt / 0.5;
  game.tracers = game.tracers.filter(tr => tr.t < 1);
  game.missiles = game.missiles.filter(m => !m.done);
  for (const b of game.blasts) b.t += dt / b.life;
  game.blasts = game.blasts.filter(b => b.t < 1);
  for (const sc of game.scorch) sc.t += dt / 45;
  game.scorch = game.scorch.filter(sc => sc.t < 1);
  aiTimer += dt; aiFireTimer += dt; supplyTimer += dt;
  if (roadsDirty && Math.abs(game.time - roadsAt) > 1) { const t0 = performance.now(); buildRoads(); game.roadMs = Math.max(game.roadMs || 0, performance.now() - t0); }   // at most once a second
  if (supplyTimer > 1) { supplyTimer = 0; dispatchSupplies(); }
  if (aiFireTimer > 0.5) {
    aiFireTimer = 0; aiFire(); yourMortars();
    for (const b of game.buildings) if (b.dmg) {     // damage mends slowly, and a mending settlement holds more again
      b.dmg = Math.max(0, b.dmg - 0.5 / CFG.hp.repairSec);
      if (b.type === 'settlement') game.landDirty = true;
    }
  }
  if (aiTimer > CFG.ai.think) { aiTimer = 0; for (const n of game.nations) aiThink(n); }
  for (const n of game.nations) {
    if (!n.alive) continue;
    // AI nations mine iron (the tiles their camps work, plus a trickle) into the same kind of capped store as yours
    const have = n.iron ?? CFG.iron.aiStart, cap = n.ironCap || CFG.storage.iron.base;
    n.ironRate = (n.ironTiles || 0) * CFG.prodPerTile.iron + CFG.iron.aiTrickle;
    n.iron = Math.max(have, Math.min(cap, have + n.ironRate * dt));
    aiResearch(n, dt);
    aiTrain(n, dt);
    // and regrow toward their capacity
    if (n.people >= n.cap) { n.growth = 0; continue; }
    n.growth = (CFG.growthRate * n.people * (1 - n.people / n.cap) + CFG.growthBase) * CFG.ai.growth;
    n.people = Math.min(n.cap, n.people + n.growth * dt);
  }
  for (const c of game.countries) c.nLinks = 0;
  for (const L of game.links) {
    const A = countryAt(L.a), B = countryAt(L.b);
    if (A && B && A !== B) { A.nLinks++; B.nLinks++; }
  }
  for (const L of game.links) {
    const A = countryAt(L.a), B = countryAt(L.b), from = L.dir > 0 ? A : B;
    // planes need oil at both ends to fly; ships and trains go at their fuel-allowed speed
    L.grounded = L.kind === 'air' && ((A && A.noOil) || (B && B.noOil));
    const speed = L.grounded ? 0 : linkStats(L.kind, techIn(from)).speed;
    if (!L.out) L.out = { a: emptyBox(), b: emptyBox() };   // out.a: waiting at end a for b; out.b the other way
    if (!L.req) L.req = { a: [], b: [] };
    if (A && B && A !== B) {
      const fa = outputShare(A, B), fb = outputShare(B, A);
      for (const r of CARGO_RES) {
        if (r === 'wheat') continue;               // food stays home: each domain feeds itself (sites can still ask for it)
        const ga = Math.min(Math.max(0, A.res[r]), A.prod[r] * fa * dt), gb = Math.min(Math.max(0, B.res[r]), B.prod[r] * fb * dt);
        if (ga > 0) { A.res[r] -= ga; L.out.a[r] += ga; }
        if (gb > 0) { B.res[r] -= gb; L.out.b[r] += gb; }
        const ra = A.prod[r] * fa, rb = B.prod[r] * fb;
        A.rates[r] += rb - ra; B.rates[r] += ra - rb;
      }
    } else if (A && A === B) {                     // both ends merged into one domain: hand back what was waiting
      for (const r of CARGO_RES) { A.res[r] += L.out.a[r] + L.out.b[r]; L.out.a[r] = L.out.b[r] = 0; }
      for (const e of ['a', 'b']) { for (const q of L.req[e]) deliver(q, A); L.req[e] = []; }
    }
    if (L.cargo === undefined) loadAt(L, L.dir > 0 ? A : B, L.dir > 0 ? B : A, L.dir > 0 ? 'a' : 'b');   // a new link loads at its first stop
    L.t += speed * dt * L.dir;
    const end = L.path.length - 1;
    if (L.t >= end) { L.t = end; L.dir = -1; unloadAt(L, B); loadAt(L, B, A, 'b'); }
    else if (L.t <= 0) { L.t = 0; L.dir = 1; unloadAt(L, A); loadAt(L, A, B, 'a'); }
  }
  for (const f of game.floats) f.t += dt;
  game.floats = game.floats.filter(f => f.t < 2.4);
}

// ---------- saving ----------
let noSave = false;
function saveGame() {
  if (noSave || !game.started || game.over) return;
  try {
    // territory as runs of one code per tile: 0 = nobody, +k = your domain k-1, -k = AI nation k-1
    const runs = [];
    let prev = null, count = 0;
    for (let i = 0; i < N; i++) {
      const v = owner[i] ? countryOf[i] + 1 : aiOf[i] ? -aiOf[i] : 0;
      if (v === prev) count++; else { if (prev !== null) runs.push(prev, count); prev = v; count = 1; }
    }
    runs.push(prev, count);
    // people, supplies and troops still out on a push, expedition, march or attack go back home in the save
    const back = game.countries.map(() => ({ people: 0, ...resBox() }));
    for (const q of game.pushes) { const c = liveCountry(q.country); if (c) back[c.id].people += q.budget; }
    for (const e of game.expeditions) { const c = liveCountry(e.from); if (c) { back[c.id].people += e.n; for (const r in e.kit) back[c.id][r] += e.kit[r]; } }
    for (const cv of game.convoys) { const c = liveCountry(cv.country); if (c && cv.purpose !== 'site') for (const r in cv.cargo) back[c.id][r] += cv.cargo[r] || 0; }
    const homeUnits = new Map();
    const sendHome = (tile, n) => { const b = buildingAt(tile) && owner[tile] ? tile : (garrisons()[0] || {}).i; if (b != null) homeUnits.set(b, (homeUnits.get(b) || 0) + n); };
    for (const a of game.armies) sendHome(a.dest ?? a.home, a.n);
    for (const at of game.attacks) { const g = garrisons()[0]; if (g) sendHome(g.i, at.units); }
    for (const n of game.nations) n._back = 0;
    for (const r of game.raids) game.nations[r.n]._back += r.budget;
    const data = {
      v: SAVE_V, seed: SEED, savedAt: Date.now(), time: game.time, active: game.active, peakPop: game.peakPop,
      sendPct: game.sendPct, troopPct: game.troopPct, recruit: game.recruit, warhead: game.warhead,
      connects: game.connects.map(c => [c.a, c.b]), walls: game.walls.map(w => [w.a, w.b]),
      research: { done: [...game.research.done], cur: game.research.cur, pts: game.research.pts },
      countries: game.countries.map(c => {
        const res = {};
        for (const r of RESOURCES) res[r] = c.res[r] + back[c.id][r];
        return { short: c.short, full: c.full, tier: c.tier, alive: c.alive, mergedInto: c.mergedInto, people: c.people + back[c.id].people, res };
      }),
      nations: game.nations.map(n => ({ people: n.people, alive: n.alive, hostile: !!n.hostile, iron: n.iron ?? CFG.iron.aiStart,
        units: n.units + n._back, R: [...n.R], rpts: n.rpts, pers: n.pers, lastRaid: n.lastRaid ?? null })),
      buildings: game.buildings.map(b => ({ i: b.i, t: b.type, ready: b.ready || 0, units: (b.units || 0) + (homeUnits.get(b.i) || 0), oil: b.oil || 0,
        buf: b.buf && boxSum(b.buf) >= 0.5 ? b.buf : null,
        site: b.site ? { type: b.site.type, need: b.site.need, country: b.site.country, cost: b.site.cost } : null,
        field: b.field != null && deposits[b.field] ? deposits[b.field].tiles : null })),
      links: game.links.map(L => ({ kind: L.kind, a: L.a, b: L.b, path: L.path, t: L.t, dir: L.dir, cargo: L.cargo || null, to: L.to ?? -1, out: L.out || null, req: L.req || null })),
      runs, cam: { x: cam.x, y: cam.y, zoom: cam.zoom },
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    game.savedAt = game.time;
  } catch (e) { console.warn('Autosave failed', e); }
}
// lay a save over the freshly generated (same seed, so same) world
function loadGame(sv) {
  // refuse a save that doesn't fit this version of the game (map size, building types), before touching anything
  const tiles = (sv.runs || []).reduce((a, v, k) => (k % 2 ? a + v : a), 0);
  if (tiles !== N || !Array.isArray(sv.countries) || !sv.countries.length || !Array.isArray(sv.links) ||
      !Array.isArray(sv.buildings) || sv.buildings.some(b => !CFG.buildings[b.t])) throw new Error('save does not fit this version');
  owner.fill(0); countryOf.fill(-1); aiOf.fill(0); building.fill(0); frontier.clear();
  for (const d of deposits) if (d.type === 'wheat') { for (const t of d.tiles) if (depositOf[t] >= 0 && deposits[depositOf[t]] === d) depositOf[t] = -1; d.tiles = []; }
  game.buildings = []; bldVer++; for (const k in game.hubs) game.hubs[k] = []; game.countries = []; game.ownedCount = 0;
  for (const sc of sv.countries) {
    const c = newCountry({ people: sc.people, res: sc.res });
    Object.assign(c, { short: sc.short, full: sc.full, tier: sc.tier, alive: sc.alive, mergedInto: sc.mergedInto });
  }
  game.nations.forEach((n, k) => {
    const sn = sv.nations[k];
    if (!sn) return;
    Object.assign(n, { people: sn.people, alive: sn.alive, hostile: !!sn.hostile, units: sn.units || 0, rpts: sn.rpts || 0, lastRaid: sn.lastRaid ?? undefined });
    if (sn.iron != null) n.iron = sn.iron;
    if (sn.R) n.R = new Set(sn.R);
    if (sn.pers) n.pers = sn.pers;
  });
  const RS = sv.research || {};
  game.research.done = new Set(RS.done || []); game.research.cur = RS.cur || null; game.research.pts = RS.pts || 0;
  let i = 0;
  for (let k = 0; k < sv.runs.length; k += 2) {
    const v = sv.runs[k], n = sv.runs[k + 1];
    for (let j = 0; j < n; j++, i++) {
      if (v > 0) { owner[i] = 1; countryOf[i] = v - 1; game.ownedCount++; } else if (v < 0) aiOf[i] = -v;
    }
  }
  for (const sb of sv.buildings) {
    building[sb.i] = BLD_CODE[sb.t];
    const b = { i: sb.i, type: sb.t };
    if (sb.ready) b.ready = sb.ready;
    if (sb.units) b.units = sb.units;
    if (sb.oil) b.oil = sb.oil;
    if (sb.buf) b.buf = sb.buf;
    if (sb.site) b.site = { ...sb.site, cost: sb.site.cost || {} };   // its delivery (if one was on the way) sets out again
    if (sb.field) {
      b.field = deposits.length;
      const ft = sb.field.filter(t => depositOf[t] < 0);
      deposits.push({ type: 'wheat', tiles: ft, cx: sb.i % W, cy: (sb.i / W) | 0, farm: sb.i });
      for (const t of ft) depositOf[t] = b.field;
    }
    game.buildings.push(b);
    const kind = linkKind(sb.t);
    if (kind && !underway(b)) game.hubs[kind].push(sb.i);
  }
  game.links = sv.links.map(L => ({ ...L, req: L.req || { a: [], b: [] } }));
  for (let t = 0; t < N; t++) {
    if (!owner[t]) continue;
    const x = t % W, y = (t / W) | 0;
    for (const [dx, dy] of DIRS4) {
      if (!inb(x + dx, y + dy)) continue;
      const n = idx(x + dx, y + dy);
      if (!owner[n] && isLand(n)) frontier.add(n);
    }
  }
  Object.assign(game, { time: sv.time, active: sv.active, peakPop: sv.peakPop, sendPct: sv.sendPct || 25, troopPct: sv.troopPct || 50, recruit: sv.recruit !== false, warhead: sv.warhead || 'conventional' });
  game.convoys = []; game.armies = []; game.attacks = [];
  scanNationTiles();
  buildFronts();
  recomputeNetwork();
  paintTerrain();                                  // wheat fields and (if known) oil
  fillLayer.img.data.fill(0); borderLayer.img.data.fill(0);
  for (let t = 0; t < N; t++) if (owner[t] || aiOf[t]) paintTerr(t);
  markDirty(fillLayer, 0, 0); markDirty(fillLayer, W - 1, H - 1); markDirty(borderLayer, 0, 0); markDirty(borderLayer, W - 1, H - 1);
  if (!game.countries.some(c => c.alive && c.tiles)) throw new Error('save has no living domain');
  // roads out to buildings and walls between forts: worked out again over the restored land
  game.connects = []; game.walls = [];
  buildRoads();
  for (const [a, b] of sv.connects || []) { const L = building[a] && makeLine(a, b, sideOf(a), true, 20000); if (L) game.connects.push({ a, b, ...L }); }
  for (const [a, b] of sv.walls || []) { const L = building[a] && building[b] && makeLine(a, b, sideOf(a), false, 20000); if (L) game.walls.push({ a, b, ...L }); }
  markNet();
  for (const b of game.buildings) if (b.site && boxSum(b.site.need) < 0.01) b.site.convoy = false;
  if (sv.cam) Object.assign(cam, sv.cam);
  game.savedAt = game.time;
}
function newGame() {
  noSave = true;                                   // don't let the unload autosave bring the old game back
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* storage blocked: nothing to clear */ }
  location.search = '';
}

// ---------- weapons: mortars (short range, quick) and missile silos (long range, slow, powered) ----------
const weaponOf = b => CFG.weapons[CFG.buildings[b.type].weapon];
const weaponsOf = () => game.buildings.filter(b => owner[b.i] && CFG.buildings[b.type].weapon && !underway(b));
const silosOf = () => game.buildings.filter(b => owner[b.i] && b.type === 'silo' && !underway(b));
function setAiming(on) {
  if (on && !silosOf().length) return toast(isUnlocked('silo') ? 'Build a missile silo first: silos are the weapon you aim (cannons and machine guns fire by themselves)' : `You aim missile silos, which need ${TECH.rocketry.name}. Cannons and machine guns fire by themselves.`);
  game.aiming = on;
  if (on) { setTool(null); toast(say('Aiming: click a target in range · F or Esc to stop', 'Aiming: tap a target in range, then tap it again to fire')); }
}
// which of your weapons would fire at a spot: the lightest one in range that's loaded
function pickWeapon(tx, ty) {
  const inR = silosOf().map(b => ({ b, Wp: weaponOf(b), d: tileDist(b.i, tx, ty) })).filter(o => o.d <= o.Wp.range)
    .sort((p, q) => p.Wp.range - q.Wp.range || p.d - q.d);
  return { inR, ready: inR.find(o => (o.b.ready || 0) <= game.time) };
}
// Air defense: a shot in the back half of its flight is knocked down by the other side's air defense, if one covers
// its target, is loaded and can pay. It bursts in the air and does nothing.
function tryIntercept(m) {
  const A = CFG.airDefense, byYou = m.ai < 0, tx = Math.floor(m.x1), ty = Math.floor(m.y1);
  for (const b of game.buildings) {
    if (b.type !== 'airdef' || (b.ready || 0) > game.time) continue;
    if (byYou ? !aiOf[b.i] : !owner[b.i]) continue;               // only the side being shot at defends
    if (tileDist(b.i, tx, ty) > A.range) continue;
    if (byYou) {
      const n = game.nations[aiOf[b.i] - 1];
      if ((n.iron || 0) < A.cost.iron) continue;
      n.iron -= A.cost.iron; b.rd = A.reload;
    } else {
      const C = countryAt(b.i);
      if (!C || C.res.iron < A.cost.iron) continue;
      C.res.iron -= A.cost.iron; b.rd = A.reload / Math.max(0.25, C.sat);
    }
    b.ready = game.time + b.rd;
    const gx = lerp(m.x0, m.x1, m.t), gy = lerp(m.y0, m.y1, m.t);
    const air = { dist: Math.hypot(m.x1 - m.x0, m.y1 - m.y0), arc: CFG.weapons[m.w].arc, e: m.t };   // how high up it was
    game.blasts.push({ x: gx, y: gy, t: 0, R: 0.4, life: 0.8, big: false, seed: (gx * 13 + gy * 7) | 0, air });
    game.tracers.push({ x0: b.i % W + 0.5, y0: ((b.i / W) | 0) + 0.5, x1: gx, y1: gy, air, t: 0 });
    floatText(gx, gy - 2.5, byYou ? 'Shot down' : 'Intercepted', byYou ? '#ff7a6b' : '#7bd389');
    m.done = true;
    return;
  }
}
// Your mortars pick their own targets: the buildings of nations at war with you, weapons and defenses first,
// then everything else, and settlements last (never ruins). They hold fire below the iron reserve.
function yourMortars() {
  const Wp = CFG.weapons.shell;
  let theirs = null;
  for (const b of game.buildings) {
    if (b.type !== 'mortar' || !owner[b.i] || (b.ready || 0) > game.time) continue;
    const C = countryAt(b.i);
    if (!C || C.res.iron < Wp.cost.iron + CFG.mortarReserve) continue;
    theirs = theirs || game.buildings.filter(q => aiOf[q.i] && game.nations[aiOf[q.i] - 1].hostile && !isRuin(q));
    const bx = b.i % W, by = (b.i / W) | 0;
    let tgt = null, best = Infinity;
    for (const q of theirs) {
      const d = tileDist(q.i, bx, by);
      if (d > Wp.range) continue;
      const def = CFG.buildings[q.type], score = d + (def.weapon || def.defense || def.gun ? 0 : q.type === 'settlement' ? 200 : 100);
      if (score < best) { best = score; tgt = q; }
    }
    if (!tgt) continue;
    C.res.iron -= Wp.cost.iron;
    b.rd = Wp.reload; b.ready = game.time + b.rd;
    launchShot(b, ...tileCenter(tgt.i), 'shell');
  }
}
// Gun turrets: each one thins out an enemy push whose front is within its range, a few soldiers every tick,
// paying a little iron per soldier. Yours shoot nations' waves; theirs shoot your pushes.
function gunStep(dt) {
  const T = CFG.turret;
  for (const b of game.buildings) {
    if (b.type !== 'turret') continue;
    const bx = b.i % W + 0.5, by = ((b.i / W) | 0) + 0.5, mine = !!owner[b.i];
    if (!mine && !aiOf[b.i]) continue;
    const waves = mine ? game.raids : game.attacks, key = mine ? 'budget' : 'units';
    for (const w of waves) {
      if (w.done || w.lx == null || w[key] <= 0 || (!mine && w.nation !== aiOf[b.i] - 1) || Math.hypot(w.lx - bx, w.ly - by) > T.range) continue;
      const kill = Math.min(w[key], T.kills * dt * 0.25), cost = kill * T.iron * 4;
      if (mine) { const C = countryAt(b.i); if (!C || C.res.iron < cost) break; C.res.iron -= cost; }
      else { const n = game.nations[aiOf[b.i] - 1]; if (!n.alive || (n.iron || 0) < cost) break; n.iron -= cost; }
      w[key] -= kill;
      if (!mine) w.lost = (w.lost || 0) + kill; else w.killed = (w.killed || 0) + kill;
      b.fire = game.time; b.aim = [w.lx, w.ly];
      b.acc = (b.acc || 0) + kill;
      if (b.acc >= 5) { floatText(w.lx, w.ly - 1.2, `-${Math.round(b.acc)}`, mine ? '#7bd389' : '#ff7a6b'); b.acc = 0; }
      break;                                       // one target at a time
    }
  }
}
function launchShot(b, x1, y1, w, nation = null, nuke = false) {
  const Wp = CFG.weapons[w], [x0, y0] = tileCenter(b.i);
  game.missiles.push({ x0, y0, x1, y1, t: 0, dur: Math.max(0.6, Math.hypot(x1 - x0, y1 - y0) / Wp.speed) * (nuke ? 1.3 : 1), w, ai: nation ? nation.id : -1, nuke });
}
function fireMissile(tx, ty) {
  const { inR, ready } = pickWeapon(tx, ty);
  if (!inR.length) return toast(`Out of range: missile silos reach ${CFG.weapons.missile.range} tiles`);
  if (!ready) return toast(`Reloading: ${Math.ceil(Math.min(...inR.map(o => o.b.ready)) - game.time)}s`);
  const s = ready.b, Wp = ready.Wp, C = countryAt(s.i);
  const nuke = game.warhead === 'nuke' && Wp === CFG.weapons.missile && game.research.done.has('nukes');
  const cost = nuke ? CFG.nuke.cost : Wp.cost, miss = missingFor(cost, C);
  if (miss) return toast(`${C.short} doesn't have enough ${miss} for a ${nuke ? 'nuclear missile' : Wp.name.toLowerCase()} (needs ${Object.entries(cost).map(([r, n]) => `${n} ${r}`).join(', ')})`);
  for (const [r, n] of Object.entries(cost)) C.res[r] -= n;
  if (nuke) { s.ready = game.time + Wp.reload * 3; launchShot(s, tx + 0.5, ty + 0.5, 'missile', null, true); toast('Nuclear missile launched.'); return; }
  // a powered weapon reloads slower when its country is short of power
  s.rd = Wp.reload / (CFG.buildings[s.type].use ? Math.max(0.25, C.sat) : 1);
  s.ready = game.time + s.rd;
  launchShot(s, tx + 0.5, ty + 0.5, CFG.buildings[s.type].weapon);
}
function removeBuilding(i) {
  const b = buildingAt(i);
  if (!b) return;
  building[i] = 0;
  game.buildings.splice(game.buildings.indexOf(b), 1);
  bldVer++;
  for (const arr of Object.values(game.hubs)) { const k = arr.indexOf(i); if (k >= 0) arr.splice(k, 1); }
  for (const L of game.links) if ((L.a === i || L.b === i) && L.cargo && L.cargo.req) {   // goods aboard a lost link go home
    const C = countryAt(L.a === i ? L.b : L.a);
    if (C) for (const q of L.cargo.req) for (const r in q.res) C.res[r] += q.res[r];
  }
  game.links = game.links.filter(L => L.a !== i && L.b !== i);
  unsowFields(b);
  planCache.key = null; graphVer++;
  if (b.type === 'settlement') roadsDirty = true;
  if (b.type === 'fort' || game.connects.some(c => c.a === i)) markNet();
}
const everyone = () => game.countries.reduce((a, c) => a + (c.alive ? c.people : 0), 0) + game.nations.reduce((a, n) => a + n.people, 0);
// A settlement that is destroyed or captured takes its share of its country's people with it.
// (A nation's people are simply cut down to its new capacity when its buildings are recounted.)
// `frac` = the share of the people living there who are lost (1 = all of them; a hit that doesn't destroy it takes fewer)
function loseSettlement(i, frac = 1) {
  const b = buildingAt(i), who = countryAt(i) || nationAt(i);
  if (!b || b.type !== 'settlement' || !who || who.cap <= 0) return;
  who.people -= Math.min(who.people, who.people * settlementCap(b) / who.cap * frac);
}
function explode(x, y, m) {
  const Wp0 = CFG.weapons[m.w], Wp = m.nuke ? { ...Wp0, radius: CFG.nuke.radius, damage: CFG.nuke.damage } : Wp0;
  const R = Wp.radius, cx = Math.floor(x), cy = Math.floor(y), before = everyone();
  if (m.nuke) nukeFallout(x, y, R);
  const foe = m.ai >= 0 ? game.nations[m.ai] : null;
  const hit = new Map();                           // nation or country -> tiles hit
  let wrecked = 0, damaged = 0, ruined = 0;
  for (let dy = -Math.ceil(R); dy <= Math.ceil(R); dy++) for (let dx = -Math.ceil(R); dx <= Math.ceil(R); dx++) {
    if (dx * dx + dy * dy > R * R + 0.5 || !inb(cx + dx, cy + dy)) continue;
    const i = idx(cx + dx, cy + dy);
    if (building[i]) {
      const b = buildingAt(i), hp = hpOf(b), left = hp - (b.dmg || 0);
      if (b.units) b.units *= 0.6;                 // a garrison under fire loses troops
      if (b.type === 'settlement') {               // never wiped off the map: at zero it's a ruin until it mends
        if (left > 0.01) {
          loseSettlement(i, Math.min(1, Wp.damage / left));    // each hit kills its share of the people living there
          b.dmg = Math.min(hp, (b.dmg || 0) + Wp.damage);
          if (b.dmg >= hp) ruined++; else damaged++;
        }
      } else {
        b.dmg = (b.dmg || 0) + Wp.damage;
        if (b.dmg >= hp) { removeBuilding(i); wrecked++; } else damaged++;
      }
    }
    const who = nationAt(i) || countryAt(i);
    if (who) hit.set(who, (hit.get(who) || 0) + 1);
  }
  if (!foe) for (const who of hit.keys()) if (who.col) provoke(who);   // you shelled a nation: that's war
  let lost = 0;                                    // expeditions caught in the blast are gone
  for (const e of game.expeditions) {
    if (e.done || Math.hypot(e.x - x, e.y - y) > R + 0.8) continue;
    e.done = true; lost += Math.floor(e.n);
    if (game.driving === e) game.driving = null;
    toast(foe ? `Your expedition was destroyed by ${foe.full}!` : 'Your expedition was caught in the blast.');
  }
  recomputeBuildings();                            // lost settlements: nations lose the people who lived there
  const killed = Math.round(before - everyone()) + lost;
  game.blasts.push({ x, y, t: 0, R, life: m.nuke ? 3.2 : m.w === 'missile' ? 1.7 : 1.1, big: m.w === 'missile', nuke: !!m.nuke, seed: (x * 31 + y * 17) | 0 });
  game.scorch.push({ x, y, R, t: 0 });
  const parts = [];
  if (killed) parts.push(`${killed} killed`);
  if (wrecked) parts.push(`${wrecked} building${wrecked === 1 ? '' : 's'} destroyed`);
  if (ruined) parts.push(`${ruined} settlement${ruined === 1 ? '' : 's'} in ruins`);
  if (damaged) parts.push(`${damaged} damaged`);
  if (parts.length) floatText(x, y - R - 1.5, parts.join(' · '), '#ff7a6b');
}

function floatText(x, y, text, color) { game.floats.push({ x, y, text, color, t: 0 }); }
// a nuclear blast: besides wrecking every building in reach, it kills the people and troops of whoever lives there,
// in proportion to how much of their land it covers, and burns out the land at its centre
function nukeFallout(x, y, R) {
  const share = new Map();
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    if (dx * dx + dy * dy > R * R || !inb(Math.floor(x) + dx, Math.floor(y) + dy)) continue;
    const i = idx(Math.floor(x) + dx, Math.floor(y) + dy), who = nationAt(i) || countryAt(i);
    if (who) share.set(who, (share.get(who) || 0) + 1);
    if (aiOf[i] && dx * dx + dy * dy < R * R * 0.25) {   // ground zero: nobody's land any more
      const n = game.nations[aiOf[i] - 1];
      n.tiles--; aiOf[i] = 0; n.front && n.front.delete(i); paintTerr(i); if (building[i]) removeBuilding(i);
    }
  }
  for (const [who, t] of share) {
    const f = Math.min(0.8, 3 * t / Math.max(1, who.tiles));
    who.people *= 1 - f;
    if (who.units != null) who.units *= 1 - f;
    if (who.col) provoke(who);
  }
  for (const at of game.attacks) if (Math.hypot(at.lx - x, at.ly - y) < R) at.units *= 0.2;
  for (const r of game.raids) if (r.lx != null && Math.hypot(r.lx - x, r.ly - y) < R) r.budget *= 0.2;
  game.landDirty = true; game.bldDirty = true;
}

// ======================================================================
// terrain image
// ======================================================================
const terrainCanvas = document.createElement('canvas');
let terrainCtx = null;
const SHALLOW = [96, 152, 192], DEEP_SEA = [55, 108, 158];
const GR_LO = [166, 199, 122], GR_HI = [182, 194, 132], HILL = [212, 192, 148];
const DS_A = [231, 210, 152], DS_B = [212, 186, 124];
const MT_LO = [150, 146, 136], MT_HI = [240, 240, 236];
const FOREST_A = [78, 126, 60], FOREST_B = [98, 146, 72], STONE_C = [168, 172, 176], IRON_C = [156, 98, 74];
function tileColor(i) {
  const x = i % W, y = (i / W) | 0, b = biome[i];
  let c;
  if (b === OCEAN) {
    c = mix(SHALLOW, DEEP_SEA, clamp(oceanDist[i] / 16, 0, 1));
  } else if (b === GRASS) {
    const h = clamp((elev[i] - seaLevel) / (mtnLevel - seaLevel), 0, 1);
    c = mix(GR_LO, GR_HI, h);
    if (detail[i] > 0.58 && h > 0.3) c = mix(c, HILL, clamp((detail[i] - 0.58) * 3.5, 0, 0.75));
  } else if (b === DESERT) {
    c = mix(DS_A, DS_B, clamp((detail[i] - 0.3) * 1.6, 0, 1));
  } else if (b === ICE) {
    c = mix([248, 251, 253], [150, 178, 206], clamp(iceT[i] * 0.9 + (detail[i] - 0.5) * 0.4, 0, 1));
    if (detail[i] > 0.62) c = mix(c, [190, 212, 232], 0.7);
  } else {
    const h = clamp((elev[i] - mtnLevel) / (maxElev - mtnLevel + 1e-6), 0, 1);
    c = mix(MT_LO, MT_HI, clamp(h * 1.2 + (detail[i] - 0.5) * 0.5, 0, 1));
  }
  const dep = depositOf[i];
  if (depVisible(dep)) {
    const t = deposits[dep].type;
    if (t === 'forest') c = hash2(x, y, SEED + 1) > 0.5 ? FOREST_A : FOREST_B;
    else if (t === 'stone') c = mix(STONE_C, [120, 124, 128], hash2(x, y, SEED + 2) * 0.5);
    else if (t === 'iron') c = mix(IRON_C, [110, 66, 50], hash2(x, y, SEED + 3) * 0.5);
    else if (t === 'gold') c = mix([226, 190, 70], [176, 140, 40], hash2(x, y, SEED + 4) * 0.6);
    else if (t === 'oil') c = mix([48, 44, 40], [24, 22, 22], hash2(x, y, SEED + 5) * 0.6);
    else if (t === 'uranium') c = mix([96, 150, 70], [60, 96, 50], hash2(x, y, SEED + 6) * 0.6);
    else c = (x + y) % 2 ? [226, 192, 92] : [212, 176, 76];          // wheat, in rows
  }
  const j = (hash2(x, y, SEED + 9) - 0.5) * (b === OCEAN ? 4 : 10);
  return [c[0] + j, c[1] + j, c[2] + j];
}
function paintTerrain() {
  terrainCanvas.width = W; terrainCanvas.height = H;
  const g = terrainCtx = terrainCanvas.getContext('2d');
  const img = g.createImageData(W, H), d = img.data;
  for (let i = 0; i < N; i++) {
    if (biome[i] === VOID) { d[i * 4 + 3] = 0; continue; }   // transparent: space shows through
    const c = tileColor(i), o = i * 4;
    d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}
const px1 = typeof ImageData !== 'undefined' ? new ImageData(1, 1) : null;
function repaintTile(i) {
  if (!terrainCtx || !px1) return;
  const c = tileColor(i);
  px1.data[0] = c[0]; px1.data[1] = c[1]; px1.data[2] = c[2]; px1.data[3] = 255;
  terrainCtx.putImageData(px1, i % W, (i / W) | 0);
}
function revealOil(type = 'oil') {
  for (const d of deposits) if (d.type === type) for (const t of d.tiles) repaintTile(t);
}

// ======================================================================
// camera + rendering
// ======================================================================
const canvas = $('game');
const ctx = canvas.getContext('2d');
let cw = 0, ch = 0, dpr = 1;
// follow: null, or 'moon' to lock the camera onto the moon (its reference frame);
// offX/offY = where you're looking, in the moon's own coordinates; rot = camera rotation (radians)
const cam = { x: 0, y: 0, zoom: CFG.startZoom, follow: null, offX: 0, offY: 0, rot: 0, cos: 1, sin: 0, a0: 0 };
function setCamRot(r) { cam.rot = r; cam.cos = Math.cos(r); cam.sin = Math.sin(r); }
let savedView = null;

function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);   // phones report 3: not worth 2.25x the pixels
  cw = window.innerWidth; ch = window.innerHeight;
  canvas.width = cw * dpr; canvas.height = ch * dpr;
}
// world <-> screen, including camera rotation (only non-zero while locked onto the moon)
const toScreen = (wx, wy) => {
  const dx = (wx - cam.x) * cam.zoom, dy = (wy - cam.y) * cam.zoom;
  return [dx * cam.cos - dy * cam.sin + cw / 2, dx * cam.sin + dy * cam.cos + ch / 2];
};
const toWorld = (sx, sy) => {
  const dx = sx - cw / 2, dy = sy - ch / 2;
  return [(dx * cam.cos + dy * cam.sin) / cam.zoom + cam.x, (-dx * cam.sin + dy * cam.cos) / cam.zoom + cam.y];
};
// draw a 1-px-per-tile world image (terrain, territory) with the camera's pan, zoom and rotation
function drawWorldImage(img) {
  const z = cam.zoom;
  ctx.save();
  ctx.translate(cw / 2, ch / 2); ctx.rotate(cam.rot);
  ctx.drawImage(img, -cam.x * z, -cam.y * z, W * z, H * z);
  ctx.restore();
}
const tileCenter = i => [i % W + 0.5, ((i / W) | 0) + 0.5];
const fitZoom = () => Math.min(cw / W, (ch - 200) / H) * 0.96;

function pill(x, y, text, { bg = 'rgba(20,26,37,0.9)', fg = '#eef2f8', border = null, dot = null, size = 12, bold = 700 } = {}) {
  ctx.font = `${bold} ${size}px 'Segoe UI', Inter, Arial, sans-serif`;
  const tw = ctx.measureText(text).width;
  const w = tw + (dot ? 30 : 20), h = size + 10;
  const left = x - w / 2, top = y - h / 2;
  ctx.beginPath();
  ctx.roundRect(left, top, w, h, h / 2);
  ctx.fillStyle = bg; ctx.fill();
  if (border) { ctx.strokeStyle = border; ctx.lineWidth = 2; ctx.stroke(); }
  if (dot) { ctx.beginPath(); ctx.arc(left + 12, y, 4, 0, Math.PI * 2); ctx.fillStyle = dot; ctx.fill(); }
  ctx.fillStyle = fg; ctx.textBaseline = 'middle';
  ctx.fillText(text, left + (dot ? 21 : 10), y + 0.5);
  return w;
}

// ---------- outer space ----------
const STAR_TILE = 1024;
const starCanvas = document.createElement('canvas');
let starPattern = null;
function makeStars() {
  const S = STAR_TILE;
  starCanvas.width = starCanvas.height = S;
  const g = starCanvas.getContext('2d');
  g.fillStyle = '#04050b'; g.fillRect(0, 0, S, S);
  const r = mulberry32(SEED + 999);
  // faint nebulae (each drawn 9 times so the tile repeats seamlessly)
  const tints = ['96,64,170', '40,96,180', '150,56,128', '30,120,150'];
  for (let k = 0; k < 6; k++) {
    const x = r() * S, y = r() * S, rad = 140 + r() * 260, tint = tints[k % tints.length], a = 0.07 + r() * 0.08;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
      gr.addColorStop(0, `rgba(${tint},${a})`); gr.addColorStop(1, `rgba(${tint},0)`);
      g.fillStyle = gr; g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
    }
  }
  // stars: mostly tiny and dim, a few bright ones with a halo
  for (let k = 0; k < 1300; k++) {
    const x = (r() * S) | 0, y = (r() * S) | 0, b = r();
    const warm = r() < 0.15;
    g.fillStyle = warm ? `rgba(255,226,190,${0.3 + b * 0.7})` : `rgba(215,228,255,${0.2 + b * 0.8})`;
    const sz = b > 0.96 ? 2 : 1;
    g.fillRect(x, y, sz, sz);
    if (b > 0.985) {
      const gr = g.createRadialGradient(x + 1, y + 1, 0, x + 1, y + 1, 6);
      gr.addColorStop(0, 'rgba(220,232,255,0.45)'); gr.addColorStop(1, 'rgba(220,232,255,0)');
      g.fillStyle = gr; g.fillRect(x - 6, y - 6, 14, 14);
    }
  }
  starPattern = ctx.createPattern(starCanvas, 'repeat');
}

function drawSpace(z) {
  // stars drift slowly as you pan (parallax), so they feel far away.
  // Locked onto the moon, they hold still: you're standing in the moon's frame,
  // so only your own panning around it moves them.
  const S = STAR_TILE;
  const px = cam.follow ? cam.offX : cam.x, py = cam.follow ? cam.offY : cam.y;
  const ox = (((-px * z * 0.1) % S) + S) % S, oy = (((-py * z * 0.1) % S) + S) % S;
  ctx.save(); ctx.translate(ox, oy);
  ctx.fillStyle = starPattern; ctx.fillRect(-ox, -oy, cw, ch);
  ctx.restore();
  // a soft atmospheric glow hugging the rim of the disk
  const [dx, dy] = toScreen(DISK.cx, DISK.cy), R = DISK.R * z;
  const gr = ctx.createRadialGradient(dx, dy, R * 0.97, dx, dy, R * 1.1);
  gr.addColorStop(0, 'rgba(170,210,255,0.42)'); gr.addColorStop(0.35, 'rgba(120,170,255,0.14)'); gr.addColorStop(1, 'rgba(120,170,255,0)');
  ctx.fillStyle = gr;
  ctx.beginPath(); ctx.arc(dx, dy, R * 1.1, 0, Math.PI * 2); ctx.fill();
}

// ---------- the moon ----------
const MOON = {
  r: CFG.moon.radius, size: CFG.moon.radius * 2 + 6,
  orbitR: DISK.R * CFG.moon.orbit, period: CFG.moon.period,
  phase: hash2(SEED, 7, 77) * Math.PI * 2,
};
const moonCanvas = document.createElement('canvas');
// per-pixel moon biome (0 = basalt plains, 1 = highlands, 255 = off the moon), for hover info
const moonBiome = new Uint8Array(MOON.size * MOON.size);
const MOON_BIOME_NAME = ['Basalt plains', 'Highlands'];

// The moon is generated from the same seed as the disk, so a seed always gives the same pair.
// It's built as a height map (biomes + mountains + crater bowls and rims) and then lit from
// the upper left, so ridges, crater walls and rims get real light and shadow.
function paintMoon() {
  const S = MOON.size, c0 = S / 2, R = MOON.r;
  moonCanvas.width = moonCanvas.height = S;
  const g = moonCanvas.getContext('2d');
  const img = g.createImageData(S, S), d = img.data;
  const rnd = mulberry32(SEED + 4242), s = SEED + 300;
  const N2 = S * S;
  const hgt = new Float32Array(N2), high = new Float32Array(N2), bio = new Float32Array(N2);
  const inside = i => moonBiome[i] !== 255;
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  // 1) biome field. Real maria are lava that filled giant round impact basins, so the plains
  //    collect in a few big basins with ragged edges, plus some looser patches.
  const basins = [];
  for (let k = 0; k < 6; k++) {
    const a = rnd() * Math.PI * 2, dist = Math.sqrt(rnd()) * R * 0.75;
    basins.push({ x: c0 + Math.cos(a) * dist, y: c0 + Math.sin(a) * dist, r: R * (0.18 + rnd() * 0.28) });
  }
  const vals = [];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x;
    if (Math.hypot(x + 0.5 - c0, y + 0.5 - c0) > R) { moonBiome[i] = 255; continue; }
    moonBiome[i] = 0;
    const wx = x + (fbm(x / 40, y / 40, s + 7, 3) - 0.5) * 34;
    const wy = y + (fbm(x / 40, y / 40, s + 8, 3) - 0.5) * 34;
    let basin = 0;
    for (const bs of basins) basin = Math.max(basin, 1 - Math.hypot(wx - bs.x, wy - bs.y) / bs.r);
    bio[i] = fbm(wx / 62, wy / 62, s + 2, 4) * 0.55 - clamp(basin, 0, 1) * 0.45;
    vals.push(bio[i]);
  }
  vals.sort((a, b) => a - b);
  const level = vals[Math.floor(vals.length * CFG.moon.plainsShare)];

  // 2) height: rugged ridges + hills on the highlands, nearly flat plains with faint wrinkles
  for (let i = 0; i < N2; i++) {
    if (!inside(i)) continue;
    const x = i % S, y = (i / S) | 0;
    const h = smooth(level - 0.025, level + 0.035, bio[i]);       // crisp: for colour and biome
    const hh = smooth(level - 0.08, level + 0.16, bio[i]);        // gentle: for height, so basin edges are soft slopes
    high[i] = h;
    moonBiome[i] = h > 0.5 ? 1 : 0;
    const ridge = 1 - Math.abs(2 * fbm(x / 15, y / 15, s + 5, 4) - 1);
    const hills = fbm(x / 7, y / 7, s + 6, 3);
    const wrinkles = 1 - Math.abs(2 * fbm(x / 22, y / 22, s + 9, 3) - 1);
    hgt[i] = hh * (0.05 + 0.1 * ridge * ridge + 0.08 * hills) + (1 - hh) * (0.035 * wrinkles * wrinkles + 0.01 * hills);
  }

  // 3) craters: dense on the old highlands, sparse on the younger plains
  const craters = [];
  for (let tries = 0; craters.length < CFG.moon.craters && tries < CFG.moon.craters * 20; tries++) {
    const a = rnd() * Math.PI * 2, dist = Math.sqrt(rnd()) * R * 0.97;
    const cx = c0 + Math.cos(a) * dist, cy = c0 + Math.sin(a) * dist;
    let cr = 1.2 + Math.pow(rnd(), 5) * 28;
    if (moonBiome[(cy | 0) * S + (cx | 0)] === 0) {          // plains are young: few craters, all small
      if (rnd() > 0.18) continue;
      cr = Math.min(cr, 5);
    }
    craters.push({ x: cx, y: cy, r: cr });
  }
  for (const c of craters) {
    const depth = 0.035 + 0.009 * c.r, ext = Math.ceil(c.r * 1.4);
    for (let y = Math.max(0, (c.y | 0) - ext); y <= Math.min(S - 1, (c.y | 0) + ext); y++)
      for (let x = Math.max(0, (c.x | 0) - ext); x <= Math.min(S - 1, (c.x | 0) + ext); x++) {
        const i = y * S + x;
        if (!inside(i)) continue;
        const dd = Math.hypot(x - c.x, y - c.y) / c.r;
        if (dd < 1) {
          hgt[i] = hgt[i] * dd - depth * (1 - dd * dd);                                     // bowl (flattens terrain inside)
          if (c.r > 11 && dd < 0.22) hgt[i] += depth * 0.55 * (1 - dd / 0.22);            // central peak in big craters
        } else if (dd < 1.38) hgt[i] += depth * 0.4 * Math.max(0, 1 - Math.abs(dd - 1.1) / 0.28); // raised rim
      }
  }
  // a few young craters throw bright rays across the surface
  const young = craters.filter(c => c.r > 7).sort(() => rnd() - 0.5).slice(0, 3);

  // 4) light it and colour it
  const PLAINS = [104, 103, 104], HIGH = [198, 196, 191];
  for (let i = 0; i < N2; i++) {
    const o = i * 4;
    if (!inside(i)) { d[o + 3] = 0; continue; }
    const x = i % S, y = (i / S) | 0;
    // slope measured over 2 px for smoother, softer light from the upper left
    const a = (x > 1 && y > 1 && inside(i - 2 * S - 2)) ? hgt[i - 2 * S - 2] : hgt[i];
    const b = (x < S - 2 && y < S - 2 && inside(i + 2 * S + 2)) ? hgt[i + 2 * S + 2] : hgt[i];
    const shade = clamp(1 + (a - b) * 2.3, 0.64, 1.3);
    let col = mix(PLAINS, HIGH, high[i]);
    const fine = fbm(x / 4, y / 4, s + 1, 2);
    col = mix(col, [col[0] * 0.9, col[1] * 0.9, col[2] * 0.9], fine * 0.45);
    col = [col[0] * shade, col[1] * shade, col[2] * shade];
    for (let k = 0; k < young.length; k++) {
      const c = young[k], dx = x - c.x, dy = y - c.y, dist = Math.hypot(dx, dy);
      if (dist < c.r * 1.15 || dist > c.r * 8) continue;
      const ang = Math.atan2(dy, dx);
      const n = vnoise(Math.cos(ang) * 5 + k * 13, Math.sin(ang) * 5, s + 40 + k);   // seamless around the circle
      const streak = Math.pow(clamp((n - 0.55) * 2.6, 0, 1), 2) * (1 - dist / (c.r * 8));
      col = mix(col, [228, 227, 224], streak * 0.6);
    }
    const dist = Math.hypot(x + 0.5 - c0, y + 0.5 - c0);
    col = mix(col, [0, 0, 0], 0.25 * Math.pow(dist / R, 4));   // darker toward the edge
    const j = (hash2(x, y, s + 3) - 0.5) * 7;
    d[o] = clamp(col[0] + j, 0, 255); d[o + 1] = clamp(col[1] + j, 0, 255); d[o + 2] = clamp(col[2] + j, 0, 255); d[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}

// ---------- the sun ----------
const SUN = {
  r: DISK.R * CFG.sun.radius, dist: MOON.orbitR * CFG.sun.distance, year: CFG.sun.year,
  phase: hash2(SEED, 9, 99) * Math.PI * 2,
};
const sunCanvas = document.createElement('canvas');

function paintSun() {
  const S = 256, c0 = S / 2, R = S / 2 - 2;
  sunCanvas.width = sunCanvas.height = S;
  const g = sunCanvas.getContext('2d');
  const img = g.createImageData(S, S), d = img.data;
  const rnd = mulberry32(SEED + 777), s = SEED + 900;
  const spots = [];
  for (let k = 0; k < 5; k++) {
    const a = rnd() * Math.PI * 2, dist = Math.sqrt(rnd()) * R * 0.7;
    spots.push({ x: c0 + Math.cos(a) * dist, y: c0 + Math.sin(a) * dist, r: 2 + rnd() * 5 });
  }
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const o = (y * S + x) * 4, dist = Math.hypot(x + 0.5 - c0, y + 0.5 - c0);
    if (dist > R) { d[o + 3] = 0; continue; }
    const t = dist / R, limb = Math.sqrt(1 - t * t);              // bright centre, deep orange edge
    let col = mix([255, 140, 40], [255, 247, 220], Math.pow(limb, 0.55));
    const k = 0.9 + (fbm(x / 3, y / 3, s, 3) - 0.5) * 0.32;     // granulation: boiling surface cells
    col = [col[0] * k, col[1] * k, col[2] * k];
    for (const sp of spots) {                                    // sunspots
      const dd = Math.hypot(x - sp.x, y - sp.y) / sp.r;
      if (dd < 1) col = mix(col, [110, 45, 18], 0.8 * (1 - dd * dd));
      else if (dd < 1.7) col = mix(col, [205, 110, 40], 0.35 * (1 - (dd - 1) / 0.7));
    }
    d[o] = clamp(col[0], 0, 255); d[o + 1] = clamp(col[1], 0, 255); d[o + 2] = clamp(col[2], 0, 255); d[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}

// The world is centred on the disk, so the sun sits opposite the disk's position on its orbit.
function sunPos() {
  const a = SUN.phase + (game.time / SUN.year) * Math.PI * 2;
  return [DISK.cx - Math.cos(a) * SUN.dist, DISK.cy - Math.sin(a) * SUN.dist, a];
}
function overSun(wx, wy) {
  const [sx, sy] = sunPos();
  return Math.hypot(wx - sx, wy - sy) < Math.max(SUN.r, 24 / cam.zoom);
}

// ---------- Vulcan: a lava hellscape between the sun and your world ----------
const VULCAN = {
  r: DISK.R * CFG.vulcan.size, tex: 2,      // tex: tiles per texture pixel (keeps generation fast)
  orbit: SUN.dist * CFG.vulcan.orbit, year: CFG.vulcan.year, spinPeriod: CFG.vulcan.spin,
  phase: hash2(SEED, 11, 111) * Math.PI * 2,
};
VULCAN.texR = VULCAN.r / VULCAN.tex;
VULCAN.size = Math.ceil(VULCAN.texR * 2) + 6;
const vulcanCanvas = document.createElement('canvas');
const vulcanGlow = document.createElement('canvas');     // lava light, drawn on top so it glows on the night side
const vulcanBiome = new Uint8Array(VULCAN.size * VULCAN.size);
const VB = { LAVA: 0, OBSIDIAN: 1, ASH: 2, SULFUR: 3, METAL: 4, VOLCANO: 5 };
const VULCAN_BIOME_NAME = ['Lava sea', 'Obsidian plains', 'Ash wastes', 'Sulfur flats', 'Heavy-metal ridges', 'Volcano'];

function paintVulcan() {
  const S = VULCAN.size, c0 = S / 2, R = VULCAN.texR, N2 = S * S;
  vulcanCanvas.width = vulcanCanvas.height = S;
  vulcanGlow.width = vulcanGlow.height = S;
  const g = vulcanCanvas.getContext('2d'), gg = vulcanGlow.getContext('2d');
  const img = g.createImageData(S, S), d = img.data, gimg = gg.createImageData(S, S), gd = gimg.data;
  const rnd = mulberry32(SEED + 5151), s = SEED + 1300;

  // volcanoes: big cones scattered across the surface
  const volc = [];
  for (let k = 0; k < 9; k++) {
    const a = rnd() * Math.PI * 2, dist = Math.sqrt(rnd()) * R * 0.85;
    volc.push({ x: c0 + Math.cos(a) * dist, y: c0 + Math.sin(a) * dist, r: R * (0.06 + rnd() * 0.09) });
  }

  // 1) height (warped noise + volcano cones) and distance to the nearest volcano
  const hgt = new Float32Array(N2), near = new Float32Array(N2).fill(99), nearAng = new Float32Array(N2), nearK = new Uint8Array(N2);
  const vals = [];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x;
    if (Math.hypot(x + 0.5 - c0, y + 0.5 - c0) > R) { vulcanBiome[i] = 255; continue; }
    vulcanBiome[i] = 0;
    const wx = x + (fbm(x / 30, y / 30, s + 1, 3) - 0.5) * 24, wy = y + (fbm(x / 30, y / 30, s + 2, 3) - 0.5) * 24;
    let h = fbm(wx / 45, wy / 45, s, 5), cone = 0;
    for (let k = 0; k < volc.length; k++) {
      const v = volc[k], dx = x - v.x, dy = y - v.y, dd = Math.hypot(dx, dy) / v.r;
      if (dd < near[i]) { near[i] = dd; nearAng[i] = Math.atan2(dy, dx); nearK[i] = k; }
      if (dd < 2.2) cone = Math.max(cone, Math.pow(1 - dd / 2.2, 1.6));
    }
    h += cone * 0.45;
    hgt[i] = h;
    vals.push(h);
  }
  vals.sort((a, b) => a - b);
  const lavaLevel = vals[Math.floor(vals.length * CFG.vulcan.lavaShare)];
  const H = i => (vulcanBiome[i] === 255 ? null : hgt[i]);

  // 2) biomes, colour, and the glow layer
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x, o = i * 4;
    if (vulcanBiome[i] === 255) { d[o + 3] = 0; gd[o + 3] = 0; continue; }
    const h = hgt[i], nd = near[i];
    const ridge = 1 - Math.abs(2 * fbm(x / 12, y / 12, s + 5, 4) - 1);
    const sulf = fbm(x / 22, y / 22, s + 6, 3), ash = fbm(x / 40, y / 40, s + 7, 3);
    const fine = fbm(x / 3, y / 3, s + 3, 2);
    let b;
    if (nd < 0.2) b = VB.VOLCANO;                                   // caldera
    else if (h < lavaLevel) b = VB.LAVA;
    else if (nd < 1.1) b = VB.VOLCANO;                              // volcano slopes
    else if (sulf > 0.7 || (nd < 2.4 && sulf > 0.57)) b = VB.SULFUR;
    else if (ridge > 0.86 && h > lavaLevel + 0.06) b = VB.METAL;
    else if (ash > 0.5) b = VB.ASH;
    else b = VB.OBSIDIAN;
    vulcanBiome[i] = b;

    // baked relief, lit from the upper left
    const ha = (x > 0 && y > 0 && H(i - S - 1) !== null) ? hgt[i - S - 1] : h;
    const hb = (x < S - 1 && y < S - 1 && H(i + S + 1) !== null) ? hgt[i + S + 1] : h;
    const shade = clamp(1 + (ha - hb) * 5, 0.55, 1.45);
    const lit = c => [c[0] * shade, c[1] * shade, c[2] * shade];

    let col, glow = 0;
    if (b === VB.LAVA) {
      const plate = fbm(x / 10, y / 10, s + 8, 3);
      const crack = Math.abs(fbm(x / 7, y / 7, s + 9, 3) - 0.5) < 0.03;
      const molten = clamp((lavaLevel - h) * 12, 0, 1);              // deeper = more open melt
      if (crack) { col = [255, 196, 84]; glow = 1; }                 // glowing crack between plates
      else if (plate > 0.47 - molten * 0.3) { col = mix([46, 22, 18], [76, 34, 24], fine * 0.6); glow = 0.05; }   // cooled crust plate
      else { col = mix([248, 118, 30], [196, 50, 16], plate); glow = 0.72; }                                    // open melt
    } else if (b === VB.VOLCANO) {
      if (nd < 0.2) { col = [255, 192, 72]; glow = 1; }             // glowing caldera
      else {
        col = lit(mix([48, 38, 36], [72, 56, 50], fine * 0.7));
        if (nd < 0.3) col = lit([92, 70, 60]);                       // crater rim
        // lava flows: meander as they run downhill, and get thinner further from the crater
        const wob = (fbm(x / 9, y / 9, s + 21, 2) - 0.5) * 1.4 * nd;
        const ang = nearAng[i] + wob;
        const flow = vnoise(Math.cos(ang) * 9 + nearK[i] * 17, Math.sin(ang) * 9, s + 20);
        const thr = 0.72 + nd * 0.14;
        if (flow > thr && nd < 1.0) {
          const t = clamp((flow - thr) * 9, 0, 1);
          col = mix(col, [245, 108, 28], t); glow = t * (1 - nd * 0.7);
        }
      }
    } else if (b === VB.SULFUR) {
      const sv = fbm(x / 9, y / 9, s + 15, 3);
      col = sv > 0.5 ? mix([230, 206, 70], [242, 232, 150], (sv - 0.5) * 2) : mix([206, 150, 46], [230, 206, 70], sv * 2);
      if (nd < 2.4) col = mix(col, [172, 192, 72], clamp((2.4 - nd) * 0.2, 0, 0.4));   // greener near the vents
      if (hash2(x, y, s + 11) > 0.985) col = [252, 248, 214];                            // crystals
      col = lit(col);
    } else if (b === VB.METAL) {
      col = mix([132, 68, 44], [80, 58, 52], fine * 0.7);
      if (hash2(x, y, s + 12) > 0.93) col = [214, 216, 226];                             // heavy-metal glints
      col = lit(col);
    } else if (b === VB.ASH) {
      col = lit(mix([124, 116, 110], [98, 92, 88], fine * 0.7));
    } else {
      col = mix([34, 30, 36], [50, 44, 52], fine * 0.7);
      if (Math.abs(fbm(x / 18, y / 18, s + 13, 3) - 0.5) < 0.012) { col = [235, 90, 30]; glow = 0.8; }   // glowing fissure
      else {
        col = lit(col);
        if (shade > 1.25 && hash2(x, y, s + 14) > 0.8) col = mix(col, [150, 150, 172], 0.5);            // glassy glints
      }
    }
    const t = Math.hypot(x + 0.5 - c0, y + 0.5 - c0) / R;
    const limb = 1 - 0.25 * Math.pow(t, 4);
    d[o] = clamp(col[0] * limb, 0, 255); d[o + 1] = clamp(col[1] * limb, 0, 255); d[o + 2] = clamp(col[2] * limb, 0, 255); d[o + 3] = 255;
    if (glow > 0.05) { gd[o] = 255; gd[o + 1] = 110 + 70 * glow; gd[o + 2] = 30; gd[o + 3] = clamp(glow * 200, 0, 255); }
    else gd[o + 3] = 0;
  }
  g.putImageData(img, 0, 0);
  gg.putImageData(gimg, 0, 0);
}

// Vulcan orbits the sun; it also spins on its own axis
function vulcanPos() {
  const [sx, sy] = sunPos();
  const b = VULCAN.phase + (game.time / VULCAN.year) * Math.PI * 2;
  return [sx + Math.cos(b) * VULCAN.orbit, sy + Math.sin(b) * VULCAN.orbit, (game.time / VULCAN.spinPeriod) * Math.PI * 2];
}
function overVulcan(wx, wy) {
  const [vx, vy] = vulcanPos();
  return Math.hypot(wx - vx, wy - vy) < Math.max(VULCAN.r, 24 / cam.zoom);
}
function vulcanBiomeAt(wx, wy) {
  const [vx, vy, spin] = vulcanPos();
  const dx = wx - vx, dy = wy - vy, c = Math.cos(-spin), sn = Math.sin(-spin);
  const lx = Math.floor((dx * c - dy * sn) / VULCAN.tex + VULCAN.size / 2);
  const ly = Math.floor((dx * sn + dy * c) / VULCAN.tex + VULCAN.size / 2);
  if (lx < 0 || ly < 0 || lx >= VULCAN.size || ly >= VULCAN.size) return null;
  const b = vulcanBiome[ly * VULCAN.size + lx];
  return b === 255 ? null : VULCAN_BIOME_NAME[b];
}

function drawVulcan(z) {
  const [vx, vy, spin] = vulcanPos();
  const [sx, sy] = toScreen(vx, vy), rr = VULCAN.r * z;
  // its orbit around the sun (faint red dashed ring) when zoomed far out
  if (z < 0.01) {
    const [cx, cy] = toScreen(...sunPos().slice(0, 2));
    ctx.setLineDash([4, 10]); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,120,80,0.22)';
    ctx.beginPath(); ctx.arc(cx, cy, VULCAN.orbit * z, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  }
  const haloR = Math.max(rr * 1.2, 18);
  if (sx + haloR < 0 || sy + haloR < 0 || sx - haloR > cw || sy - haloR > ch) return;
  // hot, hazy atmosphere glow
  const gl = ctx.createRadialGradient(sx, sy, Math.max(rr * 0.95, 2), sx, sy, haloR);
  gl.addColorStop(0, 'rgba(255,110,50,0.38)'); gl.addColorStop(1, 'rgba(255,110,50,0)');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(sx, sy, haloR, 0, Math.PI * 2); ctx.fill();
  if (rr < 5) {
    ctx.fillStyle = '#d9653a'; ctx.beginPath(); ctx.arc(sx, sy, Math.max(rr, 3.5), 0, Math.PI * 2); ctx.fill();
    pill(sx, sy + 22, 'Vulcan', { fg: '#ffb08a', size: 12 });
    return;
  }
  const scale = VULCAN.tex * z, half = VULCAN.size / 2 * scale;
  ctx.save();
  ctx.translate(sx, sy); ctx.rotate(spin + cam.rot);
  ctx.imageSmoothingEnabled = scale < 1.5;
  ctx.drawImage(vulcanCanvas, -half, -half, half * 2, half * 2);
  ctx.restore();
  // day/night from the sun's direction
  const [ssx, ssy] = toScreen(...sunPos().slice(0, 2));
  let ldx = ssx - sx, ldy = ssy - sy;
  const ll = Math.hypot(ldx, ldy) || 1; ldx /= ll; ldy /= ll;
  ctx.save();
  ctx.beginPath(); ctx.arc(sx, sy, rr, 0, Math.PI * 2); ctx.clip();
  const lg = ctx.createLinearGradient(sx + ldx * rr, sy + ldy * rr, sx - ldx * rr * 1.4, sy - ldy * rr * 1.4);
  lg.addColorStop(0, 'rgba(0,0,12,0)'); lg.addColorStop(0.45, 'rgba(0,0,12,0.15)'); lg.addColorStop(0.75, 'rgba(0,0,12,0.6)'); lg.addColorStop(1, 'rgba(0,0,12,0.88)');
  ctx.fillStyle = lg; ctx.fillRect(sx - rr, sy - rr, rr * 2, rr * 2);
  ctx.restore();
  // lava light on top, so the lava still glows on the night side
  ctx.save();
  ctx.translate(sx, sy); ctx.rotate(spin + cam.rot);
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.85;
  ctx.imageSmoothingEnabled = scale < 1.5;
  ctx.drawImage(vulcanGlow, -half, -half, half * 2, half * 2);
  ctx.restore();
  ctx.imageSmoothingEnabled = true;
  if (rr < 160) pill(sx, sy + rr + 22, 'Vulcan', { fg: '#ffb08a', size: 12 });
}

// your world can be clicked to lock on when it's small on screen, or while you're locked onto
// the moon or the sun (up close, clicks on your land still push your border)
const WORLD_LOCK_ZOOM = 0.15;
function worldLockable() { return !!cam.follow || cam.zoom < WORLD_LOCK_ZOOM; }
function overWorld(wx, wy) {
  return Math.hypot(wx - DISK.cx, wy - DISK.cy) < Math.max(DISK.R, 24 / cam.zoom);
}

function drawSun(z) {
  const [wx, wy] = sunPos();
  const [sx, sy] = toScreen(wx, wy), rr = SUN.r * z;
  // your world's orbit around the sun (faint dashed ring), when zoomed far enough out to matter
  if (z < 0.03) {
    ctx.setLineDash([4, 10]); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,205,130,0.22)';
    ctx.beginPath(); ctx.arc(sx, sy, SUN.dist * z, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  }
  const glowR = Math.max(rr * 3.2, 28);
  if (sx + glowR < 0 || sy + glowR < 0 || sx - glowR > cw || sy - glowR > ch) return;
  // corona glow (additive, so it brightens the stars behind it)
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const gl = ctx.createRadialGradient(sx, sy, Math.max(rr * 0.9, 2), sx, sy, glowR);
  gl.addColorStop(0, 'rgba(255,190,90,0.6)'); gl.addColorStop(0.3, 'rgba(255,150,60,0.2)'); gl.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(sx, sy, glowR, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (rr < 4) {
    ctx.fillStyle = '#fff3d0'; ctx.beginPath(); ctx.arc(sx, sy, 4, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(game.time / 200);   // slow spin
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(sunCanvas, -rr * 128 / 126, -rr * 128 / 126, rr * 256 / 126, rr * 256 / 126);
    ctx.restore();
  }
  if (rr < 160) pill(sx, sy + Math.max(rr, 4) + 24, 'The Sun', { fg: '#ffe2a8', size: 12 });
}

// which moon biome is under a world point (null if none)
function moonBiomeAt(wx, wy) {
  const [mx, my, a] = moonPos();
  const dx = wx - mx, dy = wy - my, c = Math.cos(-a), sn = Math.sin(-a);
  const lx = Math.floor(dx * c - dy * sn + MOON.size / 2), ly = Math.floor(dx * sn + dy * c + MOON.size / 2);
  if (lx < 0 || ly < 0 || lx >= MOON.size || ly >= MOON.size) return null;
  const b = moonBiome[ly * MOON.size + lx];
  return b === 255 ? null : MOON_BIOME_NAME[b];
}

function moonPos() {
  const a = MOON.phase + (game.time / MOON.period) * Math.PI * 2;
  return [DISK.cx + Math.cos(a) * MOON.orbitR, DISK.cy + Math.sin(a) * MOON.orbitR, a];
}

function drawMoon(z) {
  if (MOON.orbitR * z < 6) return;   // from far out it would just sit on top of your world
  const [mx, my, a] = moonPos();
  const [sx, sy] = toScreen(mx, my), rr = MOON.r * z;
  // faint orbit line when zoomed out
  if (z < 1.6) {
    const [cx, cy] = toScreen(DISK.cx, DISK.cy);
    ctx.setLineDash([3, 10]); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(200,215,255,0.2)';
    ctx.beginPath(); ctx.arc(cx, cy, MOON.orbitR * z, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  }
  if (sx + rr * 1.2 < 0 || sy + rr * 1.2 < 0 || sx - rr * 1.2 > cw || sy - rr * 1.2 > ch) return;
  if (rr < 5) {
    // so far out the moon is just a speck: draw a small glowing dot so it can still be found
    const gd = ctx.createRadialGradient(sx, sy, 0, sx, sy, 12);
    gd.addColorStop(0, 'rgba(225,230,240,0.5)'); gd.addColorStop(1, 'rgba(225,230,240,0)');
    ctx.fillStyle = gd; ctx.beginPath(); ctx.arc(sx, sy, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c9ccd4'; ctx.beginPath(); ctx.arc(sx, sy, Math.max(rr, 3.5), 0, Math.PI * 2); ctx.fill();
    if (z > 0.006) pill(sx, sy + 22, 'The Moon', { fg: '#dfe4ee', size: 12 });
    return;
  }
  // soft glow
  const gl = ctx.createRadialGradient(sx, sy, rr * 0.95, sx, sy, rr * 1.18);
  gl.addColorStop(0, 'rgba(225,230,240,0.28)'); gl.addColorStop(1, 'rgba(225,230,240,0)');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(sx, sy, rr * 1.18, 0, Math.PI * 2); ctx.fill();
  // body: tidally locked, so it turns as it orbits and the same face always points at the disk
  ctx.save();
  ctx.translate(sx, sy); ctx.rotate(a + cam.rot);   // while locked on, cam.rot cancels the spin exactly
  ctx.imageSmoothingEnabled = z < 1.5;
  ctx.drawImage(moonCanvas, -MOON.size / 2 * z, -MOON.size / 2 * z, MOON.size * z, MOON.size * z);
  ctx.restore();
  // sunlight comes from the actual sun, so the day/night shadow swings round as the moon orbits (phases)
  const [ssx, ssy] = toScreen(...sunPos().slice(0, 2));
  let ldx = ssx - sx, ldy = ssy - sy;
  const ll = Math.hypot(ldx, ldy) || 1; ldx /= ll; ldy /= ll;
  ctx.save();
  ctx.beginPath(); ctx.arc(sx, sy, rr, 0, Math.PI * 2); ctx.clip();
  const lg = ctx.createLinearGradient(sx + ldx * rr, sy + ldy * rr, sx - ldx * rr * 1.4, sy - ldy * rr * 1.4);
  lg.addColorStop(0, 'rgba(0,0,12,0)'); lg.addColorStop(0.45, 'rgba(0,0,12,0.12)'); lg.addColorStop(0.75, 'rgba(0,0,12,0.5)'); lg.addColorStop(1, 'rgba(0,0,12,0.82)');
  ctx.fillStyle = lg; ctx.fillRect(sx - rr, sy - rr, rr * 2, rr * 2);
  ctx.restore();
  ctx.imageSmoothingEnabled = true;
  if (z < 2.5) pill(sx, sy + Math.max(rr, 4) + 18, 'The Moon', { fg: '#dfe4ee', size: 12 });
}

// when the disk is only a few pixels wide, label it so you can find home
function drawDiskLabel(z) {
  if (z > 0.15) return;
  const [dx, dy] = toScreen(DISK.cx, DISK.cy);
  if (DISK.R * z < 3) { ctx.fillStyle = '#6fa3d6'; ctx.beginPath(); ctx.arc(dx, dy, 3, 0, Math.PI * 2); ctx.fill(); }
  pill(dx, dy + Math.max(DISK.R * z, 4) + 18, 'Your world', { fg: '#cfe0ff', size: 12 });
}

function overMoon(wx, wy) {
  const [mx, my] = moonPos();
  // at least ~24 px to aim at, so the tiny dot is still easy to click from far out
  return Math.hypot(wx - mx, wy - my) < Math.max(MOON.r, 24 / cam.zoom);
}

// ======================================================================
// the wider solar system: Aries, Zeus, Poseidon and their moons.
// Every body here shares one recipe: an orbit around a parent, a spin, a seeded texture,
// sunlight from the real sun, an optional glow layer (lava), optional rings, hover + lock-on.
// ======================================================================
const BODY = {};
const kepler = orbit => SUN.year * Math.pow(orbit, 1.5);
function makeBody(def) {
  const b = { label: '#e8ecf4', ring: '200,215,255', dot: '#c9ccd4', halo: '220,225,235', ...def };
  b.texR = b.r / b.tex;
  b.size = Math.ceil(b.texR * 2) + 6;
  b.phase = hash2(SEED, b.seedOff, 7) * Math.PI * 2;
  if (b.rings) {                                         // fine ringlets: varying density, with clear gaps
    const rr = mulberry32(SEED + b.seedOff * 31), R = b.rings, n = 46, step = (R.outer - R.inner) / n;
    b.ringlets = [];
    for (let k = 0; k < n; k++) {
      const a1 = R.inner + k * step, a2 = a1 + step * 0.92, mid = (a1 + a2) / 2;
      if (R.gaps.some(([g1, g2]) => mid > g1 && mid < g2)) continue;
      const edge = Math.min(mid - R.inner, R.outer - mid) / (R.outer - R.inner);   // fade at the inner and outer edges
      b.ringlets.push([a1, a2, (0.12 + rr() * 0.38) * Math.min(1, edge * 6), 170 + rr() * 50]);
    }
  }
  BODY[b.id] = b;
  return b;
}
// position = parent position + orbit; spin = own rotation (tidally locked moons turn with their orbit)
function genericPos(b) {
  const [px, py] = b.parent === 'sun' ? sunPos() : genericPos(BODY[b.parent]);
  const a = b.phase + (game.time / b.period) * Math.PI * 2;
  const spin = b.spin === 'locked' ? a : (game.time / b.spin) * Math.PI * 2;
  return [px + Math.cos(a) * b.orbit, py + Math.sin(a) * b.orbit, spin];
}
function genericBiomeAt(b, wx, wy) {
  const [bx, by, spin] = genericPos(b);
  const dx = wx - bx, dy = wy - by, c = Math.cos(-spin), sn = Math.sin(-spin);
  const lx = Math.floor((dx * c - dy * sn) / b.tex + b.size / 2), ly = Math.floor((dx * sn + dy * c) / b.tex + b.size / 2);
  if (lx < 0 || ly < 0 || lx >= b.size || ly >= b.size) return null;
  const v = b.biome[ly * b.size + lx];
  return v === 255 ? null : b.biomes[v];
}

// shared texture painter: calls fn(x, y, u, v, out, i) per pixel; out = [r, g, b, biome, glow]
function paintBody(b, fn, limbK = 0.25) {
  const S = b.size, c0 = S / 2, R = b.texR;
  b.canvas = document.createElement('canvas'); b.canvas.width = b.canvas.height = S;
  const g = b.canvas.getContext('2d'), img = g.createImageData(S, S), d = img.data;
  b.biome = new Uint8Array(S * S).fill(255);
  let gimg = null;
  const out = [0, 0, 0, 0, 0];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x, o = i * 4, t = Math.hypot(x + 0.5 - c0, y + 0.5 - c0) / R;
    if (t > 1) { d[o + 3] = 0; continue; }
    out[3] = 0; out[4] = 0;
    fn(x, y, (x + 0.5 - c0) / R, (y + 0.5 - c0) / R, out, i);
    const limb = 1 - limbK * Math.pow(t, 4);
    d[o] = clamp(out[0] * limb, 0, 255); d[o + 1] = clamp(out[1] * limb, 0, 255); d[o + 2] = clamp(out[2] * limb, 0, 255); d[o + 3] = 255;
    b.biome[i] = out[3];
    if (out[4] > 0.05) {
      if (!gimg) gimg = new ImageData(S, S);
      gimg.data[o] = 255; gimg.data[o + 1] = 110 + 70 * out[4]; gimg.data[o + 2] = 30; gimg.data[o + 3] = clamp(out[4] * 210, 0, 255);
    }
  }
  g.putImageData(img, 0, 0);
  if (gimg) {
    b.glow = document.createElement('canvas'); b.glow.width = b.glow.height = S;
    b.glow.getContext('2d').putImageData(gimg, 0, 0);
  }
}

// ---------- Aries: the red planet ----------
function paintAries(b) {
  const S = b.size, c0 = S / 2, R = b.texR, rnd = mulberry32(SEED + 6161), s = SEED + 1600;
  // one giant shield volcano and a few smaller ones
  const vol = [{ x: c0 + (rnd() - 0.5) * R * 0.9, y: c0 + (rnd() - 0.5) * R * 0.5, r: R * 0.17 }];
  for (let k = 0; k < 3; k++) vol.push({ x: c0 + (rnd() - 0.5) * R * 1.1, y: c0 + (rnd() - 0.5) * R * 0.9, r: R * (0.05 + rnd() * 0.04) });
  // a huge canyon rift
  const ca = (rnd() - 0.5) * 0.6, dir = [Math.cos(ca), Math.sin(ca)], perp = [-dir[1], dir[0]];
  const p0 = [c0 + (rnd() - 0.5) * R * 0.3, c0 + (rnd() - 0.2) * R * 0.35], half = R * 0.6, cw0 = R * 0.045;
  const hgt = new Float32Array(S * S), zone = new Uint8Array(S * S);   // zone: 1 canyon, 2 volcano, 3 caldera
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x;
    if (Math.hypot(x + 0.5 - c0, y + 0.5 - c0) > R) continue;
    let h = fbm(x / 26, y / 26, s, 5) * 0.55;
    for (const v of vol) {
      const dd = Math.hypot(x - v.x, y - v.y) / v.r;
      if (dd < 1.6) {
        h += 0.7 * Math.pow(1 - dd / 1.6, 1.4) * (v.r / (R * 0.17));
        if (dd < 1.05) zone[i] = 2;
        if (dd < 0.14) { zone[i] = 3; h -= 0.12; }
      }
    }
    const qx = x - p0[0], qy = y - p0[1], along = qx * dir[0] + qy * dir[1];
    const across = qx * perp[0] + qy * perp[1] + (fbm(along / 14, 3.3, s + 4, 2) - 0.5) * R * 0.08;
    if (Math.abs(along) < half) {
      const w = cw0 * (1 - Math.pow(along / half, 2) * 0.7);
      if (Math.abs(across) < w) { h -= 0.28 * (1 - Math.abs(across) / w); zone[i] = 1; }
    }
    hgt[i] = h;
  }
  for (let k = 0; k < 70; k++) {                       // craters
    const a = rnd() * Math.PI * 2, dist = Math.sqrt(rnd()) * R * 0.95;
    const cx = c0 + Math.cos(a) * dist, cy = c0 + Math.sin(a) * dist, cr = 1.5 + Math.pow(rnd(), 4) * 14, dep = 0.03 + 0.008 * cr;
    for (let y = Math.max(0, (cy - cr * 1.4) | 0); y <= Math.min(S - 1, (cy + cr * 1.4) | 0); y++)
      for (let x = Math.max(0, (cx - cr * 1.4) | 0); x <= Math.min(S - 1, (cx + cr * 1.4) | 0); x++) {
        const i = y * S + x;
        if (zone[i] >= 2) continue;
        const dd = Math.hypot(x - cx, y - cy) / cr;
        if (dd < 1) hgt[i] -= dep * (1 - dd * dd);
        else if (dd < 1.35) hgt[i] += dep * 0.4 * (1 - Math.abs(dd - 1.1) / 0.25);
      }
  }
  paintBody(b, (x, y, u, v, out, i) => {
    const h = hgt[i], z = zone[i];
    const ha = (x > 1 && y > 1) ? hgt[i - 2 * S - 2] : h, hb = (x < S - 2 && y < S - 2) ? hgt[i + 2 * S + 2] : h;
    const shade = clamp(1 + (ha - hb) * 2.8, 0.6, 1.4);
    const fine = fbm(x / 4, y / 4, s + 9, 2), dark = fbm(x / 48, y / 48, s + 2, 4);
    const cap = Math.abs(v) > 0.83 + (fbm(x / 10, y / 10, s + 3, 2) - 0.5) * 0.14;
    let col, bio;
    if (cap) { col = mix([244, 240, 236], [222, 200, 186], fine * 0.6); bio = 2; }
    else if (z === 3) { col = [96, 54, 42]; bio = 4; }
    else if (z === 2) { col = mix([186, 104, 70], [160, 88, 60], fine); bio = 4; }
    else if (z === 1) { col = mix([126, 64, 46], [96, 50, 38], fine); bio = 3; }
    else if (dark > 0.6) { col = mix([108, 62, 46], [86, 50, 40], fine); bio = 1; }
    else if (h > 0.33) { col = mix([214, 140, 94], [196, 122, 80], fine); bio = 5; }
    else { col = mix([202, 110, 66], [176, 90, 56], fine); bio = 0; }
    if (!cap) col = [col[0] * shade, col[1] * shade, col[2] * shade];
    out[0] = col[0]; out[1] = col[1]; out[2] = col[2]; out[3] = bio;
  });
}

// ---------- gas giants: banded clouds, a great storm, white ovals ----------
const ZEUS_STYLE = {
  palette: [[238, 226, 200], [210, 176, 132], [182, 116, 74], [228, 208, 170], [166, 98, 64], [240, 232, 214], [196, 150, 106], [150, 90, 62]],
  bands: 15, turb: 1.0, storm: { u: 0.25, v: 0.32, rx: 0.22, ry: 0.11, col: [196, 84, 56] }, ovals: [240, 236, 226],
};
const POSEIDON_STYLE = {
  palette: [[44, 86, 176], [72, 132, 212], [58, 150, 172], [146, 196, 226], [32, 60, 140], [90, 160, 220]],
  bands: 11, turb: 0.7, storm: { u: -0.3, v: -0.25, rx: 0.17, ry: 0.1, col: [22, 34, 92] }, ovals: [226, 240, 250],
};
function paintGasGiant(b, st) {
  const s = SEED + 1700 + b.seedOff * 13, rnd = mulberry32(s);
  const order = Array.from({ length: st.bands }, () => st.palette[(rnd() * st.palette.length) | 0]);
  const ovals = Array.from({ length: 6 }, () => ({ u: rnd() * 1.6 - 0.8, v: rnd() * 1.6 - 0.8, r: 0.025 + rnd() * 0.03 }));
  const nb = st.bands, wrap = k => ((k % nb) + nb) % nb;
  paintBody(b, (x, y, u, v, out) => {
    const warp = (fbm(x / 40, y / 10, s, 4) - 0.5) * st.turb + (fbm(x / 90, y / 25, s + 1, 3) - 0.5) * st.turb * 0.7;
    const bt = (v * 0.5 + 0.5) * nb + warp * 0.9;
    const i0 = Math.floor(bt), f = bt - i0, sm = f * f * (3 - 2 * f);
    let col = mix(order[wrap(i0)], order[wrap(i0 + 1)], sm);
    const streak = 0.92 + fbm(x / 7, y / 1.8, s + 3, 3) * 0.16;
    col = [col[0] * streak, col[1] * streak, col[2] * streak];
    let bio = 0;
    const sd = Math.hypot((u - st.storm.u) / st.storm.rx, (v - st.storm.v) / st.storm.ry);
    if (sd < 1.15) {
      const swirl = fbm(x / 6 + sd * 3, y / 6, s + 5, 3);
      if (sd < 1) { col = mix(col, st.storm.col, (1 - sd * sd) * 0.85 * (0.8 + swirl * 0.4)); bio = 1; }
      else col = mix(col, st.ovals, Math.max(0, 1 - Math.abs(sd - 1.07) / 0.08) * 0.35);
    }
    for (const ov of ovals) {
      const od = Math.hypot((u - ov.u) / ov.r, (v - ov.v) / (ov.r * 0.6));
      if (od < 1) col = mix(col, st.ovals, (1 - od) * 0.7);
    }
    out[0] = col[0]; out[1] = col[1]; out[2] = col[2]; out[3] = bio;
  }, 0.45);
}

// ---------- moons of Zeus ----------
function paintHephaestus(b) {            // sulfur-yellow volcanic moon (like Io)
  const S = b.size, c0 = S / 2, R = b.texR, s = SEED + 1800, rnd = mulberry32(s);
  const vents = Array.from({ length: 14 }, () => {
    const a = rnd() * Math.PI * 2, dist = Math.sqrt(rnd()) * R * 0.9;
    return { x: c0 + Math.cos(a) * dist, y: c0 + Math.sin(a) * dist, r: 2 + rnd() * 6, hot: rnd() < 0.4 };
  });
  paintBody(b, (x, y, u, v, out) => {
    const m = fbm(x / 18, y / 18, s, 4), f = fbm(x / 5, y / 5, s + 1, 2);
    let col = m > 0.55 ? mix([226, 206, 96], [242, 236, 206], (m - 0.55) * 3) : mix([206, 136, 60], [226, 206, 96], m / 0.55);
    col = mix(col, [col[0] * 0.85, col[1] * 0.85, col[2] * 0.85], f * 0.4);
    let bio = 0, glow = 0;
    for (const vt of vents) {
      const dd = Math.hypot(x - vt.x, y - vt.y) / vt.r;
      if (dd < 1) { col = mix([34, 26, 22], [70, 40, 30], dd); bio = 1; if (vt.hot && dd < 0.45) { col = [255, 150, 50]; glow = 1; } }
      else if (dd < 2.4) col = mix(col, [176, 64, 40], 0.45 * (1 - (dd - 1) / 1.4));   // red ring of fresh sulfur
    }
    out[0] = col[0]; out[1] = col[1]; out[2] = col[2]; out[3] = bio; out[4] = glow;
  }, 0.3);
}
function paintAthena(b) {                // bright ice crisscrossed with brown cracks (like Europa)
  const s = SEED + 1810;
  paintBody(b, (x, y, u, v, out) => {
    let col = mix([238, 232, 220], [214, 200, 180], fbm(x / 30, y / 30, s, 4));
    if (fbm(x / 22, y / 22, s + 1, 3) > 0.64) col = mix(col, [176, 140, 110], 0.55);   // jumbled "chaos" terrain
    const c1 = Math.abs(fbm(x / 25, y / 25, s + 2, 3) - 0.5) < 0.012, c2 = Math.abs(fbm(x / 12, y / 12, s + 3, 3) - 0.5) < 0.01;
    let bio = 0;
    if (c1 || c2) { col = mix(col, [146, 92, 62], c1 ? 0.85 : 0.6); bio = 1; }
    out[0] = col[0]; out[1] = col[1]; out[2] = col[2]; out[3] = bio;
  });
}
function paintHermes(b) {                // dark ancient crust peppered with bright craters (like Callisto)
  const S = b.size, c0 = S / 2, R = b.texR, s = SEED + 1820, rnd = mulberry32(s);
  const bright = new Float32Array(S * S);
  for (let k = 0; k < 320; k++) {
    const a = rnd() * Math.PI * 2, dist = Math.sqrt(rnd()) * R, cr = 1 + Math.pow(rnd(), 3) * 7;
    const cx = c0 + Math.cos(a) * dist, cy = c0 + Math.sin(a) * dist;
    for (let y = Math.max(0, (cy - cr * 2) | 0); y <= Math.min(S - 1, (cy + cr * 2) | 0); y++)
      for (let x = Math.max(0, (cx - cr * 2) | 0); x <= Math.min(S - 1, (cx + cr * 2) | 0); x++) {
        const dd = Math.hypot(x - cx, y - cy) / cr;
        if (dd < 2) bright[y * S + x] = Math.max(bright[y * S + x], dd < 1 ? 0.9 : (2 - dd) * 0.45);
      }
  }
  const bx = c0 + (rnd() - 0.5) * R, by = c0 + (rnd() - 0.5) * R, br = R * 0.25;   // a giant ringed impact basin
  paintBody(b, (x, y, u, v, out, i) => {
    let col = mix([74, 68, 62], [98, 90, 82], fbm(x / 20, y / 20, s, 4));
    const bd = Math.hypot(x - bx, y - by) / br;
    if (bd < 2.2) col = mix(col, [140, 132, 122], (0.5 + 0.5 * Math.cos(bd * Math.PI * 5)) * 0.35 * (1 - bd / 2.2));
    col = mix(col, [212, 206, 196], bright[i]);
    out[0] = col[0]; out[1] = col[1]; out[2] = col[2]; out[3] = bright[i] > 0.3 ? 1 : 0;
  });
}

// ---------- moons of Poseidon ----------
function paintTriton(b) {                // pinkish nitrogen ice, cantaloupe terrain, dark geyser streaks
  const s = SEED + 1830;
  paintBody(b, (x, y, u, v, out) => {
    let col = mix([222, 196, 186], [196, 166, 156], fbm(x / 24, y / 24, s, 4));
    let bio = 0;
    if (Math.abs(fbm(x / 7, y / 7, s + 1, 3) - 0.5) < 0.04) col = mix(col, [166, 138, 132], 0.6);   // cantaloupe ridges
    if (v > 0.35 + (fbm(x / 14, y / 14, s + 2, 2) - 0.5) * 0.3) {                              // bright polar cap
      col = mix(col, [240, 230, 224], 0.7); bio = 2;
      if (fbm(x / 3, y / 16, s + 3, 3) > 0.66) { col = mix(col, [96, 76, 74], 0.75); bio = 1; }    // geyser streaks
    }
    out[0] = col[0]; out[1] = col[1]; out[2] = col[2]; out[3] = bio;
  });
}
function paintAmphitrite(b) {            // blue-white ice plates over a frozen ocean
  const s = SEED + 1840;
  paintBody(b, (x, y, u, v, out) => {
    let col = mix([210, 228, 242], [180, 206, 228], fbm(x / 26, y / 26, s, 4));
    if (fbm(x / 40, y / 40, s + 1, 3) > 0.6) col = mix(col, [160, 194, 226], 0.5);                 // refrozen smooth areas
    let bio = 0;
    if (Math.abs(fbm(x / 14, y / 14, s + 2, 3) - 0.5) < 0.018) { col = [70, 112, 150]; bio = 1; }   // cracks between plates
    out[0] = col[0]; out[1] = col[1]; out[2] = col[2]; out[3] = bio;
  });
}

// ---------- the bodies themselves ----------
{
  const P = CFG.planets;
  makeBody({ id: 'aries', name: 'Aries', parent: 'sun', r: DISK.R * P.aries.size, tex: 2,
    orbit: SUN.dist * P.aries.orbit, period: kepler(P.aries.orbit), spin: P.aries.spin, seedOff: 21,
    halo: '232,120,80', dot: '#d0704a', label: '#ffb595', ring: '230,130,90', key: 'r', frame: 'rotating',
    biomes: ['Rust plains', 'Dark basalt', 'Polar ice', 'Canyon', 'Volcano', 'Cratered highlands'],
    blurb: 'the red planet', paint: paintAries });
  makeBody({ id: 'zeus', name: 'Zeus', parent: 'sun', r: DISK.R * P.zeus.size, tex: 12,
    orbit: SUN.dist * P.zeus.orbit, period: kepler(P.zeus.orbit), spin: P.zeus.spin, seedOff: 31,
    halo: '235,200,150', dot: '#d9b98c', label: '#f3d9b0', ring: '235,200,150', key: 'z', frame: 'translate',
    biomes: ['Cloud bands', 'Great Red Storm'], blurb: 'gas giant', paint: b => paintGasGiant(b, ZEUS_STYLE) });
  makeBody({ id: 'poseidon', name: 'Poseidon', parent: 'sun', r: DISK.R * P.poseidon.size, tex: 9,
    orbit: SUN.dist * P.poseidon.orbit, period: kepler(P.poseidon.orbit), spin: P.poseidon.spin, seedOff: 32,
    halo: '110,160,240', dot: '#4f86d6', label: '#a9c8ff', ring: '120,170,240', key: 'p', frame: 'translate',
    rings: { inner: 1.3, outer: 2.05, gaps: [[1.55, 1.6], [1.83, 1.87]] },
    biomes: ['Cloud bands', 'Dark Storm'], blurb: 'ringed gas giant', paint: b => paintGasGiant(b, POSEIDON_STYLE) });
  const Rz = BODY.zeus.r, Rp = BODY.poseidon.r;
  makeBody({ id: 'hephaestus', name: 'Hephaestus', parent: 'zeus', r: 140, tex: 1, orbit: Rz * 2.4, period: 70, spin: 'locked', seedOff: 41,
    halo: '240,210,110', dot: '#e0c25a', label: '#f5dd8a', ring: '240,210,120', frame: 'rotating',
    biomes: ['Sulfur plains', 'Volcanic vent'], blurb: 'volcanic moon of Zeus', paint: paintHephaestus });
  makeBody({ id: 'athena', name: 'Athena', parent: 'zeus', r: 120, tex: 1, orbit: Rz * 3.4, period: 120, spin: 'locked', seedOff: 42,
    halo: '230,225,215', dot: '#e4dccd', label: '#efe8dc', ring: '230,225,215', frame: 'rotating',
    biomes: ['Ice sheet', 'Cracked ridges'], blurb: 'icy moon of Zeus', paint: paintAthena });
  makeBody({ id: 'hermes', name: 'Hermes', parent: 'zeus', r: 190, tex: 1, orbit: Rz * 5, period: 200, spin: 'locked', seedOff: 43,
    halo: '200,195,190', dot: '#8d8680', label: '#d6d0c8', ring: '200,195,190', frame: 'rotating',
    biomes: ['Dark crust', 'Bright craters'], blurb: 'ancient cratered moon of Zeus', paint: paintHermes });
  makeBody({ id: 'amphitrite', name: 'Amphitrite', parent: 'poseidon', r: 90, tex: 1, orbit: Rp * 2.6, period: 80, spin: 'locked', seedOff: 51,
    halo: '200,225,245', dot: '#c8e0f0', label: '#d8ecfa', ring: '200,225,245', frame: 'rotating',
    biomes: ['Ice plates', 'Frozen cracks'], blurb: 'frozen-ocean moon of Poseidon', paint: paintAmphitrite });
  makeBody({ id: 'triton', name: 'Triton', parent: 'poseidon', r: 120, tex: 1, orbit: Rp * 3.8, period: -150, spin: 'locked', seedOff: 52,
    halo: '230,200,195', dot: '#dcbcb4', label: '#f0d6d0', ring: '230,200,195', frame: 'rotating',
    biomes: ['Nitrogen ice', 'Geyser streaks', 'Polar cap'], blurb: 'moon of Poseidon that orbits backwards', paint: paintTriton });
  // locking onto a gas giant zooms out to show its whole family of moons
  for (const gid of ['zeus', 'poseidon']) {
    const kids = Object.values(BODY).filter(m => m.parent === gid);
    const reach = Math.max(...kids.map(m => m.orbit + m.r)) * 1.1;
    BODY[gid].followZoom = () => Math.min(cw, ch - 200) / (2 * reach);
  }
}

// ======================================================================
// the seed world: a whole planet (and its moons) generated from the map seed.
// planetRecipe(seed) turns a number into a list of traits; the painters turn traits into a surface.
// Same seed -> same recipe -> same planet, every time.
// ======================================================================
function hsl(h, sat, l) {                                // hue 0-360, sat/l 0-1 -> [r, g, b]
  h = (((h % 360) + 360) % 360) / 360;
  const f = n => { const k = (n + h * 12) % 12, a = sat * Math.min(l, 1 - l); return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))); };
  return [f(0), f(8), f(4)];
}
const rgbStr = c => `${c[0] | 0},${c[1] | 0},${c[2] | 0}`;
function hueName(h) {
  h = ((h % 360) + 360) % 360;
  return h < 20 ? 'crimson' : h < 45 ? 'amber' : h < 70 ? 'golden' : h < 100 ? 'olive' : h < 150 ? 'jade'
    : h < 190 ? 'teal' : h < 235 ? 'azure' : h < 275 ? 'indigo' : h < 320 ? 'violet' : 'rose';
}
const SYLLABLES = ['ka', 've', 'lor', 'zan', 'tor', 'mi', 'rah', 'eth', 'os', 'qua', 'dri', 'sel', 'nor', 'vy', 'tha', 'ix', 'um', 'pe', 'gor', 'lia', 'ser', 'an', 'kel', 'oth', 'yr', 'bel'];
function makeName(r) {
  let w = '';
  const n = 2 + (r() < 0.35 ? 1 : 0);
  for (let k = 0; k < n; k++) w += SYLLABLES[(r() * SYLLABLES.length) | 0];
  w += ['', '', 'on', 'ar', 'is', 'us', 'a', 'ia'][(r() * 8) | 0];
  return w[0].toUpperCase() + w.slice(1);
}
const LIQUIDS = {
  water:   { name: 'Ocean',       plural: 'oceans',      deep: [24, 60, 128], shallow: [52, 118, 176], glow: 0 },
  lava:    { name: 'Lava sea',    plural: 'lava seas',   deep: [170, 40, 12], shallow: [250, 130, 34], glow: 0.8 },
  methane: { name: 'Methane sea', plural: 'methane seas', deep: [52, 36, 26], shallow: [104, 74, 46],  glow: 0 },
  acid:    { name: 'Acid lake',   plural: 'acid lakes',  deep: [92, 122, 22], shallow: [170, 196, 52], glow: 0 },
};
const MINOR_TYPES = {
  icy:      'icy moon',
  volcanic: 'volcanic moon',
  hazy:     'hazy moon wrapped in thick smog',
  cratered: 'ancient cratered moon',
  frost:    'frosty moon with dark streaks',
};

// THE RULES: every trait below is rolled from the seed, in a fixed order.
function planetRecipe(seed) {
  // scramble the seed thoroughly first, so neighbouring seeds (1, 2, 3...) give unrelated planets
  const r = mulberry32(Math.floor(hash2(seed, 1234, 5678) * 4294967296) ^ Math.floor(hash2(seed, 91, 3) * 4294967296));
  for (let k = 0; k < 4; k++) r();
  const pick = a => a[(r() * a.length) | 0], range = (a, b) => a + r() * (b - a), chance = q => r() < q;
  const P = { seed, name: makeName(r), kind: chance(0.5) ? 'gas' : 'rocky' };
  if (P.kind === 'gas') {
    P.size = range(3, 7);                                       // x your world's radius
    P.hue = range(0, 360); P.sat = range(0.3, 0.7);
    P.bands = 8 + ((r() * 11) | 0); P.turb = range(0.5, 1.3);
    P.palette = Array.from({ length: 6 }, () => hsl(P.hue + range(-28, 28), P.sat * range(0.6, 1.1), range(0.3, 0.85)));
    P.storm = chance(0.7) ? { u: range(-0.5, 0.5), v: range(-0.5, 0.5), rx: range(0.1, 0.25), ry: range(0.06, 0.12),
      col: hsl(P.hue + range(-40, 40), P.sat, chance(0.5) ? 0.25 : 0.72) } : null;
    P.rings = chance(0.45) ? { inner: 1.3, outer: range(1.7, 2.3), gaps: [[range(1.48, 1.6), 0]] } : null;
    if (P.rings) P.rings.gaps[0][1] = P.rings.gaps[0][0] + 0.05;
    P.moons = 1 + ((r() * 4) | 0);
    P.summary = `gas giant: ${hueName(P.hue)} bands${P.storm ? ', a great storm' : ''}${P.rings ? ', rings' : ''}`;
  } else {
    P.size = range(0.35, 1.4);
    P.atmo = pick(['none', 'thin', 'thin', 'thick']);
    P.atmoHue = range(0, 360);
    P.liquid = pick(['none', 'water', 'water', 'lava', 'methane', 'acid']);
    P.liquidLevel = range(0.2, 0.65);                           // share of the surface under liquid
    P.groundHue = range(0, 360); P.groundSat = range(0.12, 0.5);
    P.rough = range(0.2, 1);                                    // how jagged the mountains are
    P.ice = P.liquid !== 'lava' && chance(0.5) ? range(0.08, 0.3) : 0;
    P.craters = P.atmo === 'none' ? 160 : P.atmo === 'thin' ? 50 : 8;   // air burns up meteors
    P.clouds = P.atmo === 'thick' ? range(0.35, 0.7) : 0;
    P.moons = (r() * 3) | 0;
    const bits = [P.atmo === 'none' ? 'no air' : `${P.atmo} ${hueName(P.atmoHue)} atmosphere`];
    if (P.liquid !== 'none') bits.push(LIQUIDS[P.liquid].plural);
    if (P.ice) bits.push('ice caps');
    if (P.rough > 0.7) bits.push('jagged mountains');
    P.summary = `rocky world: ${bits.join(', ')}`;
  }
  P.moonDefs = Array.from({ length: P.moons }, () => ({
    name: makeName(r), type: pick(Object.keys(MINOR_TYPES)), r: range(60, 160), hue: range(0, 360), retro: chance(0.15),
  }));
  return P;
}

// ---------- painters for generated bodies ----------
function gasStyle(P) {
  return { palette: P.palette, bands: P.bands, turb: P.turb,
    storm: P.storm || { u: 9, v: 9, rx: 0.01, ry: 0.01, col: [0, 0, 0] }, ovals: hsl(P.hue, P.sat * 0.3, 0.9) };
}

function paintRocky(b, P) {
  const S = b.size, c0 = S / 2, R = b.texR, s = P.seed + 3000, rnd = mulberry32(s);
  const sc = R * 0.35, hgt = new Float32Array(S * S), vals = [];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    if (Math.hypot(x + 0.5 - c0, y + 0.5 - c0) > R) continue;
    const wx = x + (fbm(x / sc, y / sc, s + 1, 3) - 0.5) * R * 0.25, wy = y + (fbm(x / sc, y / sc, s + 3, 3) - 0.5) * R * 0.25;
    let e = fbm(wx / sc, wy / sc, s, 5);
    const ridge = 1 - Math.abs(2 * fbm(x / (sc * 0.45), y / (sc * 0.45), s + 2, 4) - 1);
    e += ridge * ridge * 0.35 * P.rough;
    hgt[y * S + x] = e; vals.push(e);
  }
  vals.sort((a, b2) => a - b2);
  const sea = P.liquid !== 'none' ? vals[Math.floor(vals.length * P.liquidLevel)] : -1;
  const bottom = Math.max(sea, vals[0]), top = vals[vals.length - 1];
  for (let k = 0; k < P.craters; k++) {                 // craters, on dry land only
    const a = rnd() * Math.PI * 2, dist = Math.sqrt(rnd()) * R * 0.95;
    const cx = c0 + Math.cos(a) * dist, cy = c0 + Math.sin(a) * dist, cr = 1 + Math.pow(rnd(), 4) * R * 0.08, dep = 0.03 + 0.006 * cr;
    for (let y = Math.max(0, (cy - cr * 1.4) | 0); y <= Math.min(S - 1, (cy + cr * 1.4) | 0); y++)
      for (let x = Math.max(0, (cx - cr * 1.4) | 0); x <= Math.min(S - 1, (cx + cr * 1.4) | 0); x++) {
        const i = y * S + x;
        if (hgt[i] <= sea) continue;
        const dd = Math.hypot(x - cx, y - cy) / cr;
        if (dd < 1) hgt[i] -= dep * (1 - dd * dd);
        else if (dd < 1.35) hgt[i] += dep * 0.4 * (1 - Math.abs(dd - 1.1) / 0.25);
      }
  }
  const low = hsl(P.groundHue, P.groundSat, 0.38), high = hsl(P.groundHue + 20, P.groundSat * 0.7, 0.56), peak = hsl(P.groundHue, P.groundSat * 0.3, 0.82);
  const atmoCol = hsl(P.atmoHue, 0.45, 0.65), cloudCol = mix([242, 244, 248], atmoCol, 0.2);
  const L = LIQUIDS[P.liquid];
  paintBody(b, (x, y, u, v, out, i) => {
    const e = hgt[i], fine = fbm(x / 3, y / 3, s + 9, 2);
    let col, bio, glow = 0;
    if (e < sea) {
      const dep = clamp((sea - e) * 8, 0, 1);
      col = mix(L.shallow, L.deep, dep); bio = 0; glow = L.glow * (0.5 + dep * 0.5);
    } else {
      const t = clamp((e - bottom) / (top - bottom + 1e-6), 0, 1);
      col = t < 0.6 ? mix(low, high, t / 0.6) : mix(high, peak, (t - 0.6) / 0.4);
      bio = t < 0.35 ? 1 : t < 0.7 ? 2 : 3;
      const ha = (x > 1 && y > 1) ? hgt[i - 2 * S - 2] : e, hb = (x < S - 2 && y < S - 2) ? hgt[i + 2 * S + 2] : e;
      const shade = clamp(1 + (ha - hb) * 4, 0.6, 1.4);
      col = mix(col, [col[0] * 0.85, col[1] * 0.85, col[2] * 0.85], fine * 0.4);
      col = [col[0] * shade, col[1] * shade, col[2] * shade];
    }
    if (P.ice && Math.abs(v) > 1 - P.ice + (fbm(x / 10, y / 10, s + 5, 2) - 0.5) * 0.12) { col = mix(col, [240, 244, 248], 0.85); bio = 4; glow = 0; }
    if (P.clouds) {                                      // wispy cloud streaks (stretched sideways, like weather bands)
      const c = fbm(x / (R * 0.12) + fbm(x / sc, y / sc, s + 7, 2) * 3, y / (R * 0.05), s + 6, 4);
      const th = 1 - P.clouds * 0.8;
      if (c > th) col = mix(col, cloudCol, clamp((c - th) * 4, 0, 0.85));
    }
    if (P.atmo === 'thick') col = mix(col, atmoCol, 0.18);
    out[0] = col[0]; out[1] = col[1]; out[2] = col[2]; out[3] = bio; out[4] = glow;
  }, P.atmo === 'thick' ? 0.15 : 0.3);
  b.biomes = [L ? L.name : 'Basin', 'Lowlands', 'Highlands', P.rough > 0.6 ? 'Mountains' : 'Uplands', 'Ice cap'];
}

function paintMinor(b, M) {
  const S = b.size, c0 = S / 2, R = b.texR, s = M.seed, rnd = mulberry32(s);
  const put = (out, c, bio = 0, glow = 0) => { out[0] = c[0]; out[1] = c[1]; out[2] = c[2]; out[3] = bio; out[4] = glow; };
  if (M.type === 'icy') {                                // cracked ice (Europa-like)
    const a = hsl(M.hue, 0.15, 0.88), a2 = hsl(M.hue, 0.2, 0.74), crack = hsl(M.hue + 180, 0.35, 0.4);
    b.biomes = ['Ice sheet', 'Cracks'];
    paintBody(b, (x, y, u, v, out) => {
      const col = mix(a, a2, fbm(x / 26, y / 26, s, 4));
      const cr = Math.abs(fbm(x / 20, y / 20, s + 1, 3) - 0.5) < 0.013 || Math.abs(fbm(x / 10, y / 10, s + 2, 3) - 0.5) < 0.01;
      put(out, cr ? mix(col, crack, 0.75) : col, cr ? 1 : 0);
    });
  } else if (M.type === 'volcanic') {                    // sulfur and glowing vents (Io-like)
    const b1 = hsl(45 + (M.hue % 30) - 15, 0.6, 0.62), b2 = hsl(22 + (M.hue % 20), 0.6, 0.5), frost = hsl(50, 0.4, 0.88);
    const vents = Array.from({ length: 10 }, () => { const a = rnd() * 6.283, d = Math.sqrt(rnd()) * R * 0.9; return { x: c0 + Math.cos(a) * d, y: c0 + Math.sin(a) * d, r: 2 + rnd() * 5, hot: rnd() < 0.45 }; });
    b.biomes = ['Sulfur plains', 'Volcanic vent'];
    paintBody(b, (x, y, u, v, out) => {
      const m = fbm(x / 18, y / 18, s, 4);
      let col = m > 0.55 ? mix(b1, frost, (m - 0.55) * 3) : mix(b2, b1, m / 0.55), bio = 0, glow = 0;
      for (const vt of vents) {
        const dd = Math.hypot(x - vt.x, y - vt.y) / vt.r;
        if (dd < 1) { col = mix([34, 26, 22], [70, 40, 30], dd); bio = 1; if (vt.hot && dd < 0.45) { col = [255, 150, 50]; glow = 1; } }
        else if (dd < 2.3) col = mix(col, [176, 64, 40], 0.4 * (1 - (dd - 1) / 1.3));
      }
      put(out, col, bio, glow);
    }, 0.3);
  } else if (M.type === 'hazy') {                        // a smooth ball of thick smog (Titan-like)
    const a = hsl(M.hue, 0.55, 0.5), a2 = hsl(M.hue + 15, 0.5, 0.62);
    b.biomes = ['Thick haze'];
    b.halo = rgbStr(hsl(M.hue, 0.6, 0.6)); b.haloA = 0.55; b.haloR = 1.35;
    paintBody(b, (x, y, u, v, out) => put(out, mix(a, a2, fbm(x / 40, y / 12, s, 3))), 0.05);
  } else if (M.type === 'cratered') {                    // dark, ancient, bright craters (Callisto-like)
    const dark = hsl(M.hue, 0.12, 0.28), dark2 = hsl(M.hue, 0.1, 0.36), light = hsl(M.hue, 0.1, 0.8);
    const bright = new Float32Array(S * S);
    for (let k = 0; k < 220; k++) {
      const a = rnd() * 6.283, d = Math.sqrt(rnd()) * R, cr = 1 + Math.pow(rnd(), 3) * 6, cx = c0 + Math.cos(a) * d, cy = c0 + Math.sin(a) * d;
      for (let y = Math.max(0, (cy - cr * 2) | 0); y <= Math.min(S - 1, (cy + cr * 2) | 0); y++)
        for (let x = Math.max(0, (cx - cr * 2) | 0); x <= Math.min(S - 1, (cx + cr * 2) | 0); x++) {
          const dd = Math.hypot(x - cx, y - cy) / cr;
          if (dd < 2) bright[y * S + x] = Math.max(bright[y * S + x], dd < 1 ? 0.85 : (2 - dd) * 0.42);
        }
    }
    b.biomes = ['Dark crust', 'Bright craters'];
    paintBody(b, (x, y, u, v, out, i) => put(out, mix(mix(dark, dark2, fbm(x / 20, y / 20, s, 4)), light, bright[i]), bright[i] > 0.3 ? 1 : 0));
  } else {                                               // frost: streaks and a polar cap (Triton-like)
    const a = hsl(M.hue, 0.3, 0.8), a2 = hsl(M.hue, 0.3, 0.66), streak = hsl(M.hue, 0.2, 0.3);
    b.biomes = ['Frost plains', 'Dark streaks', 'Polar cap'];
    paintBody(b, (x, y, u, v, out) => {
      let col = mix(a, a2, fbm(x / 24, y / 24, s, 4)), bio = 0;
      if (Math.abs(fbm(x / 7, y / 7, s + 1, 3) - 0.5) < 0.04) col = mix(col, a2, 0.7);
      if (v > 0.3 + (fbm(x / 14, y / 14, s + 2, 2) - 0.5) * 0.3) {
        col = mix(col, [240, 236, 232], 0.65); bio = 2;
        if (fbm(x / 3, y / 16, s + 3, 3) > 0.66) { col = mix(col, streak, 0.75); bio = 1; }
      }
      put(out, col, bio);
    });
  }
}

// ---------- build the seed world and its moons ----------
const SEED_PLANET = planetRecipe(SEED);
const GEN_MOON_IDS = [];
{
  const P = SEED_PLANET, orbit = CFG.planets.seedWorld.orbit, R = DISK.R * P.size;
  const look = P.kind === 'gas'
    ? { halo: rgbStr(P.palette[0]), dot: `rgb(${rgbStr(P.palette[1])})`, label: `rgb(${rgbStr(hsl(P.hue, 0.5, 0.82))})` }
    : { halo: rgbStr(P.atmo === 'none' ? [200, 200, 210] : hsl(P.atmoHue, 0.5, 0.7)),
        haloA: P.atmo === 'none' ? 0.12 : P.atmo === 'thin' ? 0.3 : 0.55, haloR: P.atmo === 'thick' ? 1.3 : 1.15,
        dot: `rgb(${rgbStr(hsl(P.groundHue, P.groundSat, 0.5))})`, label: `rgb(${rgbStr(hsl(P.groundHue, 0.5, 0.82))})` };
  const world = makeBody({ id: 'seedworld', name: P.name, parent: 'sun', r: R, tex: Math.max(1, Math.ceil(R / 230)),
    orbit: SUN.dist * orbit, period: kepler(orbit), spin: P.kind === 'gas' ? 45 : 100, seedOff: 61,
    key: 'g', frame: P.kind === 'gas' ? 'translate' : 'rotating', rings: P.rings || undefined, ...look,
    ring: look.halo, recipe: P, blurb: `${P.summary} · generated from seed ${SEED}`,
    biomes: P.kind === 'gas' ? ['Cloud bands', 'Great storm'] : [],
    paint: b => (P.kind === 'gas' ? paintGasGiant(b, gasStyle(P)) : paintRocky(b, P)) });
  const first = P.kind === 'gas' ? Math.max(2.3, (P.rings ? P.rings.outer : 0) + 0.5) : 3;
  P.moonDefs.forEach((M, k) => {
    const id = 'seedmoon' + k;
    makeBody({ id, name: M.name, parent: 'seedworld', r: M.r, tex: 1,
      orbit: R * (first + k * (P.kind === 'gas' ? 1.1 : 1.8)) + M.r * 2, period: (60 + k * 55) * (M.retro ? -1 : 1), spin: 'locked',
      seedOff: 70 + k, frame: 'rotating', halo: rgbStr(hsl(M.hue, 0.25, 0.8)), dot: `rgb(${rgbStr(hsl(M.hue, 0.25, 0.7))})`,
      label: `rgb(${rgbStr(hsl(M.hue, 0.35, 0.86))})`, ring: rgbStr(hsl(M.hue, 0.25, 0.8)),
      blurb: `${MINOR_TYPES[M.type]} of ${P.name}${M.retro ? ', orbits backwards' : ''}`, biomes: [],
      paint: b => paintMinor(b, { ...M, seed: P.seed + 4000 + k * 97 }) });
    GEN_MOON_IDS.push(id);
  });
  if (GEN_MOON_IDS.length) {
    const reach = Math.max(...GEN_MOON_IDS.map(id => BODY[id].orbit + BODY[id].r)) * 1.1;
    world.followZoom = () => Math.min(cw, ch - 200) / (2 * reach);
  }
}
const DRAW_ORDER = ['aries', 'zeus', 'hephaestus', 'athena', 'hermes', 'poseidon', 'amphitrite', 'triton', 'seedworld', ...GEN_MOON_IDS];

function drawBodyGeneric(b, z) {
  const [x, y, spin] = genericPos(b);
  const [sx, sy] = toScreen(x, y), rr = b.r * z;
  const isMoon = b.parent !== 'sun';
  const orbitPx = b.orbit * z;
  if (isMoon && orbitPx < 12) return;                   // too close to its planet to tell apart from here
  // orbit ring around the parent
  if (orbitPx > 14 && orbitPx < 60000 && (isMoon || z < 0.01)) {
    const [px, py] = isMoon ? genericPos(BODY[b.parent]) : sunPos();
    const [cx, cy] = toScreen(px, py);
    ctx.setLineDash([3, 10]); ctx.lineWidth = 1.5; ctx.strokeStyle = `rgba(${b.ring},0.2)`;
    ctx.beginPath(); ctx.arc(cx, cy, orbitPx, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  }
  const extent = Math.max(rr * (b.rings ? b.rings.outer + 0.05 : 1.2), 20);
  if (sx + extent < 0 || sy + extent < 0 || sx - extent > cw || sy - extent > ch) return;
  const showLabel = !isMoon || orbitPx > 40;
  // rings (seen from above, so they're full circles around the planet), with the planet's shadow across them
  if (b.rings && rr >= 2) {
    for (const [a1, a2, al, tint] of b.ringlets) {
      ctx.beginPath(); ctx.arc(sx, sy, rr * a2, 0, Math.PI * 2); ctx.arc(sx, sy, rr * a1, 0, Math.PI * 2, true);
      ctx.fillStyle = `rgba(${tint | 0},${(tint + 18) | 0},${(tint + 34) | 0},${al})`; ctx.fill();
    }
    const [ssx0, ssy0] = toScreen(...sunPos().slice(0, 2));
    const away = Math.atan2(sy - ssy0, sx - ssx0);
    ctx.save();
    ctx.beginPath(); ctx.arc(sx, sy, rr * b.rings.outer, 0, Math.PI * 2); ctx.arc(sx, sy, rr * 0.98, 0, Math.PI * 2, true); ctx.clip();
    ctx.translate(sx, sy); ctx.rotate(away);
    ctx.fillStyle = 'rgba(2,4,14,0.72)'; ctx.fillRect(0, -rr, rr * (b.rings.outer + 0.1), rr * 2);
    ctx.restore();
  }
  // atmosphere / glow halo
  const haloR = Math.max(rr * (b.haloR || 1.15), 16);
  const gl = ctx.createRadialGradient(sx, sy, Math.max(rr * 0.95, 1), sx, sy, haloR);
  gl.addColorStop(0, `rgba(${b.halo},${b.haloA ?? 0.32})`); gl.addColorStop(1, `rgba(${b.halo},0)`);
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(sx, sy, haloR, 0, Math.PI * 2); ctx.fill();
  if (rr < 4) {
    ctx.fillStyle = b.dot; ctx.beginPath(); ctx.arc(sx, sy, Math.max(rr, 3.2), 0, Math.PI * 2); ctx.fill();
    if (showLabel) pill(sx, sy + 20, b.name, { fg: b.label, size: 12 });
    return;
  }
  const scale = b.tex * z, half = b.size / 2 * scale;
  ctx.save();
  ctx.translate(sx, sy); ctx.rotate(spin + cam.rot);
  ctx.imageSmoothingEnabled = scale < 1.5;
  ctx.drawImage(b.canvas, -half, -half, half * 2, half * 2);
  ctx.restore();
  // sunlight from the real sun: day side and night side
  const [ssx, ssy] = toScreen(...sunPos().slice(0, 2));
  let ldx = ssx - sx, ldy = ssy - sy;
  const ll = Math.hypot(ldx, ldy) || 1; ldx /= ll; ldy /= ll;
  ctx.save();
  ctx.beginPath(); ctx.arc(sx, sy, rr, 0, Math.PI * 2); ctx.clip();
  const lg = ctx.createLinearGradient(sx + ldx * rr, sy + ldy * rr, sx - ldx * rr * 1.4, sy - ldy * rr * 1.4);
  lg.addColorStop(0, 'rgba(0,0,12,0)'); lg.addColorStop(0.45, 'rgba(0,0,12,0.14)'); lg.addColorStop(0.75, 'rgba(0,0,12,0.55)'); lg.addColorStop(1, 'rgba(0,0,12,0.85)');
  ctx.fillStyle = lg; ctx.fillRect(sx - rr, sy - rr, rr * 2, rr * 2);
  ctx.restore();
  if (b.glow) {                                          // hot spots keep glowing on the night side
    ctx.save();
    ctx.translate(sx, sy); ctx.rotate(spin + cam.rot);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.85;
    ctx.imageSmoothingEnabled = scale < 1.5;
    ctx.drawImage(b.glow, -half, -half, half * 2, half * 2);
    ctx.restore();
  }
  ctx.imageSmoothingEnabled = true;
  if (showLabel && rr < 160) pill(sx, sy + rr * (b.rings ? b.rings.outer : 1) + 22, b.name, { fg: b.label, size: 12 });
}
function drawOuterBodies(z) { for (const id of DRAW_ORDER) drawBodyGeneric(BODY[id], z); }

// ======================================================================
// everything you can lock onto, in hit-test order (small moons first, the sun last)
// ======================================================================
const LOCKABLE = [
  { id: 'moon', name: 'the Moon', short: 'Moon', key: 'l', frame: 'rotating', r: () => MOON.r, pos: moonPos,
    visible: z => MOON.orbitR * z >= 12,
    info: (wx, wy) => { const mb = moonBiomeAt(wx, wy); return `The Moon${mb ? ' · ' + mb : ''} · orbits your world every ${Math.round(MOON.period / 60)} min`; } },
  ...['hephaestus', 'athena', 'hermes', 'amphitrite', 'triton', ...GEN_MOON_IDS, 'aries', 'zeus', 'poseidon', 'seedworld'].map(id => {
    const b = BODY[id];
    return { id, name: b.name, short: b.name, key: b.key, frame: b.frame, r: () => b.r, pos: () => genericPos(b), zoom: b.followZoom,
      visible: z => b.parent === 'sun' || b.orbit * z >= 12,
      info: (wx, wy) => { const bio = genericBiomeAt(b, wx, wy); return `${b.name}${bio ? ' · ' + bio : ''} · ${b.blurb}`; } };
  }),
  { id: 'vulcan', name: 'Vulcan', short: 'Vulcan', key: 'v', frame: 'rotating', r: () => VULCAN.r, pos: vulcanPos,
    info: (wx, wy) => { const vb = vulcanBiomeAt(wx, wy); return `Vulcan${vb ? ' · ' + vb : ''} · lava world, circles the Sun every ${(VULCAN.year / 60).toFixed(1)} min`; } },
  { id: 'sun', name: 'the Sun', short: 'Sun', key: 'u', frame: 'translate', r: () => SUN.r, pos: sunPos,
    zoom: () => Math.min(cw, ch - 200) / (2 * (SUN.dist + DISK.R * 6)) * 0.95,
    info: () => `The Sun · your world circles it every ${Math.round(SUN.year / 60)} min` },
];
const LOCK = Object.fromEntries(LOCKABLE.map(e => [e.id, e]));

function bodyUnder(wx, wy) {
  for (const e of LOCKABLE) {
    if (e.visible && !e.visible(cam.zoom)) continue;
    const [x, y] = e.pos();
    if (Math.hypot(wx - x, wy - y) < Math.max(e.r(), 24 / cam.zoom)) return e;
  }
  return null;
}

// hovering any body (or your world from far out): gold ring + hint, so you know a click will lock on
function drawLockHover(z) {
  if (!mouse.in || mouse.dragged || game.tool) return;
  const [wx, wy] = toWorld(mouse.x, mouse.y);
  const e = bodyUnder(wx, wy);
  let tx, ty, br;
  if (e) { if (cam.follow === e.id) return; [tx, ty] = e.pos(); br = e.r(); }
  else if (worldLockable() && overWorld(wx, wy)) { tx = DISK.cx; ty = DISK.cy; br = DISK.R; }
  else return;
  const [sx, sy] = toScreen(tx, ty);
  const r = Math.max(br * z, 10) + 7;
  ctx.setLineDash([5, 4]); ctx.lineWidth = 2; ctx.strokeStyle = '#f2c14e';
  ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  pill(sx, sy - r - 16, 'Click to lock on', { fg: '#f2c14e', border: '#f2c14e', size: 12 });
  canvas.style.cursor = 'pointer';
}

function drawSprite(name, wx, wy, sizePx, alpha = 1) {
  const ras = RAS[name];
  if (!ras) return;
  const img = sizePx * dpr <= 44 ? ras[1] : ras[0];
  const [sx, sy] = toScreen(wx, wy);
  if (alpha !== 1) ctx.globalAlpha = alpha;
  ctx.drawImage(img, sx - sizePx / 2, sy - sizePx / 2, sizePx, sizePx);
  if (alpha !== 1) ctx.globalAlpha = 1;
}

function tracePath(path) {
  ctx.beginPath();
  path.forEach((t, k) => {
    const [sx, sy] = toScreen(...tileCenter(t));
    if (k === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
  });
}

function strokeRoute(path, kind, z, ghost = false) {
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (ghost) {
    tracePath(path);
    ctx.setLineDash([6, 6]); ctx.lineWidth = 3; ctx.strokeStyle = '#7bd389'; ctx.stroke(); ctx.setLineDash([]);
  } else if (kind === 'rail') {
    if (z >= PIXEL_BORDER_BELOW) {
      tracePath(path);   // sleepers
      ctx.lineCap = 'butt';
      ctx.setLineDash([Math.max(1.5, z * 0.13), Math.max(3, z * 0.3)]);
      ctx.lineWidth = Math.max(4, z * 0.6); ctx.strokeStyle = '#6b4f3a'; ctx.stroke();
      ctx.setLineDash([]);
      tracePath(path);   // rail
      ctx.lineWidth = Math.max(1.5, z * 0.16); ctx.strokeStyle = '#59616a'; ctx.stroke();
    } else {
      tracePath(path);
      ctx.lineWidth = 2.5; ctx.strokeStyle = '#3d2e24'; ctx.stroke();
    }
  } else if (kind === 'road') {
    const paved = game.research.done.has('masonry');
    tracePath(path);
    ctx.lineWidth = Math.max(2.5, z * (paved ? 0.5 : 0.4)); ctx.strokeStyle = paved ? 'rgba(120,118,112,0.85)' : 'rgba(140,104,64,0.8)'; ctx.stroke();
    if (z >= PIXEL_BORDER_BELOW && paved) { tracePath(path); ctx.setLineDash([z * 0.3, z * 0.4]); ctx.lineWidth = Math.max(1, z * 0.06); ctx.strokeStyle = 'rgba(240,236,220,0.7)'; ctx.stroke(); ctx.setLineDash([]); }
  } else if (kind === 'air') {
    tracePath([path[0], path[path.length - 1]]);
    ctx.setLineDash([2, 10]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(207,232,255,0.45)'; ctx.stroke(); ctx.setLineDash([]);
  } else {
    tracePath(path);
    ctx.setLineDash([5, 7]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.lineJoin = 'miter'; ctx.lineCap = 'butt';
}

function vehiclePos(L) {
  const k = Math.min(Math.floor(L.t), L.path.length - 2), f = L.t - k;
  const [ax, ay] = tileCenter(L.path[k]), [bx, by] = tileCenter(L.path[k + 1]);
  return [lerp(ax, bx, f), lerp(ay, by, f), Math.atan2(by - ay, bx - ax)];
}

function cargoLabel(c) {
  const parts = [];
  const sent = resBox();
  for (const q of c.req || []) for (const r in q.res) sent[r] += q.res[r];
  for (const r of ['iron', 'stone', 'wood', 'oil', 'wheat']) if ((c[r] || 0) + sent[r] >= 1) parts.push(`${Math.round((c[r] || 0) + sent[r])} ${r}`);
  if (c.people >= 1) parts.push(`${c.people} people`);
  return parts.slice(0, 2).join(' · ') + (parts.length > 2 ? ' …' : '');
}
function drawVehicles(z) {
  for (const L of game.links) {
    const [wx, wy, ang] = vehiclePos(L);
    const [sx, sy] = toScreen(wx, wy);
    if (sx < -60 || sy < -60 || sx > cw + 60 || sy > ch + 60) continue;
    if (L.cargo) {                                 // loaded: a gold crate marker, and what it carries up close
      const off = Math.max(14, z * 1.2), forSite = L.cargo.req && L.cargo.req.length;
      if (z >= 2) pill(sx, sy - off - 6, cargoLabel(L.cargo), { size: 10, fg: forSite ? '#7bd389' : '#f2c14e', dot: forSite ? '#7bd389' : '#a67c52' });
      else { ctx.fillStyle = forSite ? '#7bd389' : '#f2c14e'; ctx.fillRect(sx - 3, sy - off, 6, 6); }
    }
    const back = L.dir < 0 ? Math.PI : 0;
    if (L.kind === 'sea' || L.kind === 'air') {   // ships look like your shipbuilding allows; planes sit still without oil
      const tier = L.kind === 'air' ? 'plane' : boatTier(techIn(countryAt(L.dir > 0 ? L.a : L.b)));
      const s = Math.max(18, z * (L.kind === 'air' ? 1.4 : 1.6));
      ctx.save(); ctx.translate(sx, sy);
      if (L.kind === 'air') ctx.rotate(ang + back); else if (Math.cos(ang + back) < 0) ctx.scale(-1, 1);
      if (RAS[tier]) ctx.drawImage(RAS[tier][s * dpr > 44 ? 0 : 1], -s / 2, -s / 2, s, s);
      ctx.restore();
      if (L.grounded && z >= 1.5) pill(sx, sy + s * 0.7, 'grounded: no oil', { size: 9.5, fg: '#ff7a6b' });
      continue;
    }
    const len = Math.max(9, z * 1.0), wid = Math.max(5, z * 0.5);
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(ang + back);
    ctx.fillStyle = '#2f3540'; ctx.fillRect(-len * 1.15, -wid / 2, len * 0.95, wid);       // wagon
    ctx.fillStyle = '#b8432f'; ctx.fillRect(-len * 0.1, -wid / 2, len * 0.95, wid);         // engine
    ctx.fillStyle = '#f2c14e'; ctx.fillRect(len * 0.65, -wid * 0.25, len * 0.15, wid * 0.5); // headlight
    ctx.restore();
  }
}
// a small badge: an icon and a number (troops in green)
function badge(sx, sy, n, { color = '#7bd389', bg = 'rgba(14,30,18,0.92)', icon = 'soldier', size = 11 } = {}) {
  const w = pill(sx, sy, '  ' + fmtNum(n), { fg: color, bg, border: color, size, bold: 800, dot: bg });
  if (RAS[icon]) ctx.drawImage(RAS[icon][1], sx - w / 2 + 1, sy - size * 0.85, size * 1.7, size * 1.7);
}
// troops: garrisons show how many they hold, marching columns move along their route
function drawTroops(z) {
  const helm = unitStats().helm;
  if (z >= 0.4) for (const b of game.buildings) {
    if ((b.type !== 'base' && b.type !== 'fort') || !owner[b.i] || underway(b)) continue;
    const [sx, sy] = toScreen(...tileCenter(b.i));
    if (sx < -40 || sy < -40 || sx > cw + 40 || sy > ch + 40) continue;
    badge(sx, sy + Math.max(14, z * 1.1), Math.floor(b.units || 0), { size: 10, icon: helm });
  }
  for (const a of game.armies) {
    const [sx, sy] = toScreen(a.x, a.y);
    if (sx < -40 || sy < -40 || sx > cw + 40 || sy > ch + 40) continue;
    if (a.k + 1 < a.pts.length) {                  // the road ahead, faintly
      ctx.beginPath(); ctx.moveTo(sx, sy);
      for (let k = a.k + 1; k < a.pts.length; k++) { const [px, py] = toScreen(...a.pts[k]); ctx.lineTo(px, py); }
      ctx.setLineDash([3, 6]); ctx.lineWidth = 1.5; ctx.strokeStyle = a.purpose === 'attack' ? 'rgba(255,170,120,0.55)' : 'rgba(123,211,137,0.45)'; ctx.stroke(); ctx.setLineDash([]);
    }
    badge(sx, sy, a.n, { size: 11, icon: helm });
  }
  for (const at of game.attacks) {
    if (at.units < 0.5 && at.coming >= 0.5) continue;
    if (at.mx == null) { at.mx = at.lx; at.my = at.ly; }
    at.mx += (at.lx - at.mx) * 0.15; at.my += (at.ly - at.my) * 0.15;
    const [sx, sy] = toScreen(at.mx, at.my);
    badge(sx, sy, at.units, { size: 13, bg: 'rgba(40,24,10,0.92)', icon: helm });
  }
  // haulers and deliveries: what's carrying them is what your tech allows (a porter, a cart, a horse, a carriage, a truck)
  if (z < 1.2) return;
  for (const cv of game.convoys) {
    const [sx, sy] = toScreen(cv.x, cv.y);
    if (sx < -30 || sy < -30 || sx > cw + 30 || sy > ch + 30) continue;
    const size = clamp(z * 1.15, 12, 34), spr = RAS[cv.tier];
    ctx.save(); ctx.translate(sx, sy);
    if (Math.cos(cv.ang || 0) < 0) ctx.scale(-1, 1);
    if (spr) ctx.drawImage(spr[size * dpr > 44 ? 0 : 1], -size / 2, -size * 0.6, size, size);
    ctx.restore();
    if (z >= 7) {
      const parts = Object.entries(cv.cargo).filter(([, v]) => v >= 1).map(([r, v]) => `${Math.round(v)} ${r}`);
      if (parts.length) pill(sx, sy - size * 0.75, parts.slice(0, 2).join(' · '), { size: 9, fg: cv.purpose === 'haul' ? '#f2c14e' : '#7bd389' });
    }
  }
}
// a construction site: the building, faint, with a turning gear over it
function drawSites(z) {
  for (const b of game.buildings) {
    if (!b.site) continue;
    const [sx, sy] = toScreen(...tileCenter(b.i));
    if (sx < -40 || sy < -40 || sx > cw + 40 || sy > ch + 40) continue;
    const s = clamp(z * 1.2, 14, 34);
    ctx.save(); ctx.translate(sx, sy - (z >= CFG.cityZoom ? z * 0.9 : 0)); ctx.rotate(game.time * 1.6);
    if (SPR.gear.complete) ctx.drawImage(SPR.gear, -s / 2, -s / 2, s, s);
    ctx.restore();
    if (z >= 3) {
      const left = Object.entries(b.site.need).filter(([, v]) => v >= 0.5).map(([r, v]) => `${Math.ceil(v)} ${r}`).join(' · ');
      if (left) pill(sx, sy + Math.max(16, z * 0.9), b.site.waiting ? `waiting for ${b.site.waiting}` : `${left} on the way`, { size: 9.5, fg: '#f2c14e' });
    }
  }
}

function render() {
  const z = cam.zoom;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawSpace(z);
  canvas.style.cursor = '';
  drawSun(z);
  drawVulcan(z);
  drawOuterBodies(z);
  drawMoon(z);
  drawLockHover(z);

  // terrain + territory (1 px per tile, scaled up crisp)
  // crisp pixels up close; smooth scaling when zoomed far out (less shimmer)
  ctx.imageSmoothingEnabled = z < 1.5;
  drawWorldImage(terrainCanvas);
  flushLayer(fillLayer); flushLayer(borderLayer);
  drawWorldImage(fillLayer.c);
  if (z < PIXEL_BORDER_BELOW) drawWorldImage(borderLayer.c);
  ctx.imageSmoothingEnabled = true;

  // visible tile range (check all four screen corners, since the camera can be rotated)
  const corners = [toWorld(0, 0), toWorld(cw, 0), toWorld(0, ch), toWorld(cw, ch)];
  const wx0 = Math.min(...corners.map(c => c[0])), wx1 = Math.max(...corners.map(c => c[0]));
  const wy0 = Math.min(...corners.map(c => c[1])), wy1 = Math.max(...corners.map(c => c[1]));
  const x0 = clamp(Math.floor(wx0) - 1, 0, W - 1), x1 = clamp(Math.ceil(wx1) + 1, 0, W - 1);
  const y0 = clamp(Math.floor(wy0) - 1, 0, H - 1), y1 = clamp(Math.ceil(wy1) + 1, 0, H - 1);

  // close up: border as crisp lines along tile edges that face unowned land/water
  if (z >= PIXEL_BORDER_BELOW) {
    const paths = { blue: new Path2D() };
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = idx(x, y);
      if (!owner[i]) {
        const a = aiOf[i];
        if (!a) continue;
        const q = paths['n' + a] || (paths['n' + a] = new Path2D());
        const [sx, sy] = toScreen(x, y);
        if (x === 0 || aiOf[i - 1] !== a) { q.moveTo(sx, sy); q.lineTo(sx, sy + z); }
        if (x === W - 1 || aiOf[i + 1] !== a) { q.moveTo(sx + z, sy); q.lineTo(sx + z, sy + z); }
        if (y === 0 || aiOf[i - W] !== a) { q.moveTo(sx, sy); q.lineTo(sx + z, sy); }
        if (y === H - 1 || aiOf[i + W] !== a) { q.moveTo(sx, sy + z); q.lineTo(sx + z, sy + z); }
        continue;
      }
      const p = paths.blue;
      const [sx, sy] = toScreen(x, y);
      if (x === 0 || !owner[i - 1]) { p.moveTo(sx, sy); p.lineTo(sx, sy + z); }
      if (x === W - 1 || !owner[i + 1]) { p.moveTo(sx + z, sy); p.lineTo(sx + z, sy + z); }
      if (y === 0 || !owner[i - W]) { p.moveTo(sx, sy); p.lineTo(sx + z, sy); }
      if (y === H - 1 || !owner[i + W]) { p.moveTo(sx, sy + z); p.lineTo(sx + z, sy + z); }
    }
    ctx.lineCap = 'square';
    ctx.lineWidth = Math.min(4, 1.5 + z * 0.12);
    ctx.strokeStyle = '#1c62d6'; ctx.stroke(paths.blue);
    for (const key in paths) if (key[0] === 'n') { ctx.strokeStyle = game.nations[+key.slice(1) - 1].hex; ctx.stroke(paths[key]); }
    ctx.lineCap = 'butt';
  }

  drawRoads(z);
  // roads, rail lines and air routes (sea routes aren't drawn: the ships sailing them are enough)
  for (const L of game.links) if (L.kind === 'road') strokeRoute(L.path, 'road', z);
  for (const L of game.links) if (L.kind === 'rail') strokeRoute(L.path, 'rail', z);
  for (const L of game.links) if (L.kind === 'air') strokeRoute(L.path, 'air', z);

  if (z >= CFG.detailZoom) {
    // detail view: every deposit tile and building as a sprite
    drawDepositsDetail(x0, y0, x1, y1, z);
    for (const b of game.buildings) {
      const x = b.i % W, y = (b.i / W) | 0;
      if (b.type === 'settlement' && x >= x0 - 9 && x <= x1 + 9 && y >= y0 - 9 && y <= y1 + 9) drawSettlementDetail(b, z);
    }
    for (const b of game.buildings) {
      const x = b.i % W, y = (b.i / W) | 0;
      if (b.type === 'settlement' || x < x0 || x > x1 || y < y0 || y > y1) continue;
      drawSprite(b.type, x + 0.5, y + 0.5, z * (b.type === 'solar' ? 1.15 : 1.25), underway(b) ? 0.45 : 1);
    }
  } else if (z >= CFG.cityZoom) {
    // middle view: buildings as solid squares
    for (const b of game.buildings) {
      if (b.type === 'settlement') continue;
      const [sx, sy] = toScreen(b.i % W, (b.i / W) | 0);
      ctx.fillStyle = BLD_COLOR[b.type];
      if (underway(b)) ctx.globalAlpha = 0.45;
      ctx.fillRect(sx + z * 0.12, sy + z * 0.12, z * 0.76, z * 0.76);
      ctx.globalAlpha = 1;
    }
    drawSettlementPixels(z);
  } else {
    // map view: settlements as clusters of pixels, station/port icons. Deposits show as their own coloured ground.
    for (const b of game.buildings) {
      if (!linkKind(b.type) && b.type !== 'base' && b.type !== 'fort') continue;
      if (z < 0.6 && !owner[b.i]) continue;
      const [sx, sy] = toScreen(...tileCenter(b.i));
      ctx.beginPath(); ctx.arc(sx, sy, 8, 0, Math.PI * 2); ctx.fillStyle = 'rgba(20,26,37,0.85)'; ctx.fill();
      if (SPR[b.type].complete) ctx.drawImage(SPR[b.type], sx - 8, sy - 8, 16, 16);
    }
    drawSettlementPixels(z);
  }

  drawVehicles(z);
  drawSites(z);
  drawBuildPreview(z);
  drawReachHover(z);
  drawSettlementHover(z);
  drawMissiles(z);
  drawTroops(z);
  drawDiskLabel(z);

  drawCountryLabels(z);


  // pushes: gold number at the advancing edge
  for (const p of game.pushes) {
    if (p.lx == null) { const [a, b] = nearestFrontier(p.tx, p.ty); p.lx = a; p.ly = b; }
    if (p.mx == null) { p.mx = p.lx; p.my = p.ly; }
    p.mx += (p.lx - p.mx) * 0.15; p.my += (p.ly - p.my) * 0.15;
    const [sx, sy] = toScreen(p.mx, p.my);
    const label = `${Math.ceil(p.budget)}`;
    const w = pill(sx, sy, label, { fg: '#f2c14e', border: '#f2c14e', size: 13, bold: 800, dot: '#141a25' });
    if (SPR.person.complete) ctx.drawImage(SPR.person, sx - w / 2 + 3, sy - 9, 18, 18);
  }

  // a nation's soldiers pushing into your land: the number left, at the advancing edge
  for (const r of game.raids) {
    if (r.lx == null) continue;
    if (r.mx == null) { r.mx = r.lx; r.my = r.ly; }
    r.mx += (r.lx - r.mx) * 0.15; r.my += (r.ly - r.my) * 0.15;
    const [sx, sy] = toScreen(r.mx, r.my), n = game.nations[r.n];
    const w = pill(sx, sy, `  ${Math.ceil(r.budget)}`, { fg: '#fff', bg: 'rgba(60,16,16,0.92)', border: n.hex, size: 13, bold: 800, dot: n.hex });
    const hm = RAS[unitStats(n.R).helm];
    if (hm) ctx.drawImage(hm[1], sx - w / 2 + 2, sy - 11, 21, 21);
  }

  // expeditions
  for (const e of game.expeditions) {
    if (!e.auto) { drawVehicle(e, z); continue; }
    const [sx, sy] = toScreen(e.x, e.y), [tx, ty] = toScreen(e.tx, e.ty);
    ctx.setLineDash([2, 9]); ctx.lineCap = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = '#f2c14e';
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.setLineDash([]); ctx.lineCap = 'butt';
    ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(tx, ty, 9, 0, Math.PI * 2); ctx.stroke();
    const overWater = biome[idx(Math.floor(e.x), Math.floor(e.y))] === OCEAN;
    ctx.beginPath(); ctx.arc(sx, sy, 16, 0, Math.PI * 2);
    ctx.fillStyle = '#141a25'; ctx.fill(); ctx.strokeStyle = '#f2c14e'; ctx.lineWidth = 2.5; ctx.stroke();
    const spr = overWater ? SPR.boat : SPR.truck;
    if (spr.complete) ctx.drawImage(spr, sx - 13, sy - 13, 26, 26);
    const eta = Math.hypot(e.tx - e.x, e.ty - e.y) / CFG.expeditionSpeed;
    pill(sx, sy + 30, `${e.n} people · ${eta.toFixed(0)}s`, { dot: '#f2c14e', size: 11 });
  }

  // floating texts
  for (const f of game.floats) {
    const [sx, sy] = toScreen(f.x, f.y);
    ctx.globalAlpha = clamp(1.7 - f.t / 1.4, 0, 1);
    pill(sx, sy - 18 - f.t * 22, f.text, { fg: f.color, size: 12 });
    ctx.globalAlpha = 1;
  }
}

// Forests and deposits up close. Each tile gets a patch of ground (forest floor, gravel, rust-stained earth)
// and one to three pieces picked by the tile's own hash: mixed trees with stands of conifers, boulders and
// rubble, ore chunks with bright flecks. Thick in the middle of a deposit, thinner and smaller at its edge.
const GROUND = { forest: 'rgba(32,62,30,0.36)', stone: 'rgba(118,122,126,0.38)', iron: 'rgba(120,66,44,0.42)',
  gold: 'rgba(160,120,30,0.35)', oil: 'rgba(10,10,12,0.45)', wheat: 'rgba(150,110,30,0.18)', uranium: 'rgba(60,140,40,0.35)' };
const ROCKS = { stone: ['rockA', 'rockB', 'rockC'], iron: ['oreA', 'oreB', 'oreC'] };
function drawDepositsDetail(x0, y0, x1, y1, z) {
  const ground = { forest: new Path2D(), stone: new Path2D(), iron: new Path2D(), gold: new Path2D(), oil: new Path2D(), wheat: new Path2D(), uranium: new Path2D() };
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const dep = depositOf[idx(x, y)];
    if (!depVisible(dep)) continue;
    const [sx, sy] = toScreen(x + 0.5 + (hash2(x, y, 31) - 0.5) * 0.3, y + 0.5 + (hash2(x, y, 32) - 0.5) * 0.3);
    const r = z * (0.62 + hash2(x, y, 33) * 0.2), g = ground[deposits[dep].type];
    g.moveTo(sx + r, sy); g.arc(sx, sy, r, 0, Math.PI * 2);
  }
  for (const t in ground) { ctx.fillStyle = GROUND[t]; ctx.fill(ground[t]); }
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {     // row by row, so nearer rows overlap the ones behind
    const i = idx(x, y), dep = depositOf[i];
    if (!depVisible(dep) || building[i]) continue;
    const t = deposits[dep].type;
    if (t === 'wheat' || t === 'gold' || t === 'oil' || t === 'uranium') {
      const h1 = hash2(x, y, 21);
      if (t === 'wheat') { drawSprite('wheatTile', x + 0.3, y + 0.5, z * 0.9); drawSprite('wheatTile', x + 0.75, y + 0.55, z * 0.85); }
      else drawSprite(DEP_SPRITE[t], x + 0.5 + (h1 - 0.5) * 0.4, y + 0.5, z * (t === 'oil' ? 0.9 : 0.8 + h1 * 0.4));
      continue;
    }
    let same = 0;
    for (const [dx, dy] of DIRS4) if (inb(x + dx, y + dy) && depositOf[idx(x + dx, y + dy)] === dep) same++;
    const inner = same === 4, n = inner ? (t === 'forest' ? 2 : 2 + (hash2(x, y, 41) < 0.35 ? 1 : 0)) : 1;
    const pine = t === 'forest' && vnoise(x / 7, y / 7, 99) > 0.56;   // conifers come in stands
    for (let k = 0; k < n; k++) {
      const h1 = hash2(x + k * 17, y, 21), h2 = hash2(x, y + k * 17, 22), h3 = hash2(x + k * 5, y + k * 3, 23);
      const wx = x + 0.5 + (h1 - 0.5) * 0.85, wy = y + 0.5 + (h2 - 0.5) * 0.6 + (k - (n - 1) / 2) * 0.3;
      if (t === 'forest') {
        const name = pine ? (h3 < 0.78 ? 'treeC' : 'treeB') : h3 < 0.42 ? 'treeA' : h3 < 0.76 ? 'treeB' : h3 < 0.92 ? 'treeD' : 'treeC';
        drawSprite(name, wx, wy, z * (1.75 + h1 * 0.9) * (inner ? 1 : 0.78));
      } else {
        const big = inner && k === 0, name = ROCKS[t][big ? (h3 < 0.6 ? 0 : 1) : h3 < 0.3 ? 0 : h3 < 0.65 ? 1 : 2];
        drawSprite(name, wx, wy, z * (big ? 2.1 + h1 * 0.6 : 1.35 + h1 * 0.7));
      }
    }
  }
}

// The houses around a settlement are drawn, not built: more of them (and bigger ones) as it grows.
// Always the same spots for the same settlement, skipping water, deposits and real buildings.
function sprawlOf(b) {
  const lvl = settlementLevel(b), n = Math.min(26, Math.floor(settlementCap(b) / 8));
  if (b._n === n && b._lvl === lvl) return b.sprawl;
  const side = sideOf(b.i), cx = b.i % W, cy = (b.i / W) | 0, out = [], used = new Set([b.i]);
  for (let k = 0; k < 90 && out.length < n; k++) {
    const a = hash2(b.i % 9973, k, 71) * Math.PI * 2, rad = 1.7 + hash2(b.i % 9973, k, 72) * (1.2 + Math.sqrt(k) * 0.55);
    const x = Math.round(cx + Math.cos(a) * rad), y = Math.round(cy + Math.sin(a) * rad);
    if (!inb(x, y)) continue;
    const t = idx(x, y);
    if (used.has(t) || !isLand(t) || sideOf(t) !== side || building[t] || hasDep(t)) continue;
    used.add(t);
    out.push({ x, y, type: lvl >= 3 && rad < 3.2 ? 'house3' : lvl >= 2 && rad < 3.8 ? 'house2' : 'house' });
  }
  out.sort((p, q) => p.y - q.y);
  b._n = n; b._lvl = lvl; b.sprawl = out;
  return out;
}
const OWN_HEX = '#2f7de1';
function drawSettlementDetail(b, z) {
  const x = b.i % W, y = (b.i / W) | 0, lvl = settlementLevel(b);
  for (const h of sprawlOf(b)) drawSprite(h.type, h.x + 0.5, h.y + 0.5, z * (h.type === 'house' ? 1.2 : 1.0));
  drawSprite('settle' + (lvl + 1), x + 0.5, y + 0.3, z * (2.5 + lvl * 0.35));
}
// Zoomed out, a settlement is drawn as what it is: a cluster of little coloured blocks, one per house, in the same
// spots as its houses up close. Red roofs for houses, blue for apartments, pale grey for city blocks, and a bright
// block at the centre. A hamlet is a few specks; a city is a patch you can't miss. No icons to cover the map.
const PIXEL = { house: '#d9694a', house2: '#6f97c4', house3: '#d3dbe4' };
function drawSettlementPixels(z) {
  if (z < 0.15) return;                            // from orbit the whole disk is only a few pixels
  const px = Math.max(z * 0.82, 1.7), edge = px >= 4 ? 1 : 0.5;
  for (const b of game.buildings) {
    if (b.type !== 'settlement') continue;
    const [cx, cy] = toScreen(...tileCenter(b.i));
    if (cx < -60 || cy < -60 || cx > cw + 60 || cy > ch + 60) continue;
    const dot = (wx, wy, size, color) => {
      const [sx, sy] = toScreen(wx + 0.5, wy + 0.5);
      ctx.fillStyle = 'rgba(20,26,37,0.85)'; ctx.fillRect(sx - size / 2 - edge, sy - size / 2 - edge, size + edge * 2, size + edge * 2);
      ctx.fillStyle = color; ctx.fillRect(sx - size / 2, sy - size / 2, size, size);
    };
    for (const h of sprawlOf(b)) dot(h.x, h.y, px, PIXEL[h.type]);
    dot(b.i % W, (b.i / W) | 0, px * 1.5, isRuin(b) ? '#6b6258' : '#f2d98a');
  }
}
function reachRing(i, color, z, dash = [7, 6], R = CFG.settlement.reach) {
  const [sx, sy] = toScreen(...tileCenter(i));
  ctx.beginPath(); ctx.arc(sx, sy, (R + 0.5) * z, 0, Math.PI * 2);
  ctx.setLineDash(dash); ctx.lineWidth = 1.8; ctx.strokeStyle = color; ctx.stroke(); ctx.setLineDash([]);
}
// placing a settlement: the land it would add in green, land another settlement already serves in grey
function drawReachPreview(i, z) {
  for (const b of game.buildings) if (b.type === 'settlement' && owner[b.i]) reachRing(b.i, 'rgba(255,255,255,0.28)', z, [3, 7]);
  const side = sideOf(i);
  if (side > 0 && z >= 1.5) {
    eachInReach(i, t => {
      if (sideOf(t) !== side || !isLand(t)) return;
      const [sx, sy] = toScreen(t % W, (t / W) | 0);
      ctx.fillStyle = isServed(t) ? 'rgba(150,158,170,0.30)' : 'rgba(123,211,137,0.30)';
      ctx.fillRect(sx, sy, z + 0.5, z + 0.5);
    });
  }
  reachRing(i, '#7bd389', z);
}
// placing a collector: deposit tiles it would work in green, tiles another collector already works in grey
function drawHarvestPreview(i, type, z) {
  const cid = sideOf(i), kinds = HARVESTS[type], upgrade = type === 'rig';
  if (owner[i] && z >= 1.5) eachInReach(i, t => {
    if (!harvestable(t, cid, kinds)) return;
    const [sx, sy] = toScreen(t % W, (t / W) | 0);
    ctx.fillStyle = isHarvested(t) && !upgrade ? 'rgba(150,158,170,0.45)' : 'rgba(123,211,137,0.45)';
    ctx.fillRect(sx, sy, z + 0.5, z + 0.5);
  }, CFG.collectorReach);
  reachRing(i, '#7bd389', z, [5, 5], CFG.collectorReach);
}
// pointing at (or near) a settlement shows what it is and how many people live there; nothing is written on it otherwise
function drawSettlementHover(z) {
  if (!mouse.in || mouse.down >= 0) return;
  let best = null, bd = Math.max(20, z * 1.8);
  for (const b of game.buildings) {
    if (b.type !== 'settlement') continue;
    const [sx, sy] = toScreen(...tileCenter(b.i)), d = Math.hypot(sx - mouse.x, sy - mouse.y);
    if (d < bd) { bd = d; best = { b, sx, sy }; }
  }
  if (!best) return;
  const b = best.b, foe = nationAt(b.i), who = foe || countryAt(b.i), cap = settlementCap(b), lvl = settlementLevel(b);
  const living = who && who.cap > 0 ? who.people * cap / who.cap : 0;
  const r = z >= CFG.detailZoom ? z * (1.5 + lvl * 0.18) : 11 + lvl * 3;
  pill(best.sx, best.sy + r + 14, isRuin(b) ? `Ruins · mending (would hold ${Math.round(b.full)})` : `${CFG.settlement.levels[lvl].name} · ${fmtNum(living)} people · holds ${Math.round(cap)}`, { dot: foe ? foe.hex : OWN_HEX, size: 11 });
}
// pointing at a settlement (with nothing else selected) shows the land it reaches
function drawReachHover(z) {
  if (game.tool || game.aiming || !mouse.in) return;
  const t = hoverTile();
  if (t && building[t.i] === BLD_CODE.settlement) reachRing(t.i, '#f2c14e', z);
  else if (t && building[t.i] && HARVESTS[buildingAt(t.i).type]) reachRing(t.i, '#f2c14e', z, [5, 5], CFG.collectorReach);
  else if (t && building[t.i] === BLD_CODE.mortar) reachRing(t.i, aiOf[t.i] ? 'rgba(255,122,107,0.9)' : '#f2c14e', z, [4, 5], CFG.weapons.shell.range);
  else if (t && building[t.i] === BLD_CODE.turret) reachRing(t.i, aiOf[t.i] ? 'rgba(255,122,107,0.9)' : '#f2c14e', z, [4, 5], CFG.turret.range);
  else if (t && building[t.i] === BLD_CODE.airdef) reachRing(t.i, aiOf[t.i] ? 'rgba(120,200,255,0.9)' : '#f2c14e', z, [6, 5], CFG.airDefense.range);
}

// a vehicle you drive: the trail it has left, where it would settle, the vehicle itself, and its supplies
function drawVehicle(e, z) {
  const mine = game.driving === e, [sx, sy] = toScreen(e.x, e.y);
  if (e.trail.length > 1) {
    ctx.beginPath();
    e.trail.forEach((p, k) => { const [x, y] = toScreen(p[0], p[1]); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.lineTo(sx, sy);
    ctx.setLineDash([2, 8]); ctx.lineCap = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(242,193,78,0.75)'; ctx.stroke();
    ctx.setLineDash([]); ctx.lineCap = 'butt';
  }
  if (mine) {                                      // the land a settlement here would start with
    const site = settleSite(e);
    if (site) {
      const [cx, cy] = toScreen(...tileCenter(site.i)), ok = site.how === 'found';
      ctx.beginPath(); ctx.arc(cx, cy, (CFG.outpostRadius + 0.5) * z, 0, Math.PI * 2);
      ctx.fillStyle = ok ? 'rgba(123,211,137,0.14)' : 'rgba(47,125,225,0.14)'; ctx.fill();
      ctx.setLineDash([6, 5]); ctx.lineWidth = 1.8; ctx.strokeStyle = ok ? '#7bd389' : OWN_HEX; ctx.stroke(); ctx.setLineDash([]);
    }
  }
  const tier = e.kind === 'boat' ? boatTier(game.research.done) : roadTier(game.research.done);
  const size = clamp(z * 3.4, 46, 84), spr = RAS[tier] ? RAS[tier][0] : null, left = Math.cos(e.a) < 0;
  ctx.save();
  ctx.translate(sx, sy);
  if (mine) { ctx.beginPath(); ctx.arc(0, 0, size * 0.62, 0, Math.PI * 2); ctx.strokeStyle = '#f2c14e'; ctx.lineWidth = 2; ctx.stroke(); }
  // a small arrow for the heading, then the vehicle (a truck turns with it; a boat just faces left or right)
  ctx.save(); ctx.rotate(e.a);
  ctx.beginPath(); ctx.moveTo(size * 0.82, 0); ctx.lineTo(size * 0.62, -size * 0.13); ctx.lineTo(size * 0.62, size * 0.13); ctx.closePath();
  ctx.fillStyle = '#f2c14e'; ctx.fill();
  ctx.restore();
  if (left) ctx.scale(-1, 1);                      // side-on pixel art: it faces the way it's heading
  ctx.beginPath(); ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2); ctx.fillStyle = 'rgba(20,26,37,0.55)'; ctx.fill();
  if (spr) ctx.drawImage(spr, -size / 2, -size / 2, size, size);
  ctx.restore();
  // supplies bar and what's on board
  const S = clamp(e.supplies / CFG.drive.supplies, 0, 1), bw = 64, by = sy + size * 0.62 + 6;
  ctx.fillStyle = 'rgba(20,26,37,0.9)'; ctx.fillRect(sx - bw / 2 - 2, by - 2, bw + 4, 9);
  ctx.fillStyle = S > 0.25 ? '#f2c14e' : '#ff7a6b'; ctx.fillRect(sx - bw / 2, by, bw * S, 5);
  const load = Object.entries(e.kit).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${k}`).join(' · ');
  pill(sx, by + 20, e.supplies > 0 ? `${Math.floor(e.n)} people${load ? ' · ' + load : ''} · supplies ${Math.ceil(e.supplies)}s`
    : `${Math.floor(e.n)} people · out of supplies!`, { dot: e.supplies > 0 ? '#f2c14e' : '#ff7a6b', fg: e.supplies > 0 ? '#eef2f8' : '#ff7a6b', size: 11 });
  if (mine) pill(sx, by + 42, say('Arrows / WASD drive · Space settle here · Esc let go', 'Steer with the pad · Settle here · Park'), { size: 11, fg: '#aab4c4' });
  else pill(sx, by + 42, 'Parked · X to drive', { size: 11, fg: '#aab4c4' });
}

// country names written across their territory when you're zoomed out (hidden up close, where you see the details)
function drawCountryLabels(z) {
  if (z < 0.15) return;
  const under = (people, sx, sy, size, color, units) => {   // the population, in smaller type under the name, and troops in green below it
    const s2 = Math.max(10, size * 0.6), txt = `${fmtNum(people)} people`;
    ctx.font = `700 ${s2}px 'Segoe UI', Inter, Arial, sans-serif`; ctx.letterSpacing = '0px';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,14,24,0.75)'; ctx.strokeText(txt, sx, sy + size * 0.55 + s2 * 0.7);
    ctx.fillStyle = color; ctx.fillText(txt, sx, sy + size * 0.55 + s2 * 0.7);
    if (units >= 1) {
      const s3 = Math.max(9, s2 * 0.85), t3 = `${fmtNum(units)} units`, y3 = sy + size * 0.55 + s2 * 0.7 + s3 * 1.2;
      ctx.font = `800 ${s3}px 'Segoe UI', Inter, Arial, sans-serif`;
      ctx.strokeText(t3, sx, y3); ctx.fillStyle = '#7bd389'; ctx.fillText(t3, sx, y3);
    }
  };
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const c of game.countries) {
    if (!c.alive || !c.tiles) continue;
    const span = Math.sqrt(c.tiles) * z;           // rough on-screen size of the country
    if (span < 18) continue;
    const [sx, sy0] = toScreen(c.lx, c.ly);
    const size = clamp(span * 0.16, 11, 26);
    const sy = sy0 + (z < CFG.detailZoom ? 14 + size * 0.6 : z * 3.2);   // sit below the settlement at the centre
    const text = (span > 140 ? c.full : c.short).toUpperCase();
    ctx.font = `800 ${size}px 'Segoe UI', Inter, Arial, sans-serif`;
    ctx.letterSpacing = `${Math.round(size * 0.12)}px`;
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(10,14,24,0.75)'; ctx.strokeText(text, sx, sy);
    ctx.fillStyle = c.id === game.active ? '#ffffff' : 'rgba(214,228,255,0.88)'; ctx.fillText(text, sx, sy);
    under(c.people, sx, sy, size, '#f2c14e', unitsIn(c));
  }
  for (const n of game.nations) {
    if (!n.alive) continue;
    const span = Math.sqrt(n.tiles) * z;
    if (span < 18) continue;
    const [sx, sy0] = toScreen(n.lx, n.ly);
    const size = clamp(span * 0.14, 10, 22);
    const sy = sy0 + (z < CFG.cityZoom ? 14 + size * 0.6 : 0);
    const text = (span > 160 ? n.full : n.short).toUpperCase();
    ctx.font = `800 ${size}px 'Segoe UI', Inter, Arial, sans-serif`;
    ctx.letterSpacing = `${Math.round(size * 0.12)}px`;
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(10,14,24,0.75)'; ctx.strokeText(text, sx, sy);
    const [r, g, b] = n.col;
    ctx.fillStyle = `rgb(${Math.min(255, r + 60)},${Math.min(255, g + 60)},${Math.min(255, b + 60)})`; ctx.fillText(text, sx, sy);
    under(n.people, sx, sy, size, 'rgba(255,255,255,0.85)', n.units);
  }
  ctx.restore();
}

function nearestFrontier(tx, ty) {
  let best = null, bd = Infinity;
  for (const i of frontier) {
    const d = (i % W - tx) ** 2 + (((i / W) | 0) - ty) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return best == null ? [tx, ty] : [best % W + 0.5, ((best / W) | 0) + 0.5];
}

// ======================================================================
// input
// ======================================================================
// any drag pans (or, in build mode, drags the building you're placing) · plain clicks = actions
const mouse = { x: 0, y: 0, down: -1, sx: 0, sy: 0, dragged: false, camX: 0, camY: 0, in: false, ghost: false };

function hoverTile() {
  const [wx, wy] = toWorld(mouse.x, mouse.y);
  const x = Math.floor(wx), y = Math.floor(wy);
  return inb(x, y) ? { x, y, i: idx(x, y) } : null;
}
const tileAtScreen = (x, y) => { const [wx, wy] = toWorld(x, y), tx = Math.floor(wx), ty = Math.floor(wy); return inb(tx, ty) ? idx(tx, ty) : -1; };
// is a screen point on (or right by) the building being placed? Then a drag moves it instead of the map.
function onGhost(x, y) {
  const g = game.ghost;
  if (!g || g.i < 0) return false;
  const [gx, gy] = toScreen(...tileCenter(g.i));
  return Math.hypot(gx - x, gy - y) < Math.max(26, cam.zoom * 1.6);
}
function moveGhost(x, y) {
  const t = tileAtScreen(x, y);
  if (t >= 0 && game.ghost) { game.ghost.i = t; game.ghost.set = true; }
}

canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('mousedown', e => {
  if (performance.now() - lastTouch < 800) return;   // the browser's copy of a tap: the touch code has it
  mouse.x = e.clientX; mouse.y = e.clientY; mouse.in = true;
  mouse.down = e.button; mouse.sx = e.clientX; mouse.sy = e.clientY; cam.anim = null;
  mouse.dragged = false; mouse.camX = cam.x; mouse.camY = cam.y;
  mouse.offX = cam.offX; mouse.offY = cam.offY;
  mouse.ghost = e.button === 0 && game.ghost && game.ghost.set && onGhost(e.clientX, e.clientY);
  if (e.button === 1) e.preventDefault();   // no browser autoscroll on middle-drag
});
window.addEventListener('mousemove', e => {
  mouse.x = e.clientX; mouse.y = e.clientY;
  if (game.ghost && !game.ghost.set && mouse.down < 0) moveGhostSoft(e.clientX, e.clientY);
  if (mouse.down < 0) return;
  const dx = e.clientX - mouse.sx, dy = e.clientY - mouse.sy;
  if (!mouse.dragged && Math.hypot(dx, dy) > 5) { mouse.dragged = true; if (!mouse.ghost) canvas.classList.add('dragging'); }
  if (!mouse.dragged) return;
  if (mouse.ghost) { moveGhost(e.clientX, e.clientY); return; }
  if (cam.follow) { cam.offX = mouse.offX - dx / cam.zoom; cam.offY = mouse.offY - dy / cam.zoom; }
  else { cam.x = mouse.camX - dx / cam.zoom; cam.y = mouse.camY - dy / cam.zoom; clampCam(); }
});
// on a desktop, a building you just picked follows the mouse until you click to put it down
function moveGhostSoft(x, y) { const t = tileAtScreen(x, y); if (t >= 0) game.ghost.i = t; }
window.addEventListener('mouseup', e => {
  const wasDrag = mouse.dragged, btn = mouse.down;
  mouse.down = -1; mouse.dragged = false; mouse.ghost = false; canvas.classList.remove('dragging');
  if (btn < 0) return;
  mouse.x = e.clientX; mouse.y = e.clientY;
  if (wasDrag || e.target !== canvas) return;
  clickAt(btn, e.clientX, e.clientY);
});
// a click (or a tap: btn 0; a long press: btn 2) at a screen point
function clickAt(btn, x, y) {
  mouse.x = x; mouse.y = y;
  if (btn === 0 && game.aiming) { const t = hoverTile(); if (t) fireMissile(t.x, t.y); return; }
  if (btn === 2 && game.aiming) { setAiming(false); return; }
  if (game.ghost) {                                // build mode: a click puts the building there; Confirm builds it
    if (btn === 0) { moveGhost(x, y); updateConfirm(); }
    else setTool(null);
    return;
  }
  // a plain click on any body (or your world from far out) locks onto it
  if (btn === 0) {
    const [wx, wy] = toWorld(x, y);
    const body = bodyUnder(wx, wy);
    if (body && cam.follow !== body.id) { followBody(body.id); return; }
    if (!body && worldLockable() && overWorld(wx, wy)) { lockWorld(); return; }
  }
  const t = hoverTile();
  if (!t) return;
  if (game.over) return toast(`Your last domain has fallen. Start a new map from the Command menu.`);
  if (btn === 2) { launchExpedition(t.x, t.y); return; }
  commandClick(t);
}
// Command mode: what a click on the map does
function commandClick(t) {
  const foe = nationAt(t.i);
  if (game.cmd === 'expedition') {
    if (owner[t.i]) return toast('Pick a spot outside your border for the expedition to head for.');
    launchExpedition(t.x, t.y); setCmd('expand'); return;
  }
  if (game.cmd === 'attack') {
    if (!foe) return toast("Pick a nation's land to attack (tap Expand to claim free land).");
    launchAttack(foe, t.x, t.y); return;
  }
  if (game.wallFrom >= 0) {                       // picking the second fort for a wall
    const b = building[t.i] ? buildingAt(t.i) : null;
    if (b && b.type === 'fort' && owner[t.i]) return pickWallEnd(b);
    game.wallFrom = -1; toast('Wall cancelled'); return;
  }
  if (owner[t.i] && building[t.i] && cam.zoom >= 3) return showBuildingCard(buildingAt(t.i));
  showBuildingCard(null);
  if (owner[t.i]) {                                // clicking inside one of your domains selects it
    const c = countryAt(t.i);
    if (c && cam.zoom < CFG.cityZoom) flyToCountry(c);
    else if (c && c.id !== game.active) { game.active = c.id; toast(`Viewing ${c.full}`); }
    return;
  }
  if (foe) {
    if (strikePlan(foe, t.x, t.y)) return askAttack(foe, t.x, t.y);
    toast(`${foe.full} is beyond your troops' reach (${strikeReach()} tiles past your border). Expanding toward it: your people will stop at its border.`);
  }
  startPush(t.x, t.y);
}
// you clicked a neighbour's land: attack it, or just push your border up to theirs?
function askAttack(n, tx, ty) {
  const avail = garrisons().reduce((a, b) => a + Math.floor(b.units || 0), 0), send = Math.floor(avail * game.troopPct / 100), us = unitStats();
  const them = unitStats(n.R), plan = strikePlan(n, tx, ty), far = plan && plan.gap > 1.5;
  showModal(`<div class="md-title">Attack ${n.full}?</div>
    <div class="md-body">${send >= 1 ? `<b class="g">${send} ${us.type.name}</b> (${game.troopPct}% of your troops) will march from your fortresses${garrisons().some(b => b.type === 'fort') ? '' : ' and bases'}.`
      : `<span class="r">You have no troops ready.</span> ${isUnlocked('base') ? 'Military bases train them.' : `Research ${TECH.warrior.name} for military bases.`}`}
    They have about <b>${fmtNum(n.units)} ${them.type.name}</b> · ${n.pers.name}${n.hostile ? ' · at war with you' : ''}.
    ${far ? `<br>Your borders don't touch: the troops will cross ${Math.round(plan.gap)} tiles of open country (you can strike up to ${strikeReach()}) and take a foothold.` : ''}</div>`,
    [{ label: 'Attack', cls: 'danger', act: () => launchAttack(n, tx, ty), off: send < 1 },
     { label: far ? 'No, expand toward them' : 'No, stop at the border', act: () => { startPush(tx, ty); toast(`Your border will stop at ${n.short}'s.`); } }]);
}
canvas.addEventListener('mouseenter', () => { mouse.in = true; });
canvas.addEventListener('mouseleave', () => { mouse.in = false; });
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  cam.anim = null;
  const [bx, by] = toWorld(e.clientX, e.clientY);
  cam.zoom = clamp(cam.zoom * Math.exp(-e.deltaY * 0.0022), CFG.zoomMin, CFG.zoomMax);
  const [ax, ay] = toWorld(e.clientX, e.clientY);
  nudgeCam(bx - ax, by - ay);
}, { passive: false });

// double-click a body to lock onto it; double-click empty space to let go
canvas.addEventListener('dblclick', e => {
  if (performance.now() - lastTouch < 800 || game.ghost) return;
  const [wx, wy] = toWorld(e.clientX, e.clientY);
  const body = bodyUnder(wx, wy);
  if (body) followBody(body.id);
  else if (worldLockable() && overWorld(wx, wy)) lockWorld();
  else if (cam.follow) { stopFollow(); toast('Let go'); }
});

const keys = new Set();
window.addEventListener('keydown', e => {
  if (modalOpen) { if (e.key === 'Escape') closeModal(); return; }
  keys.add(e.key.toLowerCase());
  const k = e.key.toLowerCase();
  if (k === 'escape') cancelAll();
  if (k === 'enter' && game.ghost) { e.preventDefault(); confirmGhost(); }
  if (k === ' ' && game.driving) { e.preventDefault(); if (!e.repeat) settleExpedition(game.driving); }
  if (k === 'x' && !e.repeat) nextVehicle();
  if (k.startsWith('arrow') && game.driving) e.preventDefault();
  if (k === 'f' && !e.repeat) setAiming(!game.aiming);
  if ((k === 'e' || k === 'b') && !e.repeat) toggleBuildMenu();
  if (k === 'q' && !e.repeat) toggleCmdMenu();
  if (k === '1' && !e.repeat) setCmd('expand');
  if (k === '2' && !e.repeat) setCmd('attack');
  if (k === '3' && !e.repeat) setCmd('expedition');
  if (k === '[' || k === ']') {
    const opts = [10, 25, 50, 100];
    const j = clamp(opts.indexOf(game.sendPct) + (k === ']' ? 1 : -1), 0, opts.length - 1);
    setPct(opts[j]);
  }
  if (k === 'm') toggleMapView();
  // lock-on keys: L Moon, V Vulcan, R Aries, Z Zeus, P Poseidon, U Sun (press again to let go)
  if (!e.repeat) for (const en of LOCKABLE) {
    if (en.key !== k) continue;
    if (cam.follow === en.id) { stopFollow(); toast(`Let go of ${en.name}`); } else followBody(en.id);
  }
  if (k === 'h') goHome();
  if (k === 'tab') { e.preventDefault(); nextCountry(e.shiftKey ? -1 : 1); }
  if ('wasd'.includes(k) || k.startsWith('arrow')) cam.anim = null;
  if (k === 'n' && !e.repeat) askNewGame();
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));

// Esc: let go of whatever you're doing
function cancelAll() {
  if (game.driving && !game.tool && !buildOpen && !game.aiming) { game.driving = null; toast(say('Parked. Press X to take the wheel again.', 'Parked. Tap Drive to take the wheel again.')); }
  setTool(null); stopFollow(); setAiming(false); toggleBuildMenu(false); showBuildingCard(null); game.wallFrom = -1;
  if (game.cmd !== 'expand') setCmd('expand');
}
function goHome() { game.driving = null; stopFollow(); cam.anim = null; cam.x = spawn.x + 0.5; cam.y = spawn.y + 0.5; }
function nextCountry(dir) {
  const alive = game.countries.filter(c => c.alive && c.tiles);
  if (!alive.length) return;
  const j = alive.indexOf(activeCountry());
  flyToCountry(alive[(j + (dir < 0 ? alive.length - 1 : 1)) % alive.length]);
}
function askNewGame() {
  showModal('<div class="md-title">Start a new map?</div><div class="md-body">This deletes your saved game.</div>',
    [{ label: 'New map', cls: 'danger', act: newGame }, { label: 'Keep playing', act: () => {} }]);
}

// ---------- touch: one finger pans (or drags the building you're placing), two pinch-zoom, a tap is a click ----------
let lastTouch = -1e9;
const fingers = new Map();                         // finger id -> its last position
const tch = { drag: false, long: false, sx: 0, sy: 0, timer: 0, ghost: false };
function fingerMid() { const [a, b] = [...fingers.values()]; return [(a.x + b.x) / 2, (a.y + b.y) / 2, Math.hypot(a.x - b.x, a.y - b.y)]; }
canvas.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse') return;
  e.preventDefault(); lastTouch = performance.now();
  canvas.setPointerCapture(e.pointerId);
  fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  cam.anim = null;
  clearTimeout(tch.timer);
  if (fingers.size === 1) {
    tch.drag = false; tch.long = false; tch.sx = e.clientX; tch.sy = e.clientY;
    tch.ghost = !!(game.ghost && onGhost(e.clientX, e.clientY));
    tch.timer = setTimeout(() => {               // held still: a right-click (an expedition from there)
      if (fingers.size !== 1 || tch.drag || tch.ghost || game.ghost || game.aiming) return;
      tch.long = true;
      if (navigator.vibrate) navigator.vibrate(12);
      clickAt(2, tch.sx, tch.sy);
    }, 650);
  } else { tch.drag = true; tch.ghost = false; }   // a second finger: a pinch, never a tap
});
canvas.addEventListener('pointermove', e => {
  const f = e.pointerType !== 'mouse' && fingers.get(e.pointerId);
  if (!f) return;
  lastTouch = performance.now();
  if (fingers.size >= 2) {
    const [mx0, my0, d0] = fingerMid();
    f.x = e.clientX; f.y = e.clientY;
    const [mx1, my1, d1] = fingerMid();
    const [bx, by] = toWorld(mx1, my1);
    if (d0 > 0) cam.zoom = clamp(cam.zoom * d1 / d0, CFG.zoomMin, CFG.zoomMax);
    const [ax, ay] = toWorld(mx1, my1);
    nudgeCam(bx - ax, by - ay);
    nudgeScreen(-(mx1 - mx0) / cam.zoom, -(my1 - my0) / cam.zoom);
    return;
  }
  if (!tch.drag && Math.hypot(e.clientX - tch.sx, e.clientY - tch.sy) > 10) { tch.drag = true; clearTimeout(tch.timer); }
  if (tch.drag && tch.ghost) moveGhost(e.clientX, e.clientY);
  else if (tch.drag && !tch.long) nudgeScreen(-(e.clientX - f.x) / cam.zoom, -(e.clientY - f.y) / cam.zoom);
  f.x = e.clientX; f.y = e.clientY;
});
function liftFinger(e, cancelled) {
  if (e.pointerType === 'mouse' || !fingers.delete(e.pointerId)) return;
  lastTouch = performance.now();
  clearTimeout(tch.timer);
  if (tch.ghost && tch.drag) updateConfirm();
  if (fingers.size || cancelled || tch.drag || tch.long) return;
  touchTap(e.clientX, e.clientY);
}
canvas.addEventListener('pointerup', e => liftFinger(e, false));
canvas.addEventListener('pointercancel', e => liftFinger(e, true));
function touchTap(x, y) {
  clickAt(0, x, y);
  mouse.in = !!game.aiming;
}

function clampCam() {
  // you can pan out as far as the edge of the solar system
  const reach = SUN.dist + BODY.seedworld.orbit + BODY.seedworld.r * 6;
  cam.x = clamp(cam.x, DISK.cx - reach, DISK.cx + reach);
  cam.y = clamp(cam.y, DISK.cy - reach, DISK.cy + reach);
}
// M cycles: your view -> whole disk -> moon's orbit -> whole solar system -> back to your view
let mapStage = 0;
const orbitZoom = () => clamp(Math.min(cw, ch - 200) / (2 * (MOON.orbitR + MOON.r)) * 0.96, CFG.zoomMin, CFG.zoomMax);
const systemZoom = () => clamp(Math.min(cw, ch - 200) / (2 * (BODY.seedworld.orbit + BODY.seedworld.r * 2.5)) * 0.96, CFG.zoomMin, CFG.zoomMax);
function toggleMapView() {
  game.driving = null;
  stopFollow();
  if (mapStage === 0) {
    savedView = { ...cam }; mapStage = 1;
    cam.zoom = fitZoom(); cam.x = DISK.cx; cam.y = DISK.cy + 36 / cam.zoom;
  } else if (mapStage === 1) {
    mapStage = 2;
    cam.zoom = orbitZoom(); cam.x = DISK.cx; cam.y = DISK.cy + 36 / cam.zoom;
  } else if (mapStage === 2) {
    followBody('sun', { zoom: systemZoom(), quiet: true, keepView: true });   // the whole system, centred on the sun
    mapStage = 3;
  } else {
    if (savedView) Object.assign(cam, savedView);
    savedView = null; mapStage = 0;
  }
}
function panKeys(dt) {
  if (game.driving) {                              // at the wheel: the keys drive, and the camera rides along
    const e = game.driving, k = Math.min(1, dt * 7);
    cam.x += (e.x - cam.x) * k; cam.y += (e.y - cam.y) * k;
    return;
  }
  const s = 600 / cam.zoom * dt;
  let dx = 0, dy = 0;
  if (keys.has('arrowleft') || keys.has('a')) dx -= s;
  if (keys.has('arrowright') || keys.has('d')) dx += s;
  if (keys.has('arrowup') || keys.has('w')) dy -= s;
  if (keys.has('arrowdown') || keys.has('s')) dy += s;
  if (dx || dy) nudgeScreen(dx, dy);
}

// ---------- camera follow (lock onto a body) ----------
// Locking onto a body puts the camera in that body's reference frame. For moons and rocky
// planets the camera moves AND turns with it, so the body holds perfectly still on screen (a
// tidally locked moon's planet then hangs in one spot in its sky). For the sun and the gas
// giants the camera just rides along, so you can watch things orbit around them.
function followBody(id, { zoom, quiet, keepView } = {}) {
  const e = LOCK[id];
  game.driving = null;
  cam.follow = id;
  setCamRot(0);
  cam.a0 = e.frame === 'rotating' ? e.pos()[2] : 0;     // the body's spin angle at the moment you lock on
  cam.zoom = clamp(zoom || (e.zoom ? e.zoom() : Math.min(cw, ch - 200) / (e.r() * 2.4)), CFG.zoomMin, CFG.zoomMax);
  cam.offX = 0; cam.offY = 30 / cam.zoom;              // nudge it up a little, clear of the bottom panels
  if (!keepView) { savedView = null; mapStage = 0; }
  applyFollow();
  if (!quiet) toast(TOUCH ? `Locked onto ${e.name}. Tap Cancel to let go.` : `Locked onto ${e.name}. Press ${e.key ? e.key.toUpperCase() + ' or ' : ''}Esc to let go.`);
}
const followMoon = () => followBody('moon');
const followVulcan = () => followBody('vulcan');
const followSun = () => followBody('sun');

// lock onto your world: back to the normal frame (the game is centred on your world), showing the whole disk
function lockWorld() {
  stopFollow();
  setCamRot(0);
  cam.zoom = fitZoom(); cam.x = DISK.cx; cam.y = DISK.cy + 36 / cam.zoom;
  savedView = null; mapStage = 1;
  toast('Locked onto your world.');
}
// select a country and fly the camera to fit it
function flyToCountry(c) {
  if (!c) return;
  game.active = c.id;
  game.driving = null;
  stopFollow();
  const [x0, y0, x1, y1] = c.box;
  const z = clamp(Math.min(cw / (x1 - x0 + 16), (ch - 230) / (y1 - y0 + 16)), 1.2, 24);
  cam.anim = { x0: cam.x, y0: cam.y, z0: cam.zoom, x1: (x0 + x1) / 2 + 0.5, y1: (y0 + y1) / 2 + 0.5, z1: z, t: 0 };
  toast(`${c.full} · ${fmtNum(c.people)} people · ${c.tiles} tiles`);
}
function stepCamAnim(dt) {
  const a = cam.anim;
  if (!a) return;
  a.t = Math.min(1, a.t + dt / 0.7);
  const e = a.t < 0.5 ? 2 * a.t * a.t : 1 - (-2 * a.t + 2) ** 2 / 2;   // ease in-out
  cam.x = a.x0 + (a.x1 - a.x0) * e; cam.y = a.y0 + (a.y1 - a.y0) * e;
  cam.zoom = a.z0 * Math.pow(a.z1 / a.z0, e);
  if (a.t >= 1) cam.anim = null;
}
function stopFollow() {
  if (!cam.follow) return;
  cam.follow = null;
  setCamRot(0);
}
// move the view by a WORLD-space delta (e.g. zoom-toward-cursor).
// While locked on, offsets live in the moon's frame, so turn the delta into that frame first.
function nudgeCam(dx, dy) {
  if (cam.follow) {
    cam.offX += dx * cam.cos - dy * cam.sin;
    cam.offY += dx * cam.sin + dy * cam.cos;
  } else { cam.x += dx; cam.y += dy; clampCam(); }
}
// move the view by a SCREEN-direction delta (keys), in tiles
function nudgeScreen(dx, dy) {
  if (cam.follow) { cam.offX += dx; cam.offY += dy; }
  else { cam.x += dx; cam.y += dy; clampCam(); }
}
function applyFollow() {
  const e = cam.follow && LOCK[cam.follow];
  if (!e) return;
  const [mx, my, a] = e.pos();
  if (e.frame !== 'rotating') { setCamRot(0); cam.x = mx + cam.offX; cam.y = my + cam.offY; return; }
  const spin = a - cam.a0;
  setCamRot(-spin);
  // the offset is fixed to the moon's surface, so it turns with the moon
  const c = Math.cos(spin), s = Math.sin(spin);
  cam.x = mx + cam.offX * c - cam.offY * s;
  cam.y = my + cam.offX * s + cam.offY * c;
}

// ======================================================================
// HUD
// ======================================================================
function iconFill() {
  document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = SVG[el.dataset.icon]; });
}
const CATEGORIES = ['Housing', 'Food', 'Resources', 'Transport', 'Military', 'Energy'];
const costHtml = (cost, C) => Object.entries(cost).map(([r, n]) =>
  `<span class="${C && C.res[r] < n ? 'no' : ''}">${SVG[RES_ICON[r]]}${n}</span>`).join('');
function initUI() {
  document.querySelector('#topbar .res.country').addEventListener('click', () => flyToCountry(activeCountry()));
  const mk = (wrap, list, on, suffix = '%') => {
    for (const p of list) {
      const el = document.createElement('button');
      el.className = 'pbtn'; el.textContent = p + suffix; el.dataset.p = p;
      el.addEventListener('click', () => on(p));
      $(wrap).appendChild(el);
    }
  };
  mk('pct-buttons', [10, 25, 50, 100], setPct);
  mk('troop-buttons', [25, 50, 75, 100], setTroopPct);
  setPct(game.sendPct); setTroopPct(game.troopPct);
  $('btn-build').addEventListener('click', () => toggleBuildMenu());
  $('btn-cmd').addEventListener('click', () => { setTool(null); if (game.mode === 'command') toggleCmdMenu(); else setMode('command'); });
  $('bm-close').addEventListener('click', () => toggleBuildMenu(false));
  $('cm-close').addEventListener('click', () => toggleCmdMenu(false));
  $('cf-ok').addEventListener('click', confirmGhost);
  $('cf-cancel').addEventListener('click', () => setTool(null));
  $('recruit').addEventListener('click', () => { game.recruit = !game.recruit; toast(game.recruit ? 'Your bases are training troops' : 'Your bases have stopped training troops'); updateCmdMenu(); });
  $('cmdmenu').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.cmd) setCmd(b.dataset.cmd);
    const act = b.dataset.act;
    if (act === 'fire') setAiming(!game.aiming);
    else if (act === 'next') nextCountry(1);
    else if (act === 'map') toggleMapView();
    else if (act === 'home') goHome();
    else if (act === 'drive') nextVehicle();
    else if (act === 'new') askNewGame();
    updateCmdMenu();
  });
  $('modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
  $('bc-close').addEventListener('click', () => showBuildingCard(null));
  document.querySelectorAll('[data-warhead]').forEach(b => b.addEventListener('click', () => { game.warhead = b.dataset.warhead; updateCmdMenu(); }));
  for (const b of document.querySelectorAll('#dpad [data-key]')) {
    const k = b.dataset.key, up = () => { keys.delete(k); b.classList.remove('on'); };
    b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture(e.pointerId); keys.add(k); b.classList.add('on'); });
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
  }
  $('dp-settle').addEventListener('click', () => { if (game.driving) settleExpedition(game.driving); });
  $('dp-park').addEventListener('click', () => cancelAll());
  setMode('command');
  if (!TOUCH) toggleCmdMenu(true);
}
// ---------- modes: Build (place buildings) and Command (expand, attack, expeditions, fire) ----------
function setMode(m) {
  game.mode = m;
  $('btn-build').classList.toggle('on', m === 'build' || buildOpen);
  $('btn-cmd').classList.toggle('on', m === 'command' && !buildOpen);
}
function setCmd(c) {
  game.cmd = c;
  setTool(null); setAiming(false);
  if (c === 'attack') toast(say('Attack: click the land of a nation your border touches', 'Attack: tap the land of a nation your border touches'));
  if (c === 'expedition') toast(say('Expedition: click a spot outside your border (or right-click any time)', 'Expedition: tap a spot outside your border'));
  updateCmdMenu();
}
// pick a building: it appears in the middle of the screen (or under the mouse) to be moved, then confirmed
function setTool(t) {
  if (t && !isUnlocked(t)) return toast(`${CFG.buildings[t].name} needs ${TECH[CFG.buildings[t].tech].name}`);
  game.tool = t;
  if (t) {
    game.aiming = false;
    const c = tileAtScreen(cw / 2, ch / 2);
    let start = c;
    if (TOUCH || !mouse.in) {                     // start on your own land near the middle of the screen
      let best = -1, bd = Infinity;
      const cx = c % W, cy = (c / W) | 0;
      for (let dy = -30; dy <= 30; dy++) for (let dx = -30; dx <= 30; dx++) {
        const x = cx + dx, y = cy + dy, d = dx * dx + dy * dy;
        if (d < bd && inb(x, y) && !canBuild(idx(x, y), t)) { bd = d; best = idx(x, y); }
      }
      if (best >= 0) start = best;
    } else start = tileAtScreen(mouse.x, mouse.y);
    game.ghost = { type: t, i: start, set: TOUCH || !mouse.in };
    setMode('build');
    toggleCmdMenu(false, true);
  } else {
    game.ghost = null;
    if (game.mode === 'build') setMode('command');
  }
  $('confirmbar').classList.toggle('show', !!t);
  canvas.classList.toggle('building', !!t);
  updateConfirm();
}
function confirmGhost() {
  const g = game.ghost;
  if (!g) return;
  if (!g.set && !TOUCH) { toast('Click where it should go first'); return; }
  if (tryBuild(g.i, g.type)) {
    if (!TOUCH) g.set = false;                     // desktop: the next one follows the mouse again
    toast(`${CFG.buildings[g.type].name} placed. ${say('Click to place another, or press Esc', 'Tap elsewhere to place another, or Done')}.`);
  }
  updateConfirm();
}
// what the building being placed would do there, and why it can't go there if it can't
function updateConfirm() {
  const g = game.ghost, el = $('cf-info');
  if (!g) { el.innerHTML = ''; return; }
  const type = g.type, def = CFG.buildings[type], i = g.i;
  const why = i >= 0 ? canBuild(i, type) : 'Off the map', C = i >= 0 ? countryAt(i) : null;
  const plan = !why ? planFor(i, type) : null, cost = totalCost(type, plan, i);
  let line = '';
  if (!why && C) {
    const short = shortfall(cost, C);
    line = Object.keys(short).length ? `<span class="a">${C.short} is short of ${Object.keys(short).join(', ')}: it will be shipped in</span>` : `<span class="g">Paid by ${C.short}</span>`;
    if (def.people) line += ` · ${def.people} settlers`;
    if (plan && plan.note) line += ` · <span class="d">${plan.note}</span>`;
    else if (plan && plan.routes) line += ` · <span class="g">${LINK_NAME[def.link]}: ${plan.tiles} tiles</span>`;
  }
  el.innerHTML = `<div class="cf-name"><span class="cf-ic">${SVG[type]}</span>${def.name} <span class="cost">${costHtml(cost, C)}</span></div>
    <div class="cf-line">${why ? `<span class="r">${why}</span>` : line || '&nbsp;'}</div>
    <div class="cf-hint">${say(g.set ? 'Click elsewhere or drag it to move · Enter or Confirm to build' : 'Move the mouse and click to put it down', 'Tap or drag to move it · Confirm to build')}</div>`;
  $('cf-ok').disabled = !!why || !g.set && !TOUCH;
}

// ---------- the build menu: research in progress, and every building (locked ones show the tech they need) ----------
let buildOpen = false, cmdOpen = false;
function toggleBuildMenu(force) {
  buildOpen = force === undefined ? !buildOpen : force;
  $('buildmenu').classList.toggle('show', buildOpen);
  if (buildOpen) { renderBuildMenu(); toggleCmdMenu(false, true); setAiming(false); }
  setMode(game.mode);
}
function toggleCmdMenu(force, keepMode) {
  cmdOpen = force === undefined ? !cmdOpen : force;
  $('cmdmenu').classList.toggle('show', cmdOpen);
  if (cmdOpen) { if (buildOpen) toggleBuildMenu(false); if (!keepMode) { setTool(null); setMode('command'); } updateCmdMenu(); }
}
function researchHtml() {
  const RS = game.research, t = RS.cur && TECH[RS.cur], known = RS.done.size, all = CFG.techs.length;
  if (!t) return `<div class="rs-top">🔬 <b>Every technology discovered</b> (${known} of ${all})</div>`;
  const cost = techCost(RS.done), f = researchFrac(), rate = RS.rate + RS.gold, eta = rate > 0 ? (cost - RS.pts) / rate : Infinity;
  return `<div class="rs-top"><span class="rs-ic">${SVG.research}</span><div class="rs-txt"><div class="lbl">TECHNOLOGY RESEARCH IN PROGRESS · ${known} OF ${all} KNOWN</div>
    <div class="rs-name">${t.name} <span class="rs-pct">${Math.floor(f * 100)}%</span><span class="rs-eta">${eta < 1e6 ? '~' + fmtTime(eta) + ' left' : 'paused: no people'}</span></div></div></div>
    <div class="rbar big"><span style="width:${(f * 100).toFixed(1)}%"></span></div>
    <div class="rs-what">${techSummary(t.id)}</div>
    <div class="rs-why">${fmtNum(RS.rate * 60)} points a minute from your ${fmtNum(game.population)} people${RS.gold > 0 ? ` + ${fmtNum(RS.gold * 60)} from gold` : ''}. Picked because it uses ${t.uses.join(' and ')}.</div>`;
}
function renderBuildMenu() {
  const C = activeCountry();
  $('bm-sub').textContent = C ? `Building in ${C.short}: it pays, or has the rest shipped from your linked domains` : '';
  $('research-box').innerHTML = researchHtml();
  const grid = $('bm-grid');
  grid.innerHTML = '';
  for (const cat of CATEGORIES) {
    const list = Object.entries(CFG.buildings).filter(([, b]) => b.cat === cat)
      .sort((a, b) => (a[1].tech ? TECH[a[1].tech].k + 1 : 0) - (b[1].tech ? TECH[b[1].tech].k + 1 : 0));
    if (!list.length) continue;
    const head = document.createElement('div');
    head.className = 'bm-cat'; head.textContent = cat;
    grid.appendChild(head);
    const sub = document.createElement('div');
    sub.className = 'bm-catgrid';
    grid.appendChild(sub);
    for (const [type, b] of list) {
      const open = isUnlocked(type);
      const el = document.createElement('div');
      el.className = 'bm-card' + (open ? '' : ' locked') + (game.tool === type ? ' sel' : '');
      const status = open ? (type === 'settlement' ? `${b.people} settlers` : b.gen ? `+${b.gen} MW` : b.workers ? `${b.workers} workers` : b.link ? LINK_NAME[b.link] : b.base || b.fort ? `holds ${Math.round((b.fort ? CFG.military.fortCap : CFG.military.baseCap) * techFactor(game.research.done))}` : 'Ready')
        : `🔒 needs ${TECH[b.tech].name}${game.research.cur === b.tech ? ' (researching)' : ''}`;
      el.innerHTML = `<div class="tile">${SVG[type]}</div>
        <div class="bm-body"><div class="bm-name">${b.name}</div>
        <div class="bm-desc">${b.desc || ''}</div>
        <div class="bm-foot"><div class="cost">${costHtml(b.cost, C)}</div><div class="bm-status">${status}</div></div></div>`;
      if (open) el.addEventListener('click', () => { toggleBuildMenu(false); setTool(type); });
      sub.appendChild(el);
    }
  }
}
function updateCmdMenu() {
  if (!cmdOpen) return;
  document.querySelectorAll('#cmdmenu [data-cmd]').forEach(b => b.classList.toggle('on', game.cmd === b.dataset.cmd && !game.aiming));
  const fire = document.querySelector('#cmdmenu [data-act="fire"]');
  fire.classList.toggle('on', !!game.aiming); fire.hidden = !silosOf().length;
  $('warhead-row').hidden = !game.research.done.has('nukes') || !silosOf().length;
  document.querySelectorAll('[data-warhead]').forEach(b => b.classList.toggle('on', game.warhead === b.dataset.warhead));
  $('warhead-cost').textContent = game.warhead === 'nuke' ? Object.entries(CFG.nuke.cost).map(([r, n]) => `${n} ${r}`).join(' · ') : '';
  const anyOut = game.expeditions.some(e => !e.auto && !e.done);
  document.querySelector('#cmdmenu [data-act="drive"]').hidden = !(anyOut && !game.driving);
  document.querySelector('#cmdmenu [data-act="next"]').hidden = game.countries.filter(c => c.alive && c.tiles).length < 2;
  $('recruit').textContent = game.recruit ? '✓ Bases training troops' : '✕ Bases not training';
  $('recruit').classList.toggle('on', game.recruit);
  const us = unitStats(), g = garrisons(), bases = g.filter(b => b.type === 'base').length, forts = g.length - bases;
  const marching = game.armies.reduce((a, q) => a + q.n, 0), fighting = game.attacks.reduce((a, q) => a + q.units, 0);
  $('army-info').innerHTML = isUnlocked('base') ? `<b class="g">${fmtNum(totalUnits())} ${us.type.name}</b> · reach ${strikeReach()} tiles · ${bases} base${bases === 1 ? '' : 's'}, ${forts} fortress${forts === 1 ? '' : 'es'}${marching >= 1 ? ` · ${fmtNum(marching)} marching` : ''}${fighting >= 1 ? ` · ${fmtNum(fighting)} fighting` : ''}<br><span class="d">attack ${us.atk.toFixed(1)} · toughness ${us.hp.toFixed(1)} · speed ${us.speed.toFixed(1)}</span>`
    : `<span class="d">No army yet: research ${TECH.warrior.name} for military bases.</span>`;
  $('cm-sub').textContent = game.aiming ? 'Aiming: click a target in range' : { expand: 'Click past your border to claim land', attack: "Click a neighbour's land to attack", expedition: 'Click where the expedition should go' }[game.cmd];
}

// ---------- one of your buildings: tap it (in Command mode) to see it and act on it ----------
const isConnected = b => b.type === 'settlement' || game.connects.some(c => c.a === b.i);
// a road out to building b: to the nearest road (or settlement) of its domain within reach. { line, to, cost } or a reason
function connectPlan(b) {
  const C = countryAt(b.i), R = CFG.roads.connectReach, bx = b.i % W, by = (b.i / W) | 0;
  if (!C) return { why: 'Not your land' };
  let to = -1, td = Infinity;
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const d = dx * dx + dy * dy;
    if (d >= td || d > R * R || !inb(bx + dx, by + dy)) continue;
    const t = idx(bx + dx, by + dy);
    if (t === b.i || countryAt(t) !== C) continue;
    if ((NET[t] & 1) || building[t] === BLD_CODE.settlement) { td = d; to = t; }
  }
  if (to < 0) return { why: `No road or settlement of ${C.short} within ${R} tiles` };
  const line = makeLine(b.i, to, sideOf(b.i), true, 20000);
  if (!line) return { why: 'No way over your land from here to the road' };
  const RC = CFG.roads;
  return { line, to, cost: { stone: Math.max(RC.connectMin, Math.ceil(line.len * RC.connectPerTile)) } };
}
function connectToRoad(b) {
  const P = connectPlan(b), C = countryAt(b.i);
  if (P.why) return toast(P.why);
  const miss = missingFor(P.cost, C);
  if (miss) return toast(`${C.short} needs ${P.cost.stone} stone for this road (it has ${fmtNum(C.res.stone)})`);
  C.res.stone -= P.cost.stone;
  game.connects.push({ a: b.i, b: P.to, ...P.line });
  markNet();
  floatText(b.i % W + 0.5, ((b.i / W) | 0) - 1, `Road: ${Math.round(P.line.len)} tiles`, '#7bd389');
  showBuildingCard(b);
}
// walls: pick a fort, then another one within range in the same domain
function wallPlan(a, b) {
  const WC = CFG.walls, A = countryAt(a.i);
  if (a.i === b.i) return { why: 'Pick a different fortress' };
  if (countryAt(b.i) !== A) return { why: 'Both fortresses must be in the same domain' };
  const d = Math.hypot(a.i % W - b.i % W, ((a.i / W) | 0) - ((b.i / W) | 0));
  if (d > WC.range) return { why: `Too far apart: ${Math.round(d)} tiles (a wall can run up to ${WC.range})` };
  if (game.walls.some(w => (w.a === a.i && w.b === b.i) || (w.a === b.i && w.b === a.i))) return { why: 'They already have a wall between them' };
  const line = makeLine(a.i, b.i, sideOf(a.i), false, 20000);
  if (!line) return { why: 'No way for a wall over your own land between them' };
  return { line, cost: { stone: Math.ceil(line.len * WC.stonePerTile) } };
}
function pickWallEnd(b) {
  const a = buildingAt(game.wallFrom);
  game.wallFrom = -1;
  if (!a || a.type !== 'fort') return;
  const P = wallPlan(a, b), C = countryAt(a.i);
  if (P.why) return toast(P.why);
  showModal(`<div class="md-title">Build a wall?</div><div class="md-body">${Math.round(P.line.len)} tiles of wall between your fortresses, for <b>${P.cost.stone} stone</b> from ${C.short} (it has ${fmtNum(C.res.stone)}).
    Raiders struggle to cross it, the land beside it is ${CFG.walls.defense}x harder to take, and your troops march along it.</div>`,
    [{ label: 'Build the wall', cls: 'go', act: () => {
        if (C.res.stone < P.cost.stone) return toast(`${C.short} doesn't have enough stone`);
        C.res.stone -= P.cost.stone;
        game.walls.push({ a: a.i, b: b.i, ...P.line });
        markNet();
        floatText(a.i % W + 0.5, ((a.i / W) | 0) - 1, 'Wall built', '#7bd389');
      } },
     { label: 'Cancel', act: () => {} }]);
}
let cardOf = -1;
function showBuildingCard(b) {
  if (!b) { $('bcard').classList.remove('show'); cardOf = -1; return; }
  cardOf = b.i;
  const def = CFG.buildings[b.type], C = countryAt(b.i), lines = [], btns = [];
  $('bc-ic').innerHTML = SVG[b.type];
  $('bc-title').textContent = def.name + (underway(b) ? ' (under construction)' : '');
  if (b.site) lines.push(`<span class="a">${b.site.convoy ? 'Materials on their way' : 'Waiting for ' + (Object.entries(b.site.need).filter(([, v]) => v >= 0.5).map(([r, v]) => `${Math.ceil(v)} ${r}`).join(', ') || 'a delivery')}</span>`);
  if (b.type === 'settlement') lines.push(`Holds ${Math.round(settlementCap(b))} people from ${b.tiles} tiles in reach. Roads join it to the other settlements of ${C ? C.short : 'its domain'} by themselves, and haulers bring harvests here.`);
  if (b.type === 'base' || b.type === 'fort') lines.push(`<b class="g">${Math.floor(b.units || 0)} / ${garrisonCap(b)} ${unitStats().type.name}</b>${b.training ? ' · training' : ''}${b.incoming ? ` · ${b.incoming} on the way` : ''}${b.oil != null && unitStats().type.oil ? ` · ${fmtNum(b.oil)} oil` : ''}`);
  if (b.type === 'fort') lines.push(`Land within ${CFG.walls.fortReach} tiles is ${CFG.walls.fortDefense}x harder for raiders to take.`);
  if (HARVESTS[b.type] && b.work) {
    const w = DEP_KINDS.filter(k => b.work[k]).map(k => `${b.work[k]} ${k === 'wheat' ? 'field' : k} tiles`).join(', ');
    const load = boxSum(b.buf || {});
    lines.push(`Works ${w || 'nothing in reach'}${load >= 0.5 ? ` · ${fmtNum(load)} waiting for a hauler` : ''}`);
  }
  if (b.type !== 'settlement' && !underway(b)) {
    if (isConnected(b)) lines.push('<span class="g">On the road network: haulers and troops move fast from here.</span>');
    else {
      const P = connectPlan(b);
      lines.push(P.why ? `<span class="d">Not on a road (${P.why.toLowerCase()}). Haulers and troops go slower off-road.</span>` : '<span class="d">Not on a road yet: haulers and troops go slower off-road.</span>');
      if (!P.why) btns.push({ label: `Connect to road · ${P.cost.stone} stone`, cls: 'go', act: () => connectToRoad(b), off: C && C.res.stone < P.cost.stone });
    }
  }
  if (b.type === 'fort' && !underway(b) && isUnlocked('fort')) btns.push({ label: 'Build a wall…', act: () => { game.wallFrom = b.i; showBuildingCard(null); toast(say('Now click another fortress (within ', 'Now tap another fortress (within ') + CFG.walls.range + ' tiles) to wall them together'); } });
  for (const [t, d] of Object.entries(CFG.buildings)) {          // upgrades that sit on this one
    const from = Array.isArray(d.from) ? d.from : [d.from];
    if (!underway(b) && !b.site && from.includes(b.type) && isUnlocked(t)) btns.push({ label: `Upgrade: ${d.name}`, act: () => { showBuildingCard(null); setTool(t); if (game.ghost) { game.ghost.i = b.i; game.ghost.set = true; updateConfirm(); } } });
  }
  $('bc-body').innerHTML = lines.map(l => `<div>${l}</div>`).join('');
  const wrap = $('bc-btns');
  wrap.innerHTML = '';
  for (const x of btns) {
    const el = document.createElement('button');
    el.textContent = x.label; if (x.cls) el.className = x.cls; el.disabled = !!x.off;
    el.addEventListener('click', x.act);
    wrap.appendChild(el);
  }
  $('bcard').classList.add('show');
}

// ---------- notifications and questions ----------
function notify(title, body) {
  const el = document.createElement('div');
  el.className = 'note';
  el.innerHTML = `<div class="nt">${title}</div><div class="nb">${body}</div>`;
  el.addEventListener('click', () => el.remove());
  $('notes').prepend(el);
  while ($('notes').children.length > 3) $('notes').lastChild.remove();
  setTimeout(() => { el.classList.add('fade'); setTimeout(() => el.remove(), 600); }, 9000);
  game.notes.push({ t: game.time, title, body });
}
let modalOpen = false;
function showModal(html, buttons) {
  $('md-text').innerHTML = html;
  const wrap = $('md-btns');
  wrap.innerHTML = '';
  for (const b of buttons) {
    const el = document.createElement('button');
    el.textContent = b.label; if (b.cls) el.className = b.cls; el.disabled = !!b.off;
    el.addEventListener('click', () => { closeModal(); b.act(); });
    wrap.appendChild(el);
  }
  $('modal').classList.add('show'); modalOpen = true;
}
function closeModal() { $('modal').classList.remove('show'); modalOpen = false; }

function setPct(p) {
  game.sendPct = p;
  document.querySelectorAll('#pct-buttons .pbtn').forEach(el => el.classList.toggle('on', +el.dataset.p === p));
}
function setTroopPct(p) {
  game.troopPct = p;
  document.querySelectorAll('#troop-buttons .pbtn').forEach(el => el.classList.toggle('on', +el.dataset.p === p));
}

let toastTimer = 0;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

const fmtCap = cap => cap >= 10000 ? (cap / 1000).toFixed(1) + 'k' : fmtNum(cap);
function updateHud() {
  const C = activeCountry();
  if (!C) return;                                  // game over: nothing left to show
  const live = game.countries.filter(c => c.alive);
  $('val-country').textContent = C.full;
  $('country-count').textContent = live.length > 1 ? `${live.indexOf(C) + 1} of ${live.length}` : '';
  // the general inventory: every domain's stock added up (each domain's own stock shows when you point at it)
  const tot = resBox(), rate = resBox(), cap = resBox(), inc = resBox();
  let gold = 0, eat = 0, hungry = false;
  for (const c of live) {
    for (const r of RESOURCES) { tot[r] += Math.max(0, c.res[r]); rate[r] += c.rates[r] || 0; cap[r] += c.store ? c.store[r] : CFG.storage[r].base; }
    gold += c.goldRate || 0; eat += c.eat || 0; hungry = hungry || c.hungry;
  }
  for (const L of game.links) if (L.cargo) for (const r of RESOURCES) inc[r] += L.cargo[r] || 0;
  $('res-oil').hidden = !oilKnown();
  $('res-uranium').hidden = !uraniumKnown();
  for (const r of RESOURCES) {
    const f = clamp(tot[r] / cap[r], 0, 1);
    $('val-' + r).innerHTML = fmtNum(tot[r]) + `<span class="capn"> / ${fmtCap(cap[r])}</span>` +
      (inc[r] >= 1 ? `<span class="incoming" title="on its way between your domains">+${fmtNum(inc[r])}</span>` : '') +
      `<div class="store"><div style="width:${(f * 100).toFixed(0)}%;background:${f >= 0.999 ? '#f2c14e' : { wood: '#56963f', stone: '#9aa1a8', iron: '#bd7b56', oil: '#59616b', wheat: '#e0bc4e', uranium: '#7ee05a' }[r]}"></div></div>`;
    const el = $('rate-' + r), v = rate[r];
    el.textContent = `${v < 0 ? '' : '+'}${v.toFixed(Math.abs(v) < 1 && v !== 0 ? 2 : 1)}/s`;
    el.classList.toggle('zero', Math.abs(v) < 0.05);
    el.classList.toggle('neg', v < -0.05);
  }
  $('rate-wheat').textContent = (rate.wheat < 0 ? '' : '+') + rate.wheat.toFixed(2) + '/s' + (hungry ? ' HUNGRY' : '');
  const gb = goldBoost(gold);
  $('val-gold').innerHTML = gold > 0 ? `<span class="g">${gold.toFixed(2)}/s</span><span class="capn"> · research +${fmtNum(gb.research * 60)}/min · training +${Math.round(gb.train * 100)}% · troops +${Math.round(gb.power * 100)}%</span>` : '<span class="capn">none mined</span>';
  const noOil = live.some(c => c.noOil);
  $('rate-oil').textContent += noOil ? ' OUT' : '';
  const M = C.mw, short = M.need > 0 && C.sat < 0.999;
  $('val-power').textContent = M.need || M.max ? `${fmtNum(M.need)} / ${fmtNum(M.max)} MW` : '-';
  $('val-power').classList.toggle('short', short);
  $('rate-power').textContent = short ? `${Math.round(C.sat * 100)}%` : M.need ? 'OK' : '';
  $('rate-power').classList.toggle('neg', short);
  $('val-terr').textContent = (game.ownedCount / game.landTiles * 100).toFixed(1) + '%';
  $('val-time').textContent = fmtTime(game.time);
  $('save-note').textContent = game.savedAt != null && game.time - game.savedAt < 2.5 ? 'SAVED' : '';
  $('val-view').textContent = cam.follow ? (mapStage === 3 ? 'Solar system' : LOCK[cam.follow].short)
    : cam.zoom < orbitZoom() * 0.6 ? 'Solar' : cam.zoom >= CFG.detailZoom ? 'Detail' : cam.zoom >= CFG.cityZoom ? 'Region'
    : cam.zoom > fitZoom() * 0.8 ? 'Map' : 'Orbit';
  // people (in the domain you're viewing), its troops in green below
  const cinc = incomingTo(C);
  $('people-lbl').textContent = live.length > 1 ? `PEOPLE · ${C.short.toUpperCase()} · EMPIRE ${fmtNum(game.population)}` : 'PEOPLE';
  $('val-people').textContent = `${fmtNum(C.people)} / ${fmtNum(C.cap)}`;
  const du = unitsIn(C), tu = totalUnits();
  $('val-units').textContent = tu >= 1 || isUnlocked('base') ? `⚔ ${fmtNum(du)} ${unitStats().type.name}${live.length > 1 && tu - du >= 1 ? ` · ${fmtNum(tu)} in all` : ''}` : '';
  $('people-fill').style.width = (C.cap ? clamp(C.people / C.cap, 0, 1) * 100 : 0) + '%';
  $('people-rate').innerHTML = (cinc.people >= 1 ? `<span class="incoming">+${fmtNum(cinc.people)} arriving</span> ` : '') +
    (C.hungry && C.growth < 0 ? `<span style="color:var(--bad)">Starving: ${C.growth.toFixed(1)}/s</span>`
      : C.hungry ? `<span style="color:var(--bad)">Not enough food to grow</span>`
      : C.growth > 0 ? `+${C.growth.toFixed(1)} / sec` : C.growth < 0 ? `<span style="color:var(--bad)">Overcrowded: ${C.growth.toFixed(1)} / sec</span>` : (C.people >= C.cap - 0.5 ? 'Full' : ''));
  $('bar-note').innerHTML = `fields feed ${fmtNum(C.foodCap || 0)} · ${C.pw.workers ? `${fmtNum(Math.min(C.people, C.pw.workers))} at work` : 'nobody at work'}${C.staff < 0.999 ? ` (need ${C.pw.workers})` : ''}`;
  $('bar-note').classList.toggle('neg', C.staff < 0.999 || !!C.hungry);
  // research on the Build button
  const f = researchFrac(), t = game.research.cur && TECH[game.research.cur];
  $('rb-fill').style.width = (f * 100).toFixed(1) + '%';
  $('rb-label').textContent = t ? `${t.name} ${Math.floor(f * 100)}%` : 'All researched';
  $('cmd-label').textContent = game.aiming ? 'Fire' : game.mode === 'build' ? 'Back' : { expand: 'Expand', attack: 'Attack', expedition: 'Expedition' }[game.cmd];
  $('send-n').textContent = `= ${sendFrom(C)} people`;
  const avail = garrisons().reduce((a, b) => a + Math.floor(b.units || 0), 0);
  $('troop-n').textContent = `= ${Math.floor(avail * game.troopPct / 100)} troops`;
  if (buildOpen) { $('research-box').innerHTML = researchHtml(); }
  if (cmdOpen) updateCmdMenu();
  if (game.ghost) updateConfirm();
  $('dpad').classList.toggle('show', !!game.driving && TOUCH);
  if (!game.driving) for (const k of ['arrowup', 'arrowdown', 'arrowleft', 'arrowright']) if (TOUCH) keys.delete(k);
  document.body.style.setProperty('--bottom-h', $('bottom').offsetHeight + 'px');
  document.body.style.setProperty('--top-h', $('topbar').offsetHeight + 'px');
  updateHover();
}

function updateHover() {
  const tip = $('tooltip');
  if (mouse.in && !TOUCH) {
    const [wx, wy] = toWorld(mouse.x, mouse.y);
    const body = bodyUnder(wx, wy);
    if (body) {
      $('hover-info').textContent = body.info(wx, wy) + (cam.follow === body.id ? '' : ' · click to lock on');
      tip.style.display = 'none';
      return;
    }
    if (worldLockable() && overWorld(wx, wy)) {
      $('hover-info').textContent = 'Your world · click to lock on';
      tip.style.display = 'none';
      return;
    }
  }
  const t = mouse.in ? hoverTile() : null;
  if (!t) { $('hover-info').innerHTML = '&nbsp;'; tip.style.display = 'none'; return; }
  const b = biome[t.i];
  let info = BIOME_NAME[b];
  if (b === ICE) info += ' · the edge of the world';
  if (isLand(t.i)) {
    const foe = nationAt(t.i);
    info += foe ? ` · ${foe.full} (${foe.pers.name}) · ${fmtNum(foe.people)} people · ${fmtNum(foe.units)} ${unitStats(foe.R).type.name} · ${foe.R.size} techs${foe.hostile ? ' · AT WAR' : ''}`
      : ` · ${tileCost(t.i)} people/tile`;
    if (hasDep(t.i)) info += ` · ${deposits[depositOf[t.i]].type === 'wheat' ? 'wheat field' : deposits[depositOf[t.i]].type}`;
    if (building[t.i] === BLD_CODE.settlement) {
      const sb = buildingAt(t.i), dark = owner[t.i] && sb.base > CFG.settlement.powerAbove && countryAt(t.i).sat < 0.999;
      info += ` · ${CFG.settlement.levels[settlementLevel(sb)].name} · holds ${Math.round(settlementCap(sb))} people from ${sb.tiles} tiles in reach${dark ? ' (short of power: could hold ' + Math.round(sb.base) + ')' : ''}${sb.dmg ? ` · damaged: ${Math.ceil(hpOf(sb) - sb.dmg)} of ${hpOf(sb)} hits left` : ''}`;
    } else if (building[t.i]) {
      const hb = buildingAt(t.i);
      info += ` · ${CFG.buildings[hb.type].name}`;
      if (hb.site) info += ` · under construction: needs ${Object.entries(hb.site.need).filter(([, v]) => v >= 0.5).map(([r, v]) => `${Math.ceil(v)} ${r}`).join(', ') || 'nothing more'}`;
      else if (hb.type === 'base' || hb.type === 'fort') info += ` · ${Math.floor(hb.units || 0)} / ${garrisonCap(hb)} units${hb.training ? ' · training' : ''}`;
      if (HARVESTS[hb.type] && hb.work) info += ` · works ${DEP_KINDS.filter(k => hb.work[k]).map(k => `${hb.work[k]} ${k} tiles`).join(', ') || 'nothing in reach'}`;
    }
    else if (hasDep(t.i) && owner[t.i] && !isHarvested(t.i)) {
      const k = deposits[depositOf[t.i]].type;
      info += ` · nobody works this tile: put a ${k === 'forest' ? "logger's cabin" : k === 'oil' ? 'oil derrick' : k === 'wheat' ? 'farm' : "miner's camp"} within ${CFG.collectorReach} tiles`;
    }
    if (owner[t.i]) {                               // a domain's own (hidden) stock
      const c = countryAt(t.i);
      if (c) info += ` · ${c.full}: ${RESOURCES.filter(r => r !== 'oil' || oilKnown()).map(r => `${fmtNum(Math.max(0, c.res[r]))} ${r}`).join(', ')}`;
    }
  }
  $('hover-info').textContent = info;

  const placeTip = (html, bad) => {
    tip.innerHTML = html;
    tip.classList.toggle('bad', bad);
    tip.style.display = 'block';
    tip.style.left = Math.min(mouse.x + 18, cw - 290) + 'px';
    tip.style.top = Math.min(mouse.y + 18, ch - 120) + 'px';
  };
  if (TOUCH) { tip.style.display = 'none'; return; }
  if (game.aiming) {
    const { inR, ready } = pickWeapon(t.x, t.y), o = ready || inR[0], foe = nationAt(t.i), mine = countryAt(t.i);
    const cost = o ? Object.entries(o.Wp.cost).map(([r, n]) => `${n} ${r}`).join(' · ') : '';
    placeTip(`<div class="t">${o ? 'Fire a ' + o.Wp.name.toLowerCase() : 'Fire'}: click</div>
      <div class="${ready ? 'g' : 'r'}">${ready ? `${Math.round(o.d)} tiles from your ${CFG.buildings[o.b.type].name.toLowerCase()}` : o ? `Reloading: ${Math.ceil(o.b.ready - game.time)}s` : `Out of range (silos reach ${CFG.weapons.missile.range} tiles)`}</div>
      ${foe ? `<div class="d">Target: ${foe.full} · ${fmtNum(foe.people)} people${foe.hostile ? '' : ' · not at war with you yet'}</div>` : mine ? `<div class="r">That's your own land!</div>` : ''}
      ${o ? `<div class="d">Cost: ${cost} · blast radius ${o.Wp.radius}</div>` : ''}
      <div class="d">F or Esc to stop aiming</div>`, !ready);
    return;
  }
  if (game.mode === 'command' && !game.ghost) {
    const foe = nationAt(t.i);
    if (foe && (game.cmd === 'attack' || game.cmd === 'expand')) {
      const touch = !!frontWith(foe, t.x, t.y), them = unitStats(foe.R);
      placeTip(`<div class="t">${foe.full}</div><div class="d">${foe.pers.name} · ${fmtNum(foe.units)} ${them.type.name} · ${foe.R.size} techs${foe.hostile ? ' · <span class="r">at war</span>' : ''}</div>
        <div class="${touch ? 'g' : 'd'}">${touch ? (game.cmd === 'attack' ? 'Click to attack' : 'Click: attack, or stop at the border') : "Your border doesn't touch it here yet"}</div>`, false);
      return;
    }
  }
  tip.style.display = 'none';
}
const WEAPON_RING = { shell: 'rgba(255,170,70,0.9)', missile: 'rgba(255,122,107,0.85)' };
function drawMissiles(z) {
  // burnt ground where something landed, fading over time
  for (const sc of game.scorch) {
    const [sx, sy] = toScreen(sc.x, sc.y), r = Math.max(5, sc.R * z * 0.95);
    ctx.beginPath(); ctx.ellipse(sx, sy, r, r * 0.8, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(22,18,16,${0.42 * (1 - sc.t)})`; ctx.fill();
  }
  // reload bars under every weapon that's reloading (yours and theirs)
  if (z >= CFG.cityZoom) for (const b of game.buildings) {      // how much more a damaged building can take
    if (!b.dmg) continue;
    const [sx, sy] = toScreen(...tileCenter(b.i)), w = Math.max(22, z * 1.6), f = clamp(1 - b.dmg / hpOf(b), 0, 1), up = b.type === 'settlement' ? z * 1.7 : z * 0.95;
    ctx.fillStyle = 'rgba(20,26,37,0.9)'; ctx.fillRect(sx - w / 2 - 1, sy - up - 1, w + 2, 6);
    ctx.fillStyle = '#7a2a25'; ctx.fillRect(sx - w / 2, sy - up, w, 4);
    ctx.fillStyle = f > 0.5 ? '#7bd389' : '#f2c14e'; ctx.fillRect(sx - w / 2, sy - up, w * f, 4);
  }
  if (z >= CFG.cityZoom) for (const b of game.buildings) {
    if (!(CFG.buildings[b.type].weapon || CFG.buildings[b.type].defense) || (b.ready || 0) <= game.time || !b.rd) continue;
    const [sx, sy] = toScreen(...tileCenter(b.i)), w = Math.max(20, z * 1.5), f = clamp(1 - (b.ready - game.time) / b.rd, 0, 1);
    ctx.fillStyle = 'rgba(20,26,37,0.9)'; ctx.fillRect(sx - w / 2 - 1, sy + z * 0.75 - 1, w + 2, 6);
    ctx.fillStyle = owner[b.i] ? '#7bd389' : '#ff7a6b'; ctx.fillRect(sx - w / 2, sy + z * 0.75, w * f, 4);
  }
  const lifted = (x, y, air, zz) => { const [sx, sy] = toScreen(x, y); return [sx, sy - (air ? Math.sin(Math.PI * air.e) * Math.max(26, air.dist * zz * air.arc) : 0)]; };
  for (const b of game.buildings) {                // a turret that's firing: flickering tracers and a muzzle flash
    if (b.type !== 'turret' || !b.aim || game.time - (b.fire || -9) > 0.12) continue;
    const [ax, ay] = toScreen(...tileCenter(b.i)), [bx, by] = toScreen(b.aim[0], b.aim[1]);
    for (let j = 0; j < 3; j++) {
      const jx = (Math.random() - 0.5) * z * 1.6, jy = (Math.random() - 0.5) * z * 1.6, f0 = Math.random() * 0.6, f1 = f0 + 0.25;
      ctx.beginPath(); ctx.moveTo(lerp(ax, bx + jx, f0), lerp(ay, by + jy, f0)); ctx.lineTo(lerp(ax, bx + jx, f1), lerp(ay, by + jy, f1));
      ctx.strokeStyle = 'rgba(255,236,150,0.95)'; ctx.lineWidth = 1.6; ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(ax, ay, Math.max(3, z * 0.35), 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,220,120,0.9)'; ctx.fill();
  }
  for (const tr of game.tracers) {                 // an interceptor's streak up to where it met the shot
    const [ax, ay] = toScreen(tr.x0, tr.y0), [bx, by] = lifted(tr.x1, tr.y1, tr.air, z);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
    ctx.strokeStyle = `rgba(190,245,255,${0.9 * (1 - tr.t)})`; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${1 - tr.t})`; ctx.lineWidth = 1; ctx.stroke();
  }
  if (game.aiming) {
    for (const b of game.buildings) {              // their air defense: shots aimed inside these rings get knocked down
      if (b.type !== 'airdef' || !aiOf[b.i]) continue;
      const [sx, sy] = toScreen(...tileCenter(b.i));
      ctx.beginPath(); ctx.arc(sx, sy, CFG.airDefense.range * z, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(120,200,255,0.07)'; ctx.fill();
      ctx.setLineDash([3, 5]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(120,200,255,0.85)'; ctx.stroke(); ctx.setLineDash([]);
    }
    for (const b of silosOf()) {
      const [sx, sy] = toScreen(...tileCenter(b.i)), kind = CFG.buildings[b.type].weapon;
      ctx.beginPath(); ctx.arc(sx, sy, CFG.weapons[kind].range * z, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,122,107,0.05)'; ctx.fill();
      ctx.setLineDash(kind === 'shell' ? [4, 5] : [8, 6]); ctx.lineWidth = 2; ctx.strokeStyle = WEAPON_RING[kind]; ctx.stroke(); ctx.setLineDash([]);
    }
    const t = mouse.in ? hoverTile() : null;
    if (t) {
      const { inR, ready } = pickWeapon(t.x, t.y), o = ready || inR[0];
      const [sx, sy] = toScreen(t.x + 0.5, t.y + 0.5), r = Math.max(8, ((o ? o.Wp.radius : 1.5) + 0.5) * z);
      ctx.lineWidth = 2; ctx.strokeStyle = ready ? '#ff7a6b' : 'rgba(255,122,107,0.45)';
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx - r - 6, sy); ctx.lineTo(sx + r + 6, sy); ctx.moveTo(sx, sy - r - 6); ctx.lineTo(sx, sy + r + 6); ctx.stroke();
    }
  }
  for (const m of game.missiles) {
    const Wp = CFG.weapons[m.w], dist = Math.hypot(m.x1 - m.x0, m.y1 - m.y0), lift = Math.max(26, dist * z * Wp.arc);
    const ground = e => toScreen(lerp(m.x0, m.x1, e), lerp(m.y0, m.y1, e));
    const at = e => { const [sx, sy] = ground(e); return [sx, sy - Math.sin(Math.PI * e) * lift]; };   // a ballistic arc, lifted towards the top of the screen
    const big = m.w === 'missile', k = clamp(z / 9, 0.75, 2.4) * (big ? 1 : 0.8);
    const [hx, hy] = at(m.t), [px, py] = at(Math.max(0, m.t - 0.02)), ang = Math.atan2(hy - py, hx - px);
    // where it will land, and its shadow racing along the ground
    const [tx, ty] = toScreen(m.x1, m.y1);
    ctx.lineWidth = 1.5; ctx.strokeStyle = m.ai >= 0 ? 'rgba(255,90,70,0.95)' : 'rgba(255,122,107,0.7)';
    ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(tx, ty, Math.max(7, Wp.radius * z), 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    const [gx, gy] = ground(m.t);
    ctx.beginPath(); ctx.ellipse(gx, gy, 5 * k, 2.5 * k, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fill();
    // smoke trail: puffs left along the arc, older ones bigger and fainter
    const puffs = big ? 22 : 9, span = big ? 0.5 : 0.22;
    for (let j = 1; j <= puffs; j++) {
      const e = m.t - j / puffs * span;
      if (e < 0) break;
      const [qx, qy] = at(e), age = j / puffs;
      ctx.beginPath(); ctx.arc(qx + Math.sin(j * 2.3 + m.x0) * 2 * k * age, qy, (1.6 + age * (big ? 5 : 2.5)) * k, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${big ? '225,225,225' : '150,150,150'},${0.5 * (1 - age)})`; ctx.fill();
    }
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(ang); ctx.scale(k, k);
    if (big) {
      const fl = 7 + Math.random() * 6;               // the flame flickers
      ctx.beginPath(); ctx.moveTo(-8, -2.6); ctx.lineTo(-8 - fl, 0); ctx.lineTo(-8, 2.6); ctx.closePath(); ctx.fillStyle = '#ff9a3c'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(-8, -1.4); ctx.lineTo(-8 - fl * 0.55, 0); ctx.lineTo(-8, 1.4); ctx.closePath(); ctx.fillStyle = '#fff3b0'; ctx.fill();
      ctx.fillStyle = '#59616b';                       // fins
      ctx.beginPath(); ctx.moveTo(-8, -2.4); ctx.lineTo(-10.5, -5.5); ctx.lineTo(-4.5, -2.4); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-8, 2.4); ctx.lineTo(-10.5, 5.5); ctx.lineTo(-4.5, 2.4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#eef1f3'; ctx.fillRect(-8, -2.4, 13, 4.8);
      ctx.fillStyle = m.ai >= 0 ? game.nations[m.ai].hex : '#2f7de1'; ctx.fillRect(-3, -2.4, 3, 4.8);   // a band in its owner's colour
      ctx.beginPath(); ctx.moveTo(5, -2.4); ctx.quadraticCurveTo(10.5, -1.6, 11.5, 0); ctx.quadraticCurveTo(10.5, 1.6, 5, 2.4); ctx.closePath(); ctx.fillStyle = '#d64045'; ctx.fill();
      ctx.strokeStyle = 'rgba(30,36,44,0.7)'; ctx.lineWidth = 0.6; ctx.strokeRect(-8, -2.4, 13, 4.8);
    } else {
      ctx.beginPath(); ctx.ellipse(0, 0, 4.2, 2.8, 0, 0, Math.PI * 2); ctx.fillStyle = '#2b3038'; ctx.fill();
      ctx.beginPath(); ctx.ellipse(1, -0.9, 1.8, 0.9, 0, 0, Math.PI * 2); ctx.fillStyle = '#8d969e'; ctx.fill();
    }
    ctx.restore();
  }
  // explosions: a flash, a fireball, a shockwave ring, sparks, then smoke that hangs and rises
  for (const b of game.blasts) {
    const [sx, sy] = lifted(b.x, b.y, b.air, z), r0 = Math.max(b.big ? 16 : 9, (b.R + 1) * z);
    const tf = Math.min(1, b.t * 2.2), ease = 1 - (1 - tf) * (1 - tf);     // the fire is over in under half the blast's life
    if (b.nuke) {                                  // a nuclear flash, and the mushroom cloud rising over it
      ctx.beginPath(); ctx.arc(sx, sy, r0 * (0.6 + b.t * 1.6), 0, Math.PI * 2); ctx.fillStyle = `rgba(255,250,220,${0.5 * (1 - b.t)})`; ctx.fill();
      const hgt = r0 * 1.6 * Math.min(1, b.t * 1.6), cap = r0 * 0.55 * (0.6 + b.t * 0.6);
      ctx.fillStyle = `rgba(120,96,80,${0.75 * (1 - b.t * 0.8)})`; ctx.fillRect(sx - cap * 0.18, sy - hgt, cap * 0.36, hgt);
      ctx.beginPath(); ctx.ellipse(sx, sy - hgt, cap, cap * 0.6, 0, 0, Math.PI * 2); ctx.fillStyle = `rgba(160,120,90,${0.8 * (1 - b.t * 0.8)})`; ctx.fill();
    }
    for (let j = 0; j < (b.big ? 7 : 4); j++) {                           // smoke
      const a = hash2(b.seed, j, 61) * Math.PI * 2, d = hash2(b.seed, j, 62) * r0 * 0.6;
      const qx = sx + Math.cos(a) * d * (0.5 + b.t), qy = sy + Math.sin(a) * d * 0.6 - b.t * r0 * (0.5 + hash2(b.seed, j, 63) * 0.5);
      ctx.beginPath(); ctx.arc(qx, qy, r0 * (0.22 + b.t * 0.35), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${60 + j * 9},${58 + j * 9},${58 + j * 9},${0.5 * Math.pow(1 - b.t, 1.4)})`; ctx.fill();
    }
    if (tf < 1) {
      const fr = r0 * (0.35 + 0.75 * ease), g = ctx.createRadialGradient(sx, sy, 0, sx, sy, fr);
      g.addColorStop(0, `rgba(255,250,220,${1 - tf})`);
      g.addColorStop(0.35, `rgba(255,170,50,${0.9 * (1 - tf)})`);
      g.addColorStop(0.75, `rgba(215,70,25,${0.6 * (1 - tf)})`);
      g.addColorStop(1, 'rgba(90,20,10,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, fr, 0, Math.PI * 2); ctx.fill();
      ctx.lineCap = 'round';
      for (let j = 0; j < (b.big ? 14 : 7); j++) {                         // sparks flying outward
        const a = hash2(b.seed, j, 64) * Math.PI * 2, v = 0.7 + hash2(b.seed, j, 65) * 0.9;
        const d0 = r0 * ease * v * 0.9, d1 = r0 * ease * v * 1.25;
        ctx.beginPath(); ctx.moveTo(sx + Math.cos(a) * d0, sy + Math.sin(a) * d0 * 0.8); ctx.lineTo(sx + Math.cos(a) * d1, sy + Math.sin(a) * d1 * 0.8);
        ctx.strokeStyle = `rgba(255,${200 + j * 3},120,${1 - tf})`; ctx.lineWidth = b.big ? 2.2 : 1.5; ctx.stroke();
      }
      ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.ellipse(sx, sy, r0 * (0.3 + 1.5 * ease), r0 * (0.3 + 1.5 * ease) * 0.8, 0, 0, Math.PI * 2);   // shockwave
      ctx.strokeStyle = `rgba(255,255,255,${0.75 * (1 - tf)})`; ctx.lineWidth = (b.big ? 5 : 3) * (1 - tf) + 0.5; ctx.stroke();
    }
    if (b.t < 0.07) { ctx.beginPath(); ctx.arc(sx, sy, r0 * 1.3, 0, Math.PI * 2); ctx.fillStyle = `rgba(255,255,255,${0.85 * (1 - b.t / 0.07)})`; ctx.fill(); }
  }
}

// the building you're placing: where it would go, what it would reach, and whether it can go there
function drawBuildPreview(z) {
  const g = game.ghost;
  if (!g || g.i < 0) return;
  const i = g.i, x = i % W, y = (i / W) | 0, type = g.type, def = CFG.buildings[type];
  const plan = planFor(i, type);
  const ok = !canBuild(i, type);
  if (plan && plan.routes) for (const r of plan.routes) strokeRoute(r.path, def.link === 'rail' ? 'rail' : def.link, z, true);
  if (type === 'settlement') drawReachPreview(i, z);
  if (HARVESTS[type]) drawHarvestPreview(i, type, z);
  if (def.farm) reachRing(i, '#e0bc4e', z, [4, 4], CFG.wheat.radius);
  if (type === 'mortar') reachRing(i, '#7bd389', z, [4, 5], CFG.weapons.shell.range);
  if (type === 'turret') reachRing(i, '#7bd389', z, [4, 5], CFG.turret.range);
  if (def.defense) {
    for (const b of game.buildings) if (b.type === 'airdef' && owner[b.i]) reachRing(b.i, 'rgba(255,255,255,0.3)', z, [3, 7], CFG.airDefense.range);
    reachRing(i, '#7bd389', z, [6, 5], CFG.airDefense.range);
  }
  const [sx, sy] = toScreen(x, y), s = Math.max(z, 10), off = (s - z) / 2;
  ctx.fillStyle = ok ? 'rgba(123,211,137,0.3)' : 'rgba(255,122,107,0.3)';
  ctx.fillRect(sx - off, sy - off, s, s);
  ctx.strokeStyle = ok ? '#7bd389' : '#ff7a6b'; ctx.lineWidth = 2;
  ctx.strokeRect(sx - off, sy - off, s, s);
  drawSprite(type, x + 0.5, y + 0.5, Math.max(z * 1.3, 26), 0.75);
  if (g.set) {                                     // a handle: drag it to move
    const [cx, cy] = toScreen(x + 0.5, y + 0.5), r = Math.max(22, z * 1.4);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(242,193,78,0.85)'; ctx.stroke(); ctx.setLineDash([]);
  }
}

// ======================================================================
// main loop
// ======================================================================
function init() {
  resize();
  window.addEventListener('resize', resize);
  // let the "Generating world" screen paint before the heavy work starts
  setTimeout(start, 40);
}

function start() {
  const t0 = performance.now();
  generateWorld();
  paintTerrain();
  paintMoon();
  paintSun();
  paintVulcan();
  for (const b of Object.values(BODY)) b.paint(b);
  makeStars();
  iconFill();
  cam.x = spawn.x + 0.5; cam.y = spawn.y + 0.5;
  if (RESUME) {
    try { loadGame(RESUME); }
    catch (e) {                                     // a save from an incompatible version: drop it and start this map fresh
      console.warn('Could not load the save; starting fresh', e);
      noSave = true;
      try { localStorage.removeItem(SAVE_KEY); } catch (e2) { /* storage blocked */ }
      location.reload();
      return;
    }
  }
  initUI();
  setInterval(saveGame, 10000);
  window.addEventListener('beforeunload', saveGame);
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });
  window.__game.genMs = Math.round(performance.now() - t0);
  const ld = $('loading');
  if (ld) ld.remove();
  if (RESUME && !noSave) toast(`Welcome back: game loaded (seed ${SEED}, ${fmtTime(game.time)} played). It autosaves every 10 s.`);
  else notify('Welcome', `Map seed ${SEED}. ${say('Click', 'Tap')} past your border to expand. Your people research technology as they grow: open <b>Build</b> to see what's coming. Farms feed your people.`);

  const step = 1 / CFG.tickHz;
  let last = performance.now(), acc = 0, hudT = 0;
  function frame(now) {
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    acc += dt;
    while (acc >= step) { tick(step); acc -= step; }
    panKeys(dt);
    stepCamAnim(dt);
    applyFollow();
    render();
    hudT += dt;
    if (hudT > 0.1) { updateHud(); hudT = 0; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// handy for debugging/testing in the browser console
window.__game = { TOUCH, mouse, game, cam, CFG, SEED, tick, updateHud, liveCountry, countryAt, activeCountry, countryOf, isUnlocked, toggleBuildMenu, toggleCmdMenu,
  startPush, toWorld, toScreen, tryBuild, launchExpedition, recomputeNetwork, idx, biome, owner, landmass, isCoastal, OCEAN, depositOf, deposits, canBuild, aiOf, nationAt,
  fireMissile, setAiming, explode, saveGame, SAVE_KEY, recomputeBuildings, building, buildingAt, freePeople, params, isHarvested, aiTake, stepRaid, aiThink, aiFire, provoke,
  render, keys, settleExpedition, takeWheel, completeTech, setPct, setTroopPct, roadsList: () => roads, buildRoads, netGraph, findRoute, connectPlan, connectToRoad, wallPlan, pickWallEnd, showBuildingCard, strikePlan, strikeReach, techIn, goldBoost, haulProf, NET, defenseMult, nextVehicle, driveStep: (e, dt) => driveStep(e, dt), fireMissile, removeBuilding, TECH, unitStats, garrisons, totalUnits, launchAttack, frontWith, setTool, confirmGhost, setCmd, clickAt, commandClick,
  routesTo, dispatchSupplies, linkStats, techCost, pickTech, playerTechScore, resourceProfile, research: () => game.research, hasDep, oilKnown, W, frontier, tileCenter,
  stopSaving: () => { noSave = true; } };
init();
