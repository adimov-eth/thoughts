# Data flow

1. Client sends an `ADD_TX` input referencing the Entity.
2. Server routes it to the signer replica and triggers `PROPOSE`.
3. The replica executes the draft frame via `applyCommand()`.
4. Once enough `SIGN` packets arrive the server aggregates them into a `Hanko` and broadcasts `COMMIT`.
5. Replicas verify the aggregate signature and update their last committed frame.

Code path: [`draft/server.ts`](../draft/server.ts) → [`draft/entity.ts`](../draft/entity.ts) → [`draft/codec.ts`](../draft/codec.ts).
