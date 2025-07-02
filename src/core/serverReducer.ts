import { applyConsensus, Command, EntityRoot } from './consensus.js';
import { route, RouterState, InboxInput, OutMsg } from './router.js';
import { EntityId } from '../types/brands.js';

export interface ServerState {
  readonly router: RouterState;
  readonly entities: Map<EntityId, EntityRoot>;
}

/** One deterministic tick: apply batch → route outbox */
export function applyServerFrame (
  state: ServerState,
  batch: readonly (Command | InboxInput)[],
): ServerState {

  let nextRouter = state.router;
  const entities = new Map(state.entities);

  /* ---------- phase 1: handle inbox for each entity ---------- */
  const routedCmds: { ent: EntityId; cmd: Command }[] = [];

  for (const inb of batch) {
    if ('type' in inb) {                // a Command from API
      // For this implementation, we need to extract entity from command
      // This is a simplified approach - in real implementation, 
      // commands would include entity targeting
      const entityIds = Array.from(entities.keys());
      if (entityIds.length > 0) {
        routedCmds.push({ ent: entityIds[0], cmd: inb });
      }
      continue;
    }
    // inbox input coming from router
    const cmd = decodeInbox(inb.payload);
    routedCmds.push({ ent: inb.to, cmd });
  }

  /* ---------- phase 2: consensus reducers ---------- */
  const aggregateOutbox: OutMsg[] = [];

  for (const { ent, cmd } of routedCmds) {
    const root = entities.get(ent);
    if (!root) throw new Error('unknown entity');
    const { next, outbox } = applyConsensus(root, cmd);
    entities.set(ent, next);
    aggregateOutbox.push(...outbox);
  }

  /* ---------- phase 3: route emitted messages ---------- */
  const { nextRouter: r2 } = route(
    nextRouter,
    aggregateOutbox,
    { hasEntity: id => entities.has(id) }
  );

  return { router: r2, entities };
}

const decodeInbox = (b: Uint8Array): Command => {
  /* … real decoder here … */
  throw new Error('not implemented');
};