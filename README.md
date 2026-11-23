# Game Trial

A remake of the [Map Factory prototype](https://yclen.github.io/map-factory/prototype) by yclen: a territory and economy game on a seeded disk world floating in space. Grow your domains, feed your people, research your way from the Wheel to Rocketry, and fight AI nations that each play their own way.

**▶ Play:** https://aycooper1-png.github.io/Game-Trial/

The game works on phones as well as on desktops. It autosaves in your browser every 10 seconds. Add `?seed=123` to the address to play a specific map.

## What's new compared with the original prototype

### 1. Technology research
- Every player (you and every AI nation) has a research bar. It fills faster the more people you have.
- Each discovery shows a notification. The **Build** button shows what's being researched and how far along it is. The Build menu shows the full details.
- The 19 techs follow the general order of history, from Warrior Code, the Wheel and Masonry to Steam Power, Petroleum, Flight and Rocketry. The next tech is picked from the earliest ones you can research, preferring the ones that use the resources you produce most. A tech that needs a resource you don't have is only picked first when no other tech makes sense.
- Gold you mine goes straight into research.

### 2. Build and Command
- **Build:** pick a building, then tap or click the map to place it. You can drag it around before tapping **Confirm** to build it.
- **Command:** click past your border to spend people on free land. If you click a neighbour's land where your borders touch, the game asks whether to attack. Choose **Attack** to send your troops, or **No** to make your border stop at theirs. The Command menu also has Attack, Expedition, Fire (missile silos), people and troop percentages, a switch to turn troop training on or off, and map and navigation buttons.

### 3. Logistics
- Each domain (separate piece of your territory) has its own hidden stock. The top bar shows everything added up. Point at a domain to see its own stock.
- A domain can only build with what it holds. If it's short, the building becomes a construction site with a turning gear. The missing goods are sent from your other domains as consignments that ride the regular carts, ships, trains and planes, link after link. Troops travel the same way.
- Links: **caravan posts** (roads, from the Wheel), **ports** (Sailing), **rail stations** (Steam Power) and **airports** (Flight).
- Transport improves with tech:
  - Stone roads (Masonry) and Carriages let carts carry more.
  - Equestrianism and Automobiles make carts and troops faster.
  - Shipbuilding and Steamships are the two ship upgrades.

### 4. Military
- **Military bases** train people into units. Each unit costs more people as units get more advanced: Warband, Swordsmen, Cavalry, Musketeers, Riflemen, Motorized infantry, then Tanks.
- Units march from bases to **fortresses**. Both have a capacity, and training stops when everything is full. Capacity and training speed grow with tech.
- Troop numbers show in green below the population, both in the people panel and under domain names on the map. Marching columns and battles show a soldier badge.
- Attacks draw on fortresses first. Bases send troops only when they're closer to the fight, or the fortresses are empty. Territory changes hands where your units are fighting.
- Upgrades: Metallurgy and Armored Warfare make units tougher, Gunpowder, Firearms and Armored Warfare make them hit harder, and Equestrianism and Automobiles make them faster.

### 5. Resources
- **Gold** (mountains and deserts) is mined by miner's camps and turned into research straight away.
- **Oil** stays hidden until you research Petroleum. Oil derricks pump it, and late buildings and units use it.
- **Wheat:** a **farm** turns the plain land around it into wheat fields. Everyone eats. The top bar shows how much wheat you gain or lose each second. Without enough wheat your population stops growing. If your stores run out, people slowly leave until there are only as many as your fields can feed. A farm that is destroyed or captured takes its fields' food with it. Farms can be upgraded twice: Irrigated, then Mechanized. Settlements still set the maximum population.

### 6. AI personalities
Each nation is dealt a personality, and its numbers are varied a little on every map:
- **Warlord:** aggressive.
- **Expansionist:** grabs land.
- **Fortress-builder:** turtles and builds defenses.
- **Scholar:** researches fast and attacks once it's ahead in tech.
- **Opportunist:** strikes when you look weak.
- **Raider:** sends frequent small raids.

## Controls

| Desktop | Phone | Action |
|---|---|---|
| Click past your border | Tap | Expand (Command mode) |
| Click a neighbour's land | Tap | Attack it, or stop at its border |
| Right-click | Long-press, or Command → Expedition | Send an expedition |
| B / E | Build button | Build menu |
| Q | Command button | Command menu |
| Click or drag, then Enter | Tap or drag, then Confirm | Place a building |
| 1 / 2 / 3 | Command menu | Expand / Attack / Expedition |
| F | Command → Fire | Aim missile silos |
| Arrows/WASD, Space, X | Steering pad | Drive and settle an expedition |
| Drag · scroll | Drag · pinch | Pan · zoom |
| Tab · M · H · Esc | Command menu | Next domain · map view · home · cancel |

## Files

`index.html`, `style.css` and `game.js`: no build step, so it runs straight from GitHub Pages. Every tuning number is in `CFG` at the top of `game.js`.
