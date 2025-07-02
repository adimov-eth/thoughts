import { Input, Replica, Command, addrKey, Quorum, Hanko } from './types';
import { randomPriv, pub, addr, sign, aggregate } from './crypto';
import { applyCommand, powerCollected, hashFrame } from './state';

export class Server {
  /* deterministic 3‑signer dev wallet */
  signers = Array.from({ length: 3 }, () => {
    const priv = randomPriv();
    return { priv, pub: pub(priv), addr: addr(pub(priv)) };
  });

  replicas = new Map<string, Replica>();   // key = addrKey(rep.address)
  inbox: Input[] = [];

  enqueue(e: Input) { this.inbox.push(e); }

  async tick() {
    const tickTs = Date.now();

    while (this.inbox.length) {
      const { cmd } = this.inbox.shift()!;

      /* ——— IMPORT ——— */
      if (cmd.type === 'IMPORT') {
        const baseReplica = cmd.replica;
        const entityKey   = addrKey(baseReplica.address);
        for (const m of Object.keys(baseReplica.last.state.quorum.members)) {
          const rep: Replica = { ...baseReplica, proposer: m };
          this.replicas.set(entityKey + ':' + m, rep); // replica keyed by signer
        }
        continue;
      }

      // route ADD_TX by tx.sender → correct signer replica
      const signerPart =
        cmd.type === 'ADD_TX' ? cmd.tx.from :
        cmd.type === 'SIGN'   ? cmd.signer   : '';
      const key = cmd.addrKey + ':' + signerPart;
      const r   = this.replicas.get(key) || [...this.replicas.values()][0];
      if (!r) continue;

      /* ——— entity logic ——— */
      const next = applyCommand(r, cmd);
      this.replicas.set(key, next);

      /* ——— post‑effects ——— */
      // 1. After PROPOSE → multicast SIGN requests
      if (cmd.type === 'PROPOSE' && next.proposal && !r.proposal) {
        const { proposal } = next;
        for (const s of this.signers) {
          if (!next.last.state.quorum.members[s.addr]) continue;
          if (s.addr === next.proposer) continue; // proposer already “signed”

          const sig = await sign(
            Buffer.from(proposal.hash.slice(2), 'hex'),
            s.priv,
          );

          this.enqueue({
            from: s.addr, to: next.proposer,
            cmd : {
              type     : 'SIGN',
              addrKey  : cmd.addrKey,
              signer   : s.addr,
              frameHash: proposal.hash,
              sig,
            },
          });
        }
      }

      // 2. After SIGN → if threshold reached, broadcast COMMIT
      if (cmd.type === 'SIGN' && next.proposal && next.isAwaitingSignatures) {
        const q = next.last.state.quorum;
        const oldP = r.proposal ? powerCollected(r.proposal.sigs, q) : 0;
        const newP = powerCollected(next.proposal.sigs, q);

        if (oldP < q.threshold && newP >= q.threshold) {
          const hanko: Hanko = aggregate([...next.proposal.sigs.values()]);
          const frame       = { ...next.proposal };

          // strip proposal‑only fields
          delete (frame as any).sigs;
          delete (frame as any).hash;

          for (const m of Object.keys(q.members)) {
            this.enqueue({
              from: next.proposer, to: m,
              cmd : { type: 'COMMIT', addrKey: cmd.addrKey, hanko, frame },
            });
          }
        }
      }

      // proposer self‑trigger
      if (cmd.type === 'ADD_TX' && !next.isAwaitingSignatures && next.mempool.length) {
        this.enqueue({
          from: r.proposer, to: r.proposer,
          cmd : { type:'PROPOSE', addrKey: cmd.addrKey, ts: tickTs },
        });
      }
    }
  }
}
