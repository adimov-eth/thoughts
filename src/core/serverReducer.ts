import { applyConsensus, Command } from './consensus.js';
import { route, RouterState, InboxInput, OutMsg } from './router.js';
import { EntityId } from '../types/brands.js';
import * as rlp from 'rlp';

export interface ServerState {
  readonly router: RouterState;
  readonly entities: Map<EntityId, ReturnType<typeof initEntity>>;
}

// Placeholder for entity initialization
export function initEntity(id: EntityId) {
  return {
    id,
    quorum: { members: [], pubKeys: {}, threshold: 1 },
    votes: new Map(),
  };
}

export function applyServerFrame(
  state: ServerState,
  batch: readonly (Command | InboxInput)[]
): ServerState {
  let nextRouter = state.router;
  const entities = new Map(state.entities);

  const routedCmds: { ent: EntityId; cmd: Command }[] = [];
  for (const inb of batch) {
    if ('type' in (inb as Command)) {
      const ic = inb as Command & { entity: EntityId };
      routedCmds.push({ ent: ic.entity, cmd: ic });
      continue;
    }
    const ii = inb as InboxInput;
    const cmd = decodeInbox(ii.payload);
    routedCmds.push({ ent: ii.to, cmd });
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
  const [aggSig, aggPub] = rlp.decode(Buffer.from(b)) as Buffer[];
  return {
    type: 'COMMIT_FRAME',
    aggSig: new Uint8Array(aggSig),
    aggPub: new Uint8Array(aggPub),
  };
}
