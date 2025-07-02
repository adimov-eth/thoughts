# Layer map

| Layer | Pure? | Today | Security role | File |
|-------|------|-------|---------------|------|
| Server | ✔︎ | Batches inputs, seals frames | routes & seals | `draft/server.ts` |
| Replica | ✔︎ | Holds signer state, runs FSM | consensus | `draft/entity.ts` |
| Entity | ✔︎ | Quorum-based state machine | finality via Hanko | `draft/entity.ts` |
| Adapters | ✘ | LevelDB, networking | side effects | n/a |

