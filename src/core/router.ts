import { EntityId } from '../types/brands.js';

export interface OutMsg {
  readonly from: EntityId;
  readonly to: EntityId;
  readonly seq: bigint;
  readonly payload: Uint8Array;
}

export interface InboxInput {
  readonly to: EntityId;
  readonly payload: Uint8Array;
}

export interface RouterState {
  readonly queue: readonly OutMsg[]; // sorted by (from,seq)
}

export function initRouter(): RouterState {
  return { queue: [] };
}

export function route(
  state: RouterState,
  newMsgs: readonly OutMsg[],
  opts: { hasEntity: (id: EntityId) => boolean }
): { nextRouter: RouterState; inbox: readonly InboxInput[] } {
  if (newMsgs.length === 0) return { nextRouter: state, inbox: [] };

  const sorted = [...newMsgs].sort(bySenderSeq);

  const merged: OutMsg[] = [];
  const a = state.queue;
  const b = sorted;
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    merged.push(bySenderSeq(a[i], b[j]) <= 0 ? a[i++] : b[j++]);
  }
  merged.push(...a.slice(i), ...b.slice(j));

  const uniq: OutMsg[] = [];
  let prevKey = '';
  for (const m of merged) {
    const key = `${m.from}:${m.seq}`;
    if (key === prevKey) continue;
    uniq.push(m);
    prevKey = key;
  }

  const deliver: InboxInput[] = [];
  const stay: OutMsg[] = [];
  for (const m of uniq) {
    (opts.hasEntity(m.to) ? deliver : stay).push({ to: m.to, payload: m.payload });
  }

  return { nextRouter: { queue: stay }, inbox: deliver };
}

const bySenderSeq = (a: OutMsg, b: OutMsg) =>
  a.from === b.from ? (a.seq < b.seq ? -1 : a.seq > b.seq ? 1 : 0)
                    : a.from < b.from ? -1 : 1;
