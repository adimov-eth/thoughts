import { EntityId } from '../types/brands.js';

/** Message emitted by reducers */
export interface OutMsg {
  readonly from: EntityId;
  readonly to:   EntityId;
  readonly seq:  number;
  readonly payload: Uint8Array;
}

/** Minimal input that the server understands */
export interface InboxInput {
  readonly to: EntityId;
  readonly payload: Uint8Array;
}

/** Router keeps a monotonic queue; no side‑effects */
export interface RouterState {
  readonly queue: readonly OutMsg[];
}

/**
 * Route newly‑emitted messages and deliver everything
 * whose `to` entity already exists locally.
 */
export function route (
  state: RouterState,
  emitted: readonly OutMsg[],
  opts: { hasEntity: (id: EntityId) => boolean }
): { nextRouter: RouterState; inboxBatch: readonly InboxInput[] } {

  // 1️⃣  merge & sort deterministically
  const merged = [...state.queue, ...emitted]
    .sort((a, b) =>
      a.from === b.from ? a.seq - b.seq : a.from.localeCompare(b.from));

  // 2️⃣  split deliverable vs remote
  const deliver: InboxInput[] = [];
  const remain: OutMsg[] = [];
  for (const m of merged) {
    (opts.hasEntity(m.to) ? deliver : remain).push(m);
  }

  return { nextRouter: { queue: remain }, inboxBatch: deliver };
}

/** Convenience ctor for an empty router */
export const initRouter = (): RouterState => ({ queue: [] });