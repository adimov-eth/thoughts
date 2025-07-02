import { applyConsensus, Command } from './consensus.js';
import { route, RouterState, InboxInput, OutMsg } from './router.js';
import { EntityId } from '../types/brands.js';

export interface ServerState {
  readonly router: RouterState;
  readonly entities: Map<EntityId, ReturnType<typeof initEntity>>;
}

// Placeholder for entity initialization
export function initEntity(id: EntityId) {
  return {} as any;
}

export function applyServerFrame(
  state: ServerState,
  batch: readonly (Command | InboxInput)[]
): ServerState {
  let nextRouter = state.router;
  const entities = new Map(state.entities);

  const routedCmds: { ent: EntityId; cmd: Command }[] = [];
  for (const inb of batch) {
    if ((inb as any).type) {
      const ic = inb as Command;
      routedCmds.push({ ent: (ic as any).entity as EntityId, cmd: ic });
      continue;
    }
    const cmd = decodeInbox((inb as InboxInput).payload);
    routedCmds.push({ ent: inb.to, cmd });
  }

  const aggregateOutbox: OutMsg[] = [];
  for (const { ent, cmd } of routedCmds) {
    const root = entities.get(ent);
    if (!root) throw new Error('unknown entity');
    const { next, outbox } = applyConsensus(root as any, cmd);
    entities.set(ent, next as any);
    aggregateOutbox.push(...outbox);
  }

  const { nextRouter: r2 } = route(nextRouter, aggregateOutbox, {
    hasEntity: (id) => entities.has(id),
  });

  return { router: r2, entities };
}

function decodeInbox(b: Uint8Array): Command {
  throw new Error('not implemented');
}
