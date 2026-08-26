# Independent Guandan

This directory is a clean-room rewrite project for the Guandan game.

## Safety rule

The existing production application remains untouched. This project is developed and tested separately until it can replace the current Guandan implementation feature-by-feature.

## Clean-room rule

Implementation code in this directory must be written from behavioral requirements and game rules, not copied from the upstream Shengji implementation. The current fork may be consulted only to identify externally observable behavior that must remain compatible during migration.

## Initial product requirements

- Table sizes: 4, 6, 8, 10, 12, 14 players.
- Every player receives 27 cards.
- Before the first game, each player draws one non-joker card; unique highest card starts. Ties redraw.
- 1 to 3 robots may be selected before a 4–14 player game starts.
- Every automatic robot action must have a randomized human-like delay.
- All players see public plays and current participant names.
- Teams alternate by seat parity.
- Existing successful production behavior is the compatibility target, but the implementation must be new.

## Migration principle

1. Build independent core library.
2. Build independent protocol and room state.
3. Build independent backend.
4. Build independent frontend.
5. Run compatibility tests against the existing production behavior.
6. Deploy to a separate test environment.
7. Only after full verification, switch traffic.

This folder is only an incubation area inside the current repository. The final independent project must live in a new non-fork repository before it is considered fully separated.