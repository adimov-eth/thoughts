import {
  Envelope, Replica, Command, Stage, Frame, EntityState, Quorum, TxKind,
} from './schema';
import { randomPriv, pub, addr, hash, sign, verify } from './crypto';
import { applyCommand, execFrame } from './state';

export class Server {
  /* deterministic 3-signer wallet */
  signers = Array.from({ length: 3 }, () => {
    const priv = randomPriv();
    return { priv, pub: pub(priv), addr: addr(pub(priv)) };
  });

  replicas = new Map<string, Replica>();            // entityId → replica
  inbox: Envelope[] = [];

  enqueue(e: Envelope) { this.inbox.push(e); }

  private clampTs(ms: number) { return Math.floor(ms / 1000) * 1000; }

  /** one tick */
  async tick() {
    while (this.inbox.length) {
      const env = this.inbox.shift()!;
      const { cmd } = env;

      /* ——— IMPORT handled immediately ——— */
      if (cmd.type === 'IMPORT') { this.replicas.set(cmd.replica.id, cmd.replica); continue; }

      /* ——— SIGN_REQ : produce a SIGN ——— */
      if (cmd.type === 'SIGN_REQ') {
        const r = this.replicas.get(cmd.entityId)!;
        if (!r.proposal) continue;
        const signer = this.signers.find(s => s.addr === env.to)!;
        const sig    = await sign(hash(r.proposal), signer.priv);
        this.enqueue({
          from: signer.addr, to: r.proposer,
          cmd : { type:'SIGN',
                  entityId : r.id,
                  signer   : signer.addr,
                  frameHash: cmd.frameHash,
                  sig }});
        continue;
      }

      /* ——— everything else is entity logic ——— */
      const r = this.replicas.get(cmd.entityId)!;
      const next = applyCommand(r, cmd);

      /* → after PROPOSE send SIGN_REQs */
      if (cmd.type === 'PROPOSE' && next.proposal) {
        const proposer = this.signers.find(s => s.addr === next.proposer)!;
        for (const m of next.quorum.members) {
          if (m.address === proposer.addr) continue;
          this.enqueue({
            from: proposer.addr, to: m.address,
            cmd : { type:'SIGN_REQ', entityId: next.id,
                    frameHash: addr(hash(next.proposal) as any) }});
        }
      }

      /* → threshold reached?  broadcast COMMIT */
      if (next.proposal && next.stage === Stage.Awaiting) {
        const power = next.quorum.members
          .filter(m => next.proposal!.sigs.has(m.address))
          .reduce((s, m) => s + m.shares, 0);
        if (power >= next.quorum.threshold) {
          const committed = { ...next.proposal };
          this.enqueue({
            from: next.proposer, to: next.address,
            cmd : { type:'COMMIT', entityId: next.id, frame: committed }});
        }
      }
      this.replicas.set(next.id, next);
    }
  }
}

/* TODO(persistence): snapshot every N frames - out of scope now              */
