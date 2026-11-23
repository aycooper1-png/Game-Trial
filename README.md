# Game Trial

A remake of the [Map Factory prototype](https://yclen.github.io/map-factory/prototype) by yclen: a territory and economy game on a seeded disk world floating in space. Grow your domains, feed your people, research your way from the Wheel to reusable rockets, settle the Moon and Aries, and deal with AI nations that trade, ally, scheme and fight like people.

**▶ Play:** https://aycooper1-png.github.io/Game-Trial/

The game works on phones as well as on desktops. It autosaves in your browser every 10 seconds. Add `?seed=123` to the address to play a specific map.

## What's new compared with the original prototype

### 1. Technology research
- Every player (you and every AI nation) has a research bar that fills faster the more people they have. People on your space stations count double.
- Each discovery shows a notification. The **Build** button shows what's being researched; the Build menu has the details.
- 25 techs follow the general order of history: Warrior Code, the Wheel and Masonry through Steam Power, Petroleum, Flight and Nuclear Fission, up to Spaceflight, Reusable Rockets, Bubble Habitats and Terraforming. The next tech is picked from the earliest ones you can research, preferring those that use what you produce most.
- Gold you mine goes straight into research.

### 2. Build and Command
- **Build:** pick a building, tap or click the map to place it, drag it if you like, then **Confirm**.
- **Command:** click past your border to spend people on free land. Click a nation to open **diplomacy**; in Attack mode, clicking a nation in reach sends your troops.
- **Your buildings:** click one to see what it's doing: connect it to a road, build a wall, upgrade it, buy vehicles, fly a rocket.

### 3. Roads, vehicles and logistics
- **One stock per domain.** Collectors keep what they harvest in their yard until a vehicle picks it up.
- **Roads** link a domain's settlements by themselves and curve naturally. They share stretches with the roads out to your buildings, and re-route when new settlements appear.
- **Cars:** you buy them (at a settlement) and the game puts them where they're needed most. They drive on roads, turn off at the nearest point to a collector, crawl across to it, load up and crawl back. Construction deliveries come first, then the biggest loads waiting.
- **Boats and planes** are bought at ports and airports and carry goods, people and troops between domains; rail lines come with a train. Cargo shows as resource icons.
- **Upgrades** happen only when you order them (from a settlement, port or airport card): each vehicle is refitted when it next calls at a hub, and you see the total price up front. Out of fuel, vehicles drop back a tier and refit by themselves when fuel returns.
- **Bridges:** pick your coast, then the land across the water. Roads, cars, rail and troops cross them.
- **Workers you can watch:** builders and scaffolding on construction sites (with a cloud of dust when they finish), lumberjacks, miners and farmers walking out to the tiles they work, and mining rigs hammering away.

### 4. Military
- **Bases and fortresses** train and hold units; capacity grows with tech. Helmets beside troop counts change with your tech.
- **Walls** between two fortresses you pick (paid in stone) make the land harder to take and speed up marching.
- **Defence:** with "Forts defend by themselves" on, troops march out of nearby forts to meet invaders and take back lost land, nearest or hardest-pressed front first, your own domain first.
- **Attacking** a nation draws on fortresses first. Troops follow roads, and cross the sea by boat from your ports. You can strike nations whose borders don't touch yours, within your reach.
- **Cannons and machine guns** fire on any nation you're at war with.

### 5. Resources, fuel and gold
- **Gold** isn't stored: what you mine speeds up research and training and toughens your troops.
- **Oil** (with Petroleum) runs trucks, planes, ships, motorized troops and oil power plants. The counter shows the net rate. Without oil, things fall back to older tech.
- **Uranium** (with Nuclear Fission) runs reactors and, with Nuclear Weapons, nuclear warheads.
- **Wheat:** farms turn plain land into fields. No food, no growth.

### 6. Diplomacy
- **Click a nation** to see how it feels about you, who it's at war with and who it's allied to. Offer trades (resources, or whole settlements and their land), declare war, make peace, or propose, found or join an alliance.
- **Allies** come to each other's aid. Attacking an ally is a betrayal: you're warned first, and every member (and every other nation) thinks far worse of you. Leaving or disbanding (Command menu) hurts less.
- **The nations live their own lives:** opinions drift with borders, shared enemies, common threats and trade. They declare war on each other, fight along their borders or across the sea, make peace when the war costs too much, found alliances (sometimes against you), fall out, and settle overseas when they're boxed in.
- **They come to you too:** trade offers, alliance invitations, peace offers from a losing enemy, calls for help from an ally, and the occasional threat ("pay, or else").

### 7. Space
- **Polar ice caps** at the north and south of the world. **Ice drills** there make rocket fuel; without them, launch pads burn oil.
- **Launch pads** build and fuel a rocket. Fly it by hand like the original: coast out past the rim, climb, turn and burn. Once it's in orbit, make it a **space station**. Stations house scientists and grow with supplies.
- **Reusable rockets** (bought at a launch pad) fly themselves: up to the station that needs supplies, down to a **landing pad**, and home.
- **The more advanced AI nations** put up stations of their own.

### 8. Other worlds
- **The Moon and Aries are full maps.** With Bubble Habitats, a launch pad can send a **colony ship**: you pick the landing spot on that world's map.
- Colonies live under **domes**: the land outside holds few people. **Terraformers** slowly turn the dust green so it holds people like home does.
- Switch worlds from **Command → Worlds**. Every world keeps running while you look at another. Reusable rockets also fly freight to landing pads on other worlds.
- Advanced nations found outposts on the worlds you reach.

### 9. AI personalities
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

`index.html`, `style.css` and `game.js`: no build step, so it runs straight from GitHub Pages. Every tuning number is in `CFG` at the top of `game.js`.
