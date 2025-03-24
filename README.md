# polyfight.io

A fully complete Diep.io clone with clans, a 1v1 system, ELO, and other mechanics, written in Rust and TypeScript.

## How to play?

https://polyfight.io/

## Mechanics/Features
- Auto Level Up (press K)
- Vast number of tanks (tank wheel will be implemented soon)
- Inbuilt Chat (Press Enter to open)
- Clans in FFA (Social button ingame)
    - Everyone in their own clan is invulnerable to damage from others in the clan.
    - Signal for help by clicking on the minimap.
    - 5 second headstart if leaving/kicked from a clan.
- Inbuilt Theme Support (Settings)
- Public/Private Sandboxes
     - Clans can be used to form teams.
     - Last Man Standing mode in settings.
- 1v1 System
     - Team Setup: Pick a team of 6 tanks with unique stat builds. Access team editing via the 1v1 menu.
     - Match Start: After both players check "ready," they are teleported to opposite corners. The 1v1 starts automatically after 120 seconds if players aren't ready.
      - Tanks and Rounds: Upon death, switch to the next tank in your team. The match is lost when all 6 tanks are used up.
      - Lose ELO in a category (Fighter, Destroyer, Drone, Spammer, Smasher, etc.) each time a tank dies. Gain ELO for winning a round. Check your and other players' ELO.
      - Stats: Access individual and worldwide stats via buttons on the homepage.