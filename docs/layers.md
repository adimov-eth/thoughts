# Layer map

| Layer | Pure? | Today | Security role | File |
|-------|------|-------|---------------|------|
| Server | ✔︎ | Batches inputs, seals frames | routes & seals | `src/core/server.ts` |
| Replica | ✔︎ | Holds signer state, runs FSM | consensus | `src/core/entity.ts` |
| Entity | ✔︎ | Quorum-based state machine | finality via Hanko | `src/core/entity.ts` |
| Adapters | ✘ | LevelDB, networking | side effects | n/a |

