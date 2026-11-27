# Game Trial

A remake of the [Map Factory prototype](https://yclen.github.io/map-factory/prototype) by yclen: a territory and economy game on a seeded disk world floating in space. Grow your domains, feed your people, research your way from the Wheel to reusable rockets, settle the Moon and Aries, and deal with AI nations that trade, ally, scheme and fight like people.

**▶ Play:** https://aycooper1-png.github.io/Game-Trial/

**Working on the code (people or AI):** read [CLAUDE.md](CLAUDE.md) first (also at https://aycooper1-png.github.io/Game-Trial/CLAUDE.md). It says how to handle a request (restate it and ask clarifying questions before coding), how the code is organised, how to test and publish, and the design decisions already made.

The game works on phones as well as on desktops. It autosaves in your browser every 10 seconds. Add `?seed=123` to the address to play a specific map.

## Game modes
Pick one when you start a new map, and change it any time from the Command menu (Mode):
- **Peaceful:** no wars at all, for anyone. The nations still race you for land, trade and tech.
- **Easy:** slow, mostly peaceful nations. They leave diplomacy to you, and seldom side against you in your wars.
- **Normal:** sensible nations that plan, trade and make some diplomacy of their own.
- **Hard:** sharp nations. They pick their moments, strike where you're weakest, deal shrewdly, and invest heavily in armies and fortresses. Advanced ones run their own central computers.
- **Murder mode:** as sharp as Hard, but every nation dislikes you, they seldom fight each other, and they readily ally against you.

## Multiplayer
Play with one friend: **New map → 🎮 Multiplayer**, then:
- **Host a game:** pick how you play (Rivals or Co-op) and how the other nations behave, and tap **Start game**. You get a **6-character game code** (tap it to copy). The game waits until your friend is in, then starts for both of you.
- **Join a game:** type the code your friend's game is showing and tap **Join**. That's all: the code carries the map and the settings. (The host's screen also offers a link to send instead, which does the same thing.)

If the connection drops, the game says so in a strip at the top and **reconnects by itself**: nobody has to reload. In Co-op the second player's game waits while the line is down; in Rivals each realm carries on. If the host reloads their page, the same code reopens the room and the friend is taken back in automatically. Where the phone allows it, the screen is kept awake during a multiplayer game (a sleeping phone drops the line).
- **Rivals:** your friend plays a full realm of their own (taking over a nation's land), with everything you have: farms and industry, research, vehicles, armies, colonies and space. Each browser runs its own realm and the two stay in sync every couple of seconds; you see each other as a nation and can go to war, make peace or trade. Their game saves on their own device, so the same link brings their realm back.
- **Co-op:** you both command one shared empire. Either of you can give any order, and you both see the news.
- The two browsers connect directly, through the free PeerJS matchmaking service (bundled, no game server). The host's game runs the world, so the host keeps the game open on screen (in a hidden desktop tab the game keeps going, but slower; a phone that is locked or switched to another app freezes the game until you come back, and then reconnects). If the friend drops out, the same code (or link) brings them back. In Rivals their realm waits, unchanged, until they do; after 45 seconds away the computer looks after their nation.
- **If it won't connect:** both players need the newest version (close the game's tab and open it again). A few networks (some mobile carriers, school or office Wi-Fi) block direct connections between devices; if "Still connecting…" goes on and on, one of you should try a different Wi-Fi or mobile data.
- **Limits:** the two realms sync every couple of seconds, so the other player's land and buildings can jump a little. Computer nations raid only the host, and their offers go only to the host. Only the host can change the game mode or switch on creative mode.

## Haulers on request, and other helpers
- **Request porter** (on any settlement's card; the button names your current hauler model): after you confirm, one of your haulers comes over to stay and work around that settlement. It comes from the nearest place where haulers are standing idle; if none is idle anywhere, from the territory whose haulers have the least waiting for them (it sets down its load first). Never a territory's last hauler. It walks or drives if it can; otherwise it rides: the train when that is quicker than the road, a boat rather than a plane between territories, and a rocket (launch pad to landing pad) between worlds.
- **Upgrades:** a hauler takes the upgrade you ordered whenever it stops in a settlement with nothing on its back, whatever it came for (to load, to unload, or to wait): a couple of seconds in the workshop for each model, then it carries on.
- **Importing for troops and haulers:** if a territory can't afford to **hire troops** or **buy a hauler** and your other territories can send what's missing, the button says "(import…)" and asks you first, just as for buildings. The goods travel like any import, and the troops are hired (at the price shown when you asked) or the hauler bought when the last of them arrives.
- **Connect to road** is offered on every building that isn't on a road. It now reaches roads and settlements up to 90 tiles away (the road just costs more stone); when no road can be laid, the button is greyed and says why.
- Messages fit your situation: with a single territory, nothing talks about goods being "shipped in"; the game says plainly what you're short of.

## Taking things down, roads, bridges (round 18)
- **Deconstruct** (on any building's card): after "Are you sure?" (which shows what you get back), you get **half of everything it cost**, upgrades included. A hauler carries it to the nearest settlement, then the building comes down in a dust cloud (3 s for early buildings, 4 s industrial, 5 s space age). A settlement's goods are carried to your other settlements first and its people move to them if there's room; its roads stay. A territory's last settlement can go too: the land stays yours, empty. A fortress's troops march to the nearest fortress or base (with none, they stay in the settlement nearest your enemies, which then defends with them). Boats, trains and planes of a port, station or airport carry on from your others; with none left they wait, unused. **Planes in the air when your last airport goes** crash-land: 13% survive and wait on the ground (tap one to scrap it), and a porter brings them to the next airport you build.
- **Rockets** whose landing pad is gone land on another pad on that world, else fly back; with no pad anywhere they try open ground: 2% (Mk I) to 10% (Mk IV) survive, up to 30% with a C.A.I.S. drawing lots of power.
- **Abort** a building under construction (or an upgrade): what was already delivered comes back at half, once a hauler has carried it off; loads on the way are set down at the nearest settlement; gold spent rushing is lost.
- **The C.A.I.S. won't be switched off** while it holds all of the power. Keep trying and it gets nastier, then tells you exactly what it thinks of how you've played. Play well enough and it begs instead, and you may spare it or flip the kill switch.
- **Roads:** tap a road (zoomed in) and it lights up green: **Expand** adds a lane (up to a three-lane highway, half a stone a tile per lane), **Delete** removes it. A deleted road between settlements doesn't come back until you rebuild it from either settlement's card; a road out to a building gives back half its stone. A C.A.I.S. with Road restructuring and at least 75% of the power may take away little-used roads that have a way round.
- **Resource buildings** can only be placed where they have something to harvest that no other collector (even one still being built) already claims; farms need green land or desert. A collector left with nothing to work gets a red **!**. **Desert fields** spread three times more slowly and give half the wheat (terraforming turns them green).
- **Bridges** (tap one): a basic bridge takes road haulers or trains, not both at once: they take turns (whoever has waited 20 s goes next), and both give way to troops, who pause every 20 s to let the others across. **Upgrade** it (its stone again, plus 2 iron a tile) and everything crosses at once, both ways. **Connect to road** lays a road over it from your nearest settlement (paid in stone); a brand-new settlement whose nearest neighbour is a bridge gets a road over it for free. **Deconstruct** gives back half its stone, once the traffic on it has crossed.
- **Airless worlds** (until they're terraformed): your porters and horses wear little space helmets, carts get metal wheels and trucks become space buggies. Same speed and loads.

## The art
Every building, upgrade, vehicle, troop badge and worker was redrawn in round 9. Three artists each took a group, and an independent reviewer checked every new sprite against the old one at map size (22 and 40 px) on grass, sand, moon dust and water, sending back the ones that weren't clearly better. Upgrade ladders step up visibly: farm, irrigated farm, mechanized farm; the central computer's four levels (each upgrade has its own look); settlement houses from hut to city block; helmets from a leather cap to a drone; haulers from a porter to a self-driving hauler; boats from a rowboat to a container ship.

## Your domain's flag
Tap the flag at the top left to give the domain you're viewing a sign (12 designs) and a colour (12 colours): its land on the map, its border and its settlement labels take the colour.

## Tutorial
Every new world starts by offering a short guided tour (tap **No thanks** to skip it). It walks you through the basics step by step, pointing at the real buttons, with **Next**, **Back** and **Skip tutorial** on every step. At the end you can carry on with an **Advanced** part (new territories, ports, moving troops, the central computer, space, multiplayer). The game waits while you read (in multiplayer it keeps going). The 📖 book in the Command panel starts the tour again from the beginning.

## Sound
The game starts muted: tap the small speaker next to **Do not touch** in the Command panel to turn sound on. You only hear what you're zoomed in on, at full volume when fully zoomed in, fading as you zoom out and silent before buildings turn into map icons.
- **Haulers on the move:** porters, handcarts, pack horses, carriages and caravans, trucks and self-driving haulers each have their own sound (electric trucks are silent).
- **Land battles** fought by troops, yours or the nations', when you're zoomed in on them. Nothing in space, and missiles are silent.
- **Builders:** zoom right in on a construction site and tap one of the builders while they work. Each one has a few things to say, in order, and then he's had enough.
- With lots going on, only the few nearest the middle of the screen are heard for each kind of sound, so it never turns into a din.

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
- **Boats and planes** are bought at ports and airports and carry goods, people and troops between domains, and inside one big domain too (airports far apart). Planes are drawn as planes, with their shadow on the ground, and fly a straight line at whatever angle the route takes. With more than one territory, the top bar shows the selected territory's own stock in small type under each total (zoomed in: the territory you're looking at).
- **Trains** come free with a rail line and carry huge loads, fast. Upgrade them at any rail station: steam trains (burn wood), then diesel trains (oil, with Automobiles), then electric bullet trains (power, with Electricity). Each train is refitted, and paid for, the next time it pulls in at a station. Short of oil or power, a train runs on the tier below until the fuel comes back. Trucks bring goods to the station, where they wait in its yard for the train; at the far end trucks take them on. A long haul inside a domain goes by train whenever a station is reasonably close. Lines that share a station form a network: goods change trains and get off at the station closest to where they're needed, and wait in that station's inventory (shown on its card) until a hauler takes them on. Goods for your stock are dropped at a station by a settlement and go straight into stock there.
- **Heavy loads:** a full car, cart or boat is 30% slower than an empty one. A full train burns twice the fuel (or power), and full planes and rockets burn more too.
- **Where the goods are:** each settlement holds part of its domain's stock (shown on its card). The total is spendable anywhere: haulers fetch from whichever town holds it. Goods drift toward safe, well-defended towns, busy crossroads (stations, ports, roads), and towns near the mines and farms that make them. Capture a settlement and you take what's stored there; lose one and so do they.
- **Overland goods stay on land:** porters, carts, wagons and trucks go round water rather than across it, unless they're taking goods to a boat.
- **Haulers don't swim:** porters, carts and trucks only go over land and bridges. Goods across water go by boat, plane or rocket; a building whose materials are across the water with no bridge, port or airport waits, and its card says why.
- **Cars ride trains:** on a long trip inside a domain, a hauler drives to a rail station, rides the train on a flatcar, and drives on from the far station. Trains still carry goods and troops of their own.
- **Road works:** when your AI (C.A.I.S.) reroutes a road, that stretch shows road-works signs and barriers and is closed to haulers until it's done (a countdown shows on it).
- **Importing between your territories:** build something a territory can't afford and you're asked whether to import what's missing from your nearest territories on the same world that have it. Say yes and the sending territory's haulers carry it: straight over land if the two share a landmass, or out to their port (station, airport), where it waits on the quay for the next boat (train, plane). At the far end it waits in the yard until a hauler of that territory takes it to the site. Haulers never turn into boats. A territory with no haulers of its own gets one: a hauler boards with the goods and stays there. Across water with no port, station or airport linking the two, there's no import: you're told what to build. Supplies sent automatically between linked territories go the same way. Only if no territory on that world has enough are you offered shipping from another world.
- **Transferring troops:** tap a fortress or base and choose *Transfer troops…*: pick how many, then a territory (grouped by world), then confirm. They march, sail or fly there, through your other territories if need be; to another world they go to a launch pad, fly by rocket to the destination's landing pad (both territories need a launch pad and a landing pad), and march on to its garrison.
- **Shipping between worlds:** territories on different worlds can't be linked by ports, rail or airports, only by reusable rockets, and only when each has a launch pad and a landing pad. Build something a territory can't afford and another world's territory has the materials: you're asked whether to ship them in, and a reusable rocket from the nearest such world brings them. Two territories that both have a C.A.I.S. AI order from each other by themselves.
- **Road haulers, in order:** porters, handcarts (the Wheel), pack horses (Equestrianism), carriages (Carriages), caravans (Trade Caravans: big covered wagons that carry far more each trip), trucks (Automobiles), electric trucks (Batteries), self-driving haulers (Artificial Intelligence). Order an upgrade at a settlement. A hauler you buy rolls out of the settlement you bought it at, and sees to the building sites around it first.
- **Keeping to the road:** haulers join a road wherever it passes nearest, not only at its ends. Porters cut across country freely; each better hauler sticks to the road more, and self-driving haulers follow the road to the point nearest where they're going and only leave it there.
- **Roadside buildings:** a road running right beside a collector (camp, cabin, derrick...) counts as connecting it. Haulers pull up on the road beside it to load and drive on.
- **Real loads:** no hauler, boat, train or plane ever carries more than it holds; a big load takes several trips, and two or so of a territory's haulers (about two in five) work one job together while the rest carry on. Each vehicle's load is in proportion to the real thing, as far as the game allows: porters 10, handcarts 16, pack horses 22, carriages 60, caravans 140, trucks 250, electric trucks 400, self-driving haulers 800; sailboats 30, galleons 60, steamships 185, diesel freighters 650, container ships 1,500; propeller planes 40, jets 220, wide-body freighters 550; steam trains 220, diesel 1,100, electric 1,750.
- **Loads and speed:** a full vehicle runs at 65% of its speed and an empty one at 125%, but a full load still moves the most goods per trip, so running full is always best.
- **Traffic:** a road carries about one hauler every three tiles per lane at full speed; more and they slow down. A road that stays jammed is widened to two lanes (half a stone a tile, paid by its territory).
- **Upkeep:** porters, horses and drivers eat wheat (porters 0.012 a second, caravans 0.045), electric trucks and self-driving haulers draw power, trucks burn oil as they drive, and every troop eats 0.004 wheat a second. The people bar shows the total upkeep.
- **Quays and timetables:** goods wait on a port's (station's, airport's) quay for the next boat (train, plane). A quay holds 20,000; past that, goods wait at home. Boats, trains and planes stop for 3 seconds, and hold on up to 15 seconds more if they have room and a hauler is on the way with goods for them.
- **Haulers ride trains only when they must:** when one is needed very far off, with no road there and a rail stop much closer. Otherwise they drive (goods still go by train: haulers set them down at the station). The one exception is a hauler you called with **Request porter**: it takes the train whenever that is quicker.
- **Troops across the water** march to their port and board a boat on the sea route, then march on from the far port. With Electronics (mechanized infantry and later), if no boat is free they turn their own vehicles into boats at the port: a few seconds' work, then they cross themselves, green and slow. Earlier troops wait on the quay for a boat.
- **New vehicles as you learn:** electric trucks (Batteries) and autonomous haulers (C.A.I.S.); diesel freighters (Petroleum) and container ships (Computing); cargo jets (Computing). A vehicle one tier behind the newest is refitted **by itself, for a little gold** the next time it calls at a hub (electric truck 10, self-driving hauler 25, diesel freighter 15, container ship 30, wide-body freighter 30); with no gold there, it keeps its old model for now. Techs also tune vehicles with no upgrade at all: Masonry speeds cars, Metallurgy adds cargo room to carts and boats, Steam speeds boats, Electricity speeds trains, Electronics speeds road, sea and air vehicles, M.C.C.S. speeds every vehicle, and Computing adds 15% cargo room to every vehicle.
- **Fields grow in:** a new farm's wheat doesn't appear all at once. The tiles around it are sown one at a time, in a random order.
- **Upgrades** go one model at a time, never skipping one (except in creative mode): order the next model from a settlement, port, airport or station card, and once it's ordered you can order the one after straight away. Each vehicle is refitted when it next calls at a hub, paying for every model it climbs, and you see the total price up front. Out of fuel, vehicles drop back a tier and refit by themselves when fuel returns.
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
- **The market** (tap Gold in the top bar, or Market on a settlement): tap a resource, pick how many (10, 50 or 100), then **Buy** or **Sell**; the price is on the button. Buying costs a quarter more than the goods are worth, selling gets a quarter less. The goods are in your stock at once.
- **Gold** is stored and spent: at the market, to rush a building, to hire troops at a base or fortress, and in trades, treaties and surrender terms. The gold in your treasury also speeds research and training and toughens your troops.
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
  - Road restructuring: it weighs each of your roads against every building that needs hauling and relays a road when a new shape serves them better overall, swinging past buildings where that costs little and staying straight where it wouldn't, with gentle bends only. It may stretch a road 20% beyond its first length, rising to 50% with more data centers and power. It looks again as you build. Optionally (a setting under the command, off at first) it builds spur roads to buildings no road can reach, paid in stone.
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
- **Envoys:** peace, treaties, alliances and trades go by envoy. The panel says the envoy is on its way, and the nation's answer comes back as a notification: a few seconds for a neighbour, up to 25 for one far away.
- **Counter-offers:** an answer is an acceptance, a refusal or a counter-offer (the terms they would take: less in return for your goods, gold to sweeten a treaty, reparations for peace, a smaller tribute). A counter-offer can be accepted, rejected or countered in turn (it opens their panel with their terms filled in). The nations' own offers to you can be countered too, demands included (offer less), and so can your friend's in Rivals.
- **Ask every nation at once** (Command menu, or any nation's panel): treaties, peace and trades go to all of them, and their answers come back together in one notification.
- **Trade travels:** whatever is traded (by you or between nations) is carried by the sender's own tech: porters or carts early on, boats of their era over water, and planes only once they can fly. Over water it waits on the quay for the boat, and with your own ports it goes through them: your haulers carry what you send out to your port, and what you receive lands at your port for them to bring in.

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
