import pino from "pino";
import { addr, aggregate, pub, randomPriv, sign } from "../crypto/bls";
import { ILogger, makeLogger } from "../logging";
import type {
  EntityState,
  EntityTx,
  Input,
  Quorum,
  Replica,
  ServerState,
  ServerInput,
  Address,
} from "./types";
import { applyServerFrame } from "./reducer";

/* ──────────── deterministic key‑gen for demo ──────────── */
const PRIVS = [...Array(5)].map((_, i) => randomPriv());
const PUBS = PRIVS.map(pub);
const ADDRS = PUBS.map(addr);

/* ──────────── build initial replica (empty chat) ──────────── */
const genesis = (): Replica => {
  const quorum: Quorum = {
    threshold: 3n,
    members: ADDRS.map((a) => ({ address: a as Address, shares: 1n })),
  };
  const state: EntityState = {
    height: 0n,
    quorum,
    signerRecords: Object.fromEntries(ADDRS.map((a) => [a, { nonce: 0n }])),
    domainState: { chat: [] },
    mempool: [],
  };
  return { attached: true, state };
};

/* ──────────── runtime shell ──────────── */
export class Runtime {
  private state: ServerState = new Map();
  private frameId: number = 0;
  private log: ILogger;
  private pending: EntityTx[] = [];

  constructor(opts: { logLevel?: pino.Level } = {}) {
    this.log = makeLogger(
      opts.logLevel ?? (process.env.LOG_LEVEL as any) ?? "info",
    );
    /* IMPORT each signer‑replica */
    const base = genesis();
    ADDRS.forEach((a, i) => {
      const rep: Replica = {
        ...base,
        // Each signer gets their own replica
      };
      this.state.set(`${i}:chat`, rep);
    });
  }

  async tick(now: number, inc: Input[] = []) {
    this.log.debug("tick start", { frameId: this.frameId });
    const pendingInputs = this.pending.map((tx, i) => {
      // This is a placeholder for signer index
      const signerIdx = i % ADDRS.length;
      return [signerIdx, "chat", { type: "addTx", tx }] as Input;
    });
    this.pending = [];
    const inputs = inc.concat(pendingInputs);

    const batch: ServerInput = {
      inputId: crypto.randomUUID(),
      frameId: this.frameId++,
      timestamp: BigInt(now),
      inputs,
    };

    const { next, frame } = applyServerFrame(this.state, batch, () =>
      BigInt(now),
    );

    this.log.debug("server frame", {
      frameId: frame.frameId,
      root: frame.root,
    });
    if (frame) {
      this.log.info("commit", { height: frame.frameId, hash: frame.root });
    }

    this.state = next;
    return { frame };
  }

  injectClientTx(tx: EntityTx) {
    this.log.info("client tx", tx);
    this.pending.push(tx);
  }
}
