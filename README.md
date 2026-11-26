# Game Trial

A remake of the [Map Factory prototype](https://yclen.github.io/map-factory/prototype) by yclen: a territory and economy game on a seeded disk world floating in space. Grow your domains, feed your people, research your way from the Wheel to reusable rockets, settle the Moon and Aries, and deal with AI nations that trade, ally, scheme and fight like people.

**▶ Play:** https://aycooper1-png.github.io/Game-Trial/

The game works on phones as well as on desktops. It autosaves in your browser every 10 seconds. Add `?seed=123` to the address to play a specific map.

## Game modes
Pick one when you start a new map, and change it any time from the Command menu (Mode):
- **Peaceful:** no wars at all, for anyone. The nations still race you for land, trade and tech.
- **Easy:** slow, mostly peaceful nations. They leave diplomacy to you, and seldom side against you in your wars.
- **Normal:** sensible nations that plan, trade and make some diplomacy of their own.
- **Hard:** sharp nations. They pick their moments, strike where you're weakest, deal shrewdly, and invest heavily in armies and fortresses. Advanced ones run their own central computers.
- **Murder mode:** as sharp as Hard, but every nation dislikes you, they seldom fight each other, and they readily ally against you.

## Multiplayer
Play with one friend: **New map → 🎮 Multiplayer**. Pick how you play, then copy the link and send it however you like (text, chat, email). The game waits until your friend opens the link, then starts for both of you.
- **Rivals:** your friend runs a computer nation of about your size, somewhere else on the map. They can expand, build, attack, and offer you war, peace or trades. You answer their offers like any nation's.
- **Co-op:** you both command one shared empire. Either of you can give any order, and you both see the news.
- The two browsers connect directly, through the free PeerJS matchmaking service (bundled, no game server). The host's game runs the world, so the host keeps the tab open (in a hidden tab the game keeps going, but slower). If the friend drops out, the same link brings them back. In Rivals their realm is run by the computer until they do.
- **Limits:** a rival friend has a simpler set of orders than the host: no vehicles, links, walls, space programme or computers of their own. They see stocks and land every couple of seconds, so things on the move can jump a little. Only the host can change the game mode or switch on creative mode.

## The art
Every building, upgrade, vehicle, troop badge and worker was redrawn in round 9. Three artists each took a group, and an independent reviewer checked every new sprite against the old one at map size (22 and 40 px) on grass, sand, moon dust and water, sending back the ones that weren't clearly better. Upgrade ladders step up visibly: farm, irrigated farm, mechanized farm; the central computer's four levels (each upgrade has its own look); settlement houses from hut to city block; helmets from a leather cap to a drone; haulers from a porter to a self-driving hauler; boats from a rowboat to a container ship.

## Your domain's flag
Tap the flag at the top left to give the domain you're viewing a sign (12 designs) and a colour (12 colours): its land on the map, its border and its settlement labels take the colour.

## Creative mode
**Do not touch** (Command menu) switches creative mode on: every resource is infinite and every technology is researched. Press it again and choose **Off, keep this map**: your stock goes back to exactly what it was before (the technologies stay researched). Or switch it off and start a new map.

## What's new compared with the original prototype

### 1. Technology research
- Every player (you and every AI nation) has a research bar that fills faster the more people they have. People on your space stations count double.
- Each discovery shows a notification. The **Build** button shows what's being researched; the Build menu has the details.
- 36 techs follow the general order of history: Warrior Code, the Wheel and Masonry through Steam Power, Petroleum, Flight, Nuclear Fission, Electronics and Computing, up to Spaceflight, Reusable Rockets, Bubble Habitats, Terraforming, Strategic Bombers, Interplanetary Missiles, the Dyson Swarm and Artificial Intelligence. The next tech is picked from the earliest ones you can research, preferring those that use what you produce most.
- Gold you mine goes straight into research.

### 2. Build and Command
- **Build:** pick a building, tap or click the map to place it, drag it if you like, then **Confirm**.
- **Command:** click past your border to spend people on free land. Click a nation to open **diplomacy**; in Attack mode, clicking a nation in reach sends your troops.
- **Your buildings:** click one to see what it's doing: connect it to a road, build a wall, upgrade it, buy vehicles, fly a rocket.

### 3. Roads, vehicles and logistics
- **One stock per domain.** Collectors keep what they harvest in their yard until a vehicle picks it up.
- **Roads** link a domain's settlements by themselves and curve naturally. Each road is laid out once and stays put: only an enemy who conquers the land tears it up (your crews relay it if you win it back).
- **Roads matter:** off the road, cars, carts and troops crawl, and mountains slow them further unless they're on a road or a wall. Vehicles leave the road only to reach a building that isn't on one.
- **Cars:** you buy them (at a settlement) and the game puts them where they're needed most. They drive on roads, turn off at the nearest point to a collector, crawl across to it, load up and crawl back. Construction deliveries come first, then the biggest loads waiting.
- **Boats and planes** are bought at ports and airports and carry goods, people and troops between domains, and inside one big domain too (airports far apart). Planes are drawn as planes, with their shadow on the ground.
- **Trains** come free with a rail line and carry huge loads, fast. Upgrade them at any rail station: steam trains (burn wood), then diesel trains (oil, with Automobiles), then electric bullet trains (power, with Electricity). Each train is refitted, and paid for, the next time it pulls in at a station. Short of oil or power, a train runs on the tier below until the fuel comes back. Trucks bring goods to the station, where they wait in its yard for the train; at the far end trucks take them on. A long haul inside a domain goes by train whenever a station is reasonably close. Lines that share a station form a network: goods change trains and get off at the station closest to where they're needed, and wait in that station's inventory (shown on its card) until a hauler takes them on. Goods for your stock are dropped at a station by a settlement and go straight into stock there.
- **Heavy loads:** a full car, cart or boat is 30% slower than an empty one. A full train burns twice the fuel (or power), and full planes and rockets burn more too.
- **Where the goods are:** each settlement holds part of its domain's stock (shown on its card). The total is spendable anywhere: haulers fetch from whichever town holds it. Goods drift toward safe, well-defended towns, busy crossroads (stations, ports, roads), and towns near the mines and farms that make them. Capture a settlement and you take what's stored there; lose one and so do they.
- **Overland goods stay on land:** porters, carts, wagons and trucks go round water rather than across it, unless they're taking goods to a boat.
- **Haulers don't swim:** porters, carts and trucks only go over land and bridges. Goods across water go by boat, plane or rocket; a building whose materials are across the water with no bridge, port or airport waits, and its card says why.
- **Cars ride trains:** on a long trip inside a domain, a hauler drives to a rail station, rides the train on a flatcar, and drives on from the far station. Trains still carry goods and troops of their own.
- **Road works:** when your AI (C.A.I.S.) reroutes a road, that stretch shows road-works signs and barriers and is closed to haulers until it's done (a countdown shows on it).
- **Importing between your territories:** build something a territory can't afford and you're asked whether to import what's missing from your nearest territories on the same world that have it. Say yes and it goes over by road, boat or plane (or a mix), and the building goes up when it arrives. Only if no territory on that world has enough are you offered shipping from another world.
- **Transferring troops:** tap a fortress or base and choose *Transfer troops…*: pick how many, then a territory (grouped by world), then confirm. They march, sail or fly there, through your other territories if need be; to another world they go to a launch pad, fly by rocket to the destination's landing pad (both territories need a launch pad and a landing pad), and march on to its garrison.
- **Shipping between worlds:** territories on different worlds can't be linked by ports, rail or airports, only by reusable rockets, and only when each has a launch pad and a landing pad. Build something a territory can't afford and another world's territory has the materials: you're asked whether to ship them in, and a reusable rocket from the nearest such world brings them. Two territories that both have a C.A.I.S. AI order from each other by themselves.
- **Road haulers, in order:** porters, handcarts (the Wheel), pack horses (Equestrianism), carriages (Carriages), caravans (Trade Caravans: big covered wagons that carry far more each trip), trucks (Automobiles), electric trucks (Batteries), self-driving haulers (Artificial Intelligence). Order an upgrade at a settlement.
- **New vehicles as you learn:** electric trucks (Batteries) and autonomous haulers (C.A.I.S.); diesel freighters (Petroleum) and container ships (Computing); cargo jets (Computing). A vehicle one tier behind the newest is refitted **for free and by itself** the next time it calls at a hub. Techs also tune vehicles with no upgrade at all: Masonry speeds cars, Metallurgy adds cargo room to carts and boats, Steam speeds boats, Electricity speeds trains, Electronics speeds road, sea and air vehicles, M.C.C.S. speeds every vehicle, and Computing adds 15% cargo room to every vehicle.
- **Fields grow in:** a new farm's wheat doesn't appear all at once. The tiles around it are sown one at a time, in a random order.
- **Upgrades** of more than one tier happen only when you order them (from a settlement, port or airport card): each vehicle is refitted when it next calls at a hub, and you see the total price up front. Out of fuel, vehicles drop back a tier and refit by themselves when fuel returns.
- **Bridges:** pick your coast, then the land across the water. Roads, cars, rail and troops cross them.
- **Workers you can watch:** builders and scaffolding on construction sites (with a cloud of dust when they finish), lumberjacks, miners and farmers walking out to the tiles they work, and mining rigs hammering away.

### 4. Military
- **Bases and fortresses** train and hold units; capacity grows with tech. Helmets beside troop counts change with your tech.
- **Guns reach further:** Gunpowder, Firearms, Armored Warfare, Electronics, Computing and Artificial Intelligence each add range (the Command menu shows it). In a fight, the side that outranges the other hits it while it closes in and takes less in return. Cannon and machine-gun nests reach 15% further, and hit harder, with each of those techs.
- **Fighting withdrawal** (Artificial Intelligence): the Command menu's *Fall back while firing* has your fighting troops back away toward their nearest fortress while they shoot. They take no ground, but kill many and lose few (about a third of the losses). It applies to the fights going on and the ones that start while it's on.
- **Troops modernise by themselves** as you research: Warband → … → Airborne infantry (Flight) → Tanks → Mechanized infantry (Electronics) → Networked brigades (Computing) → Drone squadrons (C.A.I.S.). Electronics, Computing and C.A.I.S. also make every unit hit harder and last longer.
- **Walls** between two fortresses you pick (paid in stone) make the land harder to take and speed up marching. Walls run in **straight lines**: they turn only to stay inside your borders, to keep out of the water, and to go round resources (forests, fields, ore, oil) and other buildings. Picking the second fortress is forgiving: anywhere nearer to a glowing fortress than to the first one counts (a bigger area on phones), a slip of the mouse or finger still counts as a click, and the dashed line shows where the wall will run. Nothing cancels the wall by accident, not a miss and not a fortress it can't reach. A banner shows you're building a wall: its Cancel button, Esc, or clicking right on the first fortress cancels it.
- **Damage and repair:** each stretch of wall between two fortresses has its own health. Battered walls and forts show cracks, then a breach. A breached stretch or fort shelters no one, but it stays until the war ends. Only if the war ends with that land still lost is it gone for good. Soldiers mend them: in a lull in a war they fetch the stone themselves (more soldiers work faster and carry more, more with better tech); in peacetime haulers bring the stone and the garrison builds.
- **Wall upgrades** (click anywhere on a wall): your techs make walls tougher by themselves. You can also buy fort turrets, air defenses and an iron wall for the whole wall at once. An iron wall stops planes and missiles that cross it, and makes troops on it far harder to beat.
- **Defence:** with "Forts defend by themselves" on, troops march out of nearby forts to meet invaders and take back lost land, nearest or hardest-pressed front first, your own domain first. Outnumbered, they hold a fort or a wall instead; with enough men, they go back for any fort the enemy took.
- **Walled forts share their troops:** in quiet times troops spread out along the wall until the forts are roughly even; when a threat comes near, they gather at the fort closest to it.
- **Attacking** a nation draws on fortresses first. Troops follow roads, and cross the sea by boat from your ports. You can strike nations whose borders don't touch yours, within your reach.
- **Cannons and machine guns** fire on any nation you're at war with.

### 5. Resources, fuel and gold
- **Gold** is stored and spent: at the market (click Gold in the top bar, or a settlement), to rush a building, to hire troops at a base or fortress, and in trades, treaties and surrender terms. The gold in your treasury also speeds research and training and toughens your troops.
- **Oil** (with Petroleum) runs trucks, planes, ships, motorized troops and oil power plants. The counter shows the net rate. Without oil, things fall back to older tech.
- **Uranium** (with Nuclear Fission) runs reactors and, with Nuclear Weapons, nuclear warheads.
- **Wheat:** farms turn plain land (never mountains) into fields. Nobody goes hungry while there's wheat in store, even if you eat more than you grow; the people bar shows how long the stores will last.

### 5b. Silicon, cobalt and computing
- **Silicon and cobalt** appear with Electronics. They're rare at home (a few small deposits, if any) and common on the Moon and Aries. Silicon refineries dig and refine silicon; miner's camps dig cobalt. You can also buy them at the market.
- **Cobalt is hard rock:** a miner's camp digs it at a quarter speed; upgrade the camp to a mining rig (Electricity) and it comes 24 times as fast.
- **Settlement stock:** a settlement's card shows what's stored there laid out like the stock at the top of the screen: an icon, the amount and a bar for each resource.
- **Chip factories** turn silicon and a little gold into computer chips. Solar panels, launch pads, reusable rockets, the Dyson swarm and more now need silicon, cobalt or chips.
- **Batteries** (Build menu, Crafting) store spare power and cover shortfalls. Electric trains draw on them too.
- **Central computer** (one per domain, 30 MW): everything else in the domain uses 25% less power, wheat +10%, troops train 30% faster, research 25% faster. Every rocket that flies itself (freighters, supply rockets, colony ships, the Dyson swarm, interplanetary missiles) needs one somewhere in your empire. The first space station's rocket doesn't. **Data centers** add 1% each.
- **Upgrades:** the M.C.C.S. (stronger bonuses, research +40%, rocket range x6), then the Q.C.A. (research +50% more), then **C.A.I.S.**, an AI.
- **The AI (C.A.I.S.):** open the computer to give it work. Its compute comes from data centers and the share of spare power you give it (Energy tab). More compute unlocks more commands, and from 25 compute it makes big moves without asking first. You set what share of the domain's resources and troops it may use: that share of what's there now, and of everything made later. Its commands:
  - Building strategy, Grid manager (batteries), Trade manager, and Logistics (buys haulers when goods pile up).
  - Road restructuring: it bends your existing roads past buildings that aren't on one. It never adds roads.
  - Early warning, Hadrian's Gambit (fortresses and walls around the domain's edge, upgraded over time), a Research director, and Diplomacy.
  - War command, with four strategies: defensive, guerrilla, pillage and conquest.
- **Reusable rocket marks:** Mk I reaches only the Moon. Refits (Mk II to IV) carry more, fly faster and go further. An M.C.C.S. multiplies range by six.

### 6. Diplomacy
- **Click a nation** to see how it feels about you, who it's at war with and who it's allied to. Offer trades (resources, or whole settlements and their land), declare war, make peace, or propose, found or join an alliance.
- **Allies** come to each other's aid. Attacking an ally is a betrayal: you're warned first, and every member (and every other nation) thinks far worse of you. Leaving or disbanding (Command menu) hurts less.
- **The nations live their own lives:** opinions drift with borders, shared enemies, common threats and trade. They declare war on each other, fight along their borders or across the sea, make peace when the war costs too much, found alliances (sometimes against you), fall out, and settle overseas when they're boxed in.
- **They come to you too, now and then:** trade offers for what they actually need, treaties, alliance invitations, peace offers from a losing enemy, calls for help from an ally, and the occasional threat ("pay, or else").
- **Treaties:** non-aggression (breaking it angers every nation), "don't expand toward my border", research pacts, open borders (strike nations beyond a friend's land), tribute, ceasefires, and asking a nation to join your war. Add gold to sweeten a proposal.
- **Demand surrender** from a nation at war with you: goods, gold, people, soldiers, transport units, settlements, or total surrender. They weigh how badly the war is going for them against how harsh the terms are.
- **Ask every nation at once** (Command menu, or any nation's panel): treaties, peace, trades and surrender terms go to all of them, and each answers for itself.
- **Trade travels:** whatever is traded (by you or between nations) is carried by the sender's own tech: porters or carts early on, boats of their era over water, and planes only once they can fly.

### 7. Space
- **Polar ice caps** at the north and south of the world. **Ice drills** there make rocket fuel; without them, launch pads burn oil.
- **Launch pads** build and fuel a rocket. Fly it by hand like the original: coast out past the rim, climb, turn and burn. Once it's in orbit, make it a **space station**, or simply press **Build a space station** on the pad's card and the rocket flies itself up. When you get Spaceflight, the launch pad (and then your pad on the map) glows to show the next step. Stations house scientists and grow with supplies.
- **Reusable rockets** (bought at a launch pad) are big freighters between worlds. Trucks load them while they fuel; they drop station supplies on the way, land on another world's **landing pad**, trucks unload them, and a truck tows the rocket to that world's launch pad for the trip back. While one loads and fuels on a pad, nothing else can use that pad. Set a pad to **reusable rockets only** and it turns teal and stops offering other rockets until you switch it back.
- **The more advanced AI nations** put up stations of their own.

### 8. Other worlds
- **The sky from other worlds:** zoom out on the Moon or Aries and you see the Sun, your home world and the other planets where they really are. Click one of your worlds to go there.
- **The Moon and Aries are full maps.** With Bubble Habitats, a launch pad can send a **colony ship**: you pick the landing spot on that world's map.
- Colonies live under **glass domes** (yours and the nations'): the land outside holds few people. **Terraformers** slowly turn the dust around them green so it holds people like home does.
- **Terraforming a whole world:** once enough terraformers stand on a world and are well powered (the terraformer card shows how many: about 10 on the Moon and 9 on Aries), the whole planet starts turning green, a little at a time and in random places. More than enough makes it go faster. When the whole world is green, its air is breathable: the domes come down.
- Switch worlds from **Command → Worlds**, or lock onto the Moon or Aries from home and double-click (double-tap) it. Every world keeps running while you look at another.
- Off home, wheat grows only on land the terraformers have turned green (a landing colony brings a small greenhouse patch).
- Advanced nations found outposts on the worlds you reach, and wars can be fought on any world.

### 9. The late game
- **Nuclear bombers** (Command → Bomber) fly from an airport to anywhere on the map. Ruinously expensive, and air defenses, forts and enemy fighters shoot many of them down on the way.
- **Interplanetary missiles:** look at another world and use Fire: a silo on any of your worlds strikes it.
- **The Dyson swarm:** a launch pad at home builds it round the sun, ten rocketloads at a time (each a tenth of the huge cost, sent as the domain can pay). While it's built you see a grey scaffold round the sun, mirrors bolted on as each load lands, welding sparks at the build front, and receivers get half power. Finished, the sun wears a golden halo and every Dyson receiver catches a beam of light from it (on other worlds the beam comes straight down out of the sky). Receivers only draw on the nearest star.
- **The Casimir Effect** (very expensive to research: four times a normal tech) unlocks the **Alcubierre drive**. Order it from any launch pad: eight rocketloads assemble it in orbit round that world, a scaffold first, ring segments added as loads arrive. Finished, its warp ring glows blue-violet. Any rocket bound further than it can fly (a colony ship, or a reusable rocket of any mark) rises to the drive and docks (the clamps close round it), the drive folds space in a flash of ripples, and the rocket casts off over the destination and lands. The drive stays in orbit round the world it last went to.
- **Planned:** when the space map grows beyond this solar system, fully upgraded rockets will reach anywhere in the solar system on their own, and the Alcubierre drive will be needed to go beyond it.

### 10. AI personalities
Each nation is dealt a personality, varied a little on every map: **Warlord**, **Expansionist**, **Fortress-builder**, **Scholar**, **Opportunist** and **Raider**. It shapes how they build, research, fight, make friends and hold grudges.

## Controls

| Desktop | Phone | Action |
|---|---|---|
| Click past your border | Tap | Expand (Command mode) |
| Click a nation | Tap a nation | Diplomacy (or attack, in Attack mode) |
| Right-click | Long-press, or Command → Expedition | Send an expedition (steer it, then Settle) |
| Click your building | Tap your building | Its card: roads, walls, upgrades, vehicles, rockets |
| B / E | Build button | Build menu |
| Q | Command button | Command menu |
| Click or drag, then Enter | Tap or drag, then Confirm | Place a building |
| 1 / 2 / 3 | Command menu | Expand / Attack / Expedition |
| F | Command → Fire | Aim missile silos |
| Arrows/WASD, Space, X | Steering pad | Drive an expedition, or fly a rocket |
| Space · W/S · A/D · Enter | Engine · ▲▼ · ◀▶ · button | Rocket: engine · throttle · turn · make a station |
| Drag · scroll | Drag · pinch | Pan · zoom |
| Tab · M · H · Esc | Command menu | Next domain · map view · home · cancel |

## Files

`index.html`, `style.css` and `game.js` (plus `peerjs.min.js`, the MIT-licensed PeerJS library, for multiplayer): no build step, so it runs straight from GitHub Pages. Every tuning number is in `CFG` at the top of `game.js`.
