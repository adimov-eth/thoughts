import {
  Replica, Stage, Command, EntityState, Frame, ProposedFrame,
  TxKind, Transaction,
} from './schema';
import { hash } from './crypto';

export function applyTx(st: EntityState, tx: Transaction, ts: number): EntityState {
  if (tx.kind === TxKind.Chat) {
    const nonce = st.nonces[tx.from] ?? 0n;
    if (tx.nonce !== nonce) throw new Error('bad-nonce');
    return {
      ...st,
      nonces: { ...st.nonces, [tx.from]: nonce + 1n },
      chat  : [...st.chat, { from: tx.from, msg: tx.body.message, ts }],
    };
  }
  /* future kinds … */
  throw new Error('unk-txkind');
}

export function execFrame(prev: Frame<EntityState>, txs: Transaction[], ts: number): Frame<EntityState> {
  let state = prev.state;
  for (const tx of txs) state = applyTx(state, tx, ts);
  return { height: prev.height + 1n, ts, txs, state };
}

/* ——————————————————————————————————————————————————————— */
export function applyCommand(rep: Replica, cmd: Command): Replica {
  switch (cmd.type) {
    case 'ADD_TX':
      return { ...rep, mempool: [...rep.mempool, cmd.tx] };

    case 'PROPOSE': {
      if (rep.stage !== Stage.Ready || rep.mempool.length === 0) return rep;
      const frame = execFrame(rep.last, rep.mempool, Date.now());
      const sigs  = new Map([[rep.proposer, '0x00']]); // proposer self-sig to be filled by server
      return { ...rep,
        stage: Stage.Awaiting,
        mempool: [],
        proposal: { ...frame, sigs },
      };
    }

    /* —— SIGN : attach sig to proposal —— */
    case 'SIGN': {
      if (rep.stage !== Stage.Awaiting || !rep.proposal) return rep;
      const sigs = new Map(rep.proposal.sigs);
      sigs.set(cmd.signer, cmd.sig);
      return { ...rep, proposal: { ...rep.proposal, sigs } };
    }

    /* —— COMMIT : accept already-executed frame —— */
    case 'COMMIT':
      return { ...rep, stage: Stage.Ready,
               last: cmd.frame, proposal: undefined };

    default: return rep;
  }
}
