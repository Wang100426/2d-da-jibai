# 2D大击败

Flask renders the pages and hero configuration. The free-roam map is written in TypeScript and compiled to `static/app.js`, which the Flask template loads.

## Run

```powershell
pip install -r requirements.txt
bun install
bun run build
python server_gui.py
```

The GUI starts the server on port `5000` and displays the LAN URL to share with other players. They must be on the same network and open that URL in a browser. To run without the GUI, use `python app.py`; it also binds to `0.0.0.0:5000`.

## Windows desktop release (1.0.5)

Install the Node dependencies and compile the clients:

```powershell
npm install
npm run dist:win
```

The build creates an isolated Python environment and packages Flask into the desktop app, so players do not need to install Python. The Windows x64 installer is written to `release-installer/`. To build a portable executable instead, use `npm run dist:portable`; it is written to `release-portable/`. Separate output folders prevent Electron's unpacked staging directories from conflicting between builds. The Electron desktop app bundles and starts its own Flask service, opens the game window, and shows the local-network multiplayer URL in the lobby. Keep the desktop app running while LAN guests are connected. Windows Firewall may ask permission for network access.

## Roguelike run

The battle map is a wave-based survival run. Enemies spawn in increasing numbers and gain health and damage as waves progress; clear a wave to pick one of three upgrades before the next begins. Grunts, fast runners, and heavy brutes have different stats. Basic attacks start at 2 hits per second; attack-speed upgrades add 0.25 hits per second, up to 3.5. Hero defense reduces incoming damage based on the selected fighter, and armor upgrades add up to 8 percentage points of damage reduction, capped at 60%. Other upgrades improve attack damage, lifesteal, dodge chance, health, energy regeneration, movement, or cooldowns. Lifesteal heals 10% of damage per upgrade and dodge adds 8% chance per upgrade; both cap at 60%. Killing enemies grants skill experience (grunts 10, runners 18, brutes 30); filling the experience bar pauses combat so one of the three hero skills can be selected for a minor upgrade. Each skill advances from rank 1 to 2 after three minor upgrades, then to rank 3 after four more, unlocking a skill-specific effect at each rank. Cooldown-reduction upgrades shorten ability cooldowns by 8% each, up to 40%.

The home page also has a one-on-one AI duel. Choose a hero and win four rounds before the opponent does; between rounds, choose a permanent run upgrade during a 10-second break. The AI selects a different hero and gains health, damage, and defense as rounds progress. AI basic attacks use the same defense reduction, while player basic attacks are rate-limited to the displayed attack speed.

The heroes now have distinct combat identities: the fighter dashes into the nearest enemy with an area stun, can empower a knockback basic attack, and has a damaging fixed-distance dash; the moss guardian roots groups, reflects damage while protected, and poisons enemies; the lunar mage fires ranged moonlight attacks, calls down an area meteor, pierces enemies with moon blades, and can dash while shielded; the tech fighter attacks from range, sends five tablets converging in an explosive slow, and leaves an afterimage while dashing forward and back three times. The afterimage dash grants invulnerability and damages and knocks back enemies along each dash path. His ultimate stuns nearby enemies and dashes in the movement direction.

Hits now create a colored burst of sparks and a glowing impact ring. The tech fighter's tablet convergence has an additional larger explosion effect.

LAN rooms synchronize player positions, PvP attack damage, health, energy, and crowd-control effects through the Flask server. The server checks attacker identity, attack range, skill cost/cooldowns, and invulnerability before applying damage. Tech's afterimage dash registers its invulnerability window with the room server. PvE enemy waves and roguelike upgrades remain local to each browser and are not shared.

Open `/multiplayer`, enter a nickname, create a room, and share its room code. The host starts the map after at least one other player joins.

The same TypeScript commands also work through npm: `npm install`, `npm run build`, and `npm run typecheck`.

## Map controls

- `WASD` or arrow keys: move.
- `Q`, `E`, `R`: cast the three selected hero skills.
- `Space`: basic attack a nearby enemy.
- Basic attacks are limited by the displayed attacks-per-second stat (2 per second by default).
- `F`: collect a nearby health or energy supply in roguelike mode.

The map HUD shows health, energy, collected supplies, skill cooldowns, and cast feedback. Enemy-targeted skills require a nearby target; failed casts explain whether the skill is cooling down, short on energy, or out of range.
In solo roguelike runs, pause and resume with `P` or `Esc`, or use the on-screen pause button. Pause is disabled in LAN multiplayer.

In a LAN room, players share the same map; player positions, PvP damage, health, energy, and crowd-control status are synchronized by the Flask server. Room membership and combat state are in memory and are cleared when the server stops.

## Frontend development

- Edit the map in `frontend/map.ts`.
- Edit the hero selection page in `frontend/select.ts`.
- Run `bun run typecheck` to check types without emitting files.
- Run `bun run build` to compile the TypeScript clients to `static/`.

`static/app.js`, `static/multiplayer.js`, and `static/select.js` are generated outputs; make changes in the corresponding `frontend/*.ts` source files.
