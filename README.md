# Game Trial

A remake of the [Map Factory prototype](https://yclen.github.io/map-factory/prototype) by yclen: a territory and economy game on a seeded disk world floating in space. Grow your domains, feed your people, research your way from the Wheel to Rocketry, and fight AI nations that each play their own way.

**▶ Play:** https://aycooper1-png.github.io/Game-Trial/

The game works on phones as well as on desktops. It autosaves in your browser every 10 seconds. Add `?seed=123` to the address to play a specific map.

## What's new compared with the original prototype

### 1. Technology research
- Every player (you and every AI nation) has a research bar. It fills faster the more people you have.
- Each discovery shows a notification. The **Build** button shows what's being researched and how far along it is. The Build menu shows the full details.
- The 21 techs follow the general order of history, from Warrior Code, the Wheel and Masonry to Steam Power, Petroleum, Flight, Nuclear Fission and Nuclear Weapons. The next tech is picked from the earliest ones you can research, preferring the ones that use the resources you produce most. A tech that needs a resource you don't have is only picked first when no other tech makes sense.
- Gold you mine goes straight into research.

### 2. Build and Command
- **Build:** pick a building, then tap or click the map to place it. You can drag it around before tapping **Confirm** to build it.
- **Command:** click past your border to spend people on free land. If you click a nation within your troops' reach, the game asks whether to attack. Choose **Attack** to send your troops, or **No** to make your border stop at theirs. Click one of your own buildings to connect it to a road, build a wall or upgrade it.
- **Command menu:** also holds Attack, Expedition, Fire (with a choice of warhead), people and troop percentages, and a switch to turn troop training on or off.
- **Expeditions:** an expedition travels overland as a wagon and becomes a boat as soon as it reaches water, so it can always set out.

### 3. Roads and logistics
- **Roads** link the settlements of each domain automatically and for free. They're laid out with pathfinding, then smoothed, so they curve around hills and water the way real roads do.
- **Connecting buildings:** tap one of your buildings and choose **Connect to road** (costs a little stone). Anything not on a road still works, it just moves more slowly.
- **Fastest route:** everything travels faster on roads, and haulers and troops take whichever mix of road and open country gets them there quickest.
- **Harvests:** each collector fills a cart, which takes the load to the nearest settlement. The goods join the domain's stock (its hidden inventory) when the cart arrives.
- **Building:** a new building gets a turning gear and waits while its materials are carted out from the settlement nearest to it. If the domain is short, the rest is shipped in from your other domains first.
- **Between domains:** ports, rail stations and airports link separate domains. Goods, people and troops travel on them, and the caravan post is gone.
- **Vehicles change with tech:**
  - On land: a porter, then a handcart (the Wheel), a horse (Equestrianism), a carriage (Carriages) and finally a truck (Automobiles).
  - At sea: a rowboat, then a sailboat, a galleon and a steamship.
  - Roads go from dirt to stone to asphalt.

### 4. Military
- **Bases and fortresses:** military bases train people into units, which then march to fortresses. Both have a capacity that grows with tech, and training stops when everything is full.
- **Helmets:** troop counts show beside a pixel-art helmet that changes with your tech (leather, bronze, iron, steel, then modern). They appear in green below your population too.
- **Walls:** tap a fortress, choose **Build a wall…**, then tap another fortress within range and pay in stone. Walls make the land next to them much harder to take, and your troops can march along them.
- **Fortress defence:** fortresses make the land around them harder to take.
- **Attacking:** attacks draw on fortresses first. You can attack a nation even if your borders don't touch, as long as it's within reach. Reach grows with Equestrianism, Automobiles, Flight and Armored Warfare. Your troops cross the gap and take a foothold.

### 5. Resources, fuel and gold
- **Gold** isn't stored. What you mine each second speeds up research and troop training, and makes your troops slightly stronger (up to +20%).
- **Oil** appears with Petroleum. Trucks, planes, ships, motorized troops, tanks and oil power plants burn it. The oil counter shows your net gain or loss. A domain with no oil falls back to older tech: carriages instead of trucks, sail instead of steam, and grounded planes. With no oil anywhere, motorized troops fight as cavalry.
- **Uranium** appears with Nuclear Fission. It powers **nuclear reactors**, and with Nuclear Weapons your missile silos can carry a **nuclear warhead** (Command → Fire → Nuclear).
- **Wheat:** farms turn nearby plain land into fields, and the wheat is carted to your settlements like any other harvest. Without enough food your population stops growing, and if the stores run out it slowly shrinks.

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
| Right-click | Long-press, or Command → Expedition | Send an expedition (steer it, then Settle) |
| Click your building | Tap your building | Connect to road · build a wall · upgrade |
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
