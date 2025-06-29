interface Input {
    from: string;
    to: string;
    command: {
      type: string;
      data: any;
    };
  }



  export interface Input {
    /** “importEntity” seeds a brand‑new replica with a fully‑formed genesis frame */
    importEntity?: {
      signerIndex: number;
      entityId: string;
      genesis: Frame;
    };
  
    /** Add one or many L2 transactions into the replica mempool */
    addTransactions?: {
      signerIndex: number;
      entityId: string;
      txs: Transaction[];
    };
  
    /** Proposer builds the *next* frame (header, tx list, interim state) */
    proposeFrame?: {
      signerIndex: number;
      entityId: string;
      next: Omit<Frame, 'stateHash'>; // hash filled by replica
    };
  
    /** Any quorum member can attach a signature to the proposed frame‑hash */
    signFrame?: {
      signerIndex: number;
      entityId: string;
      frameHash: Bytes32;
      sig: Bytes32;
    };

    commitFrame?: {
      signerIndex: number;
      entityId: string;
      frameHash: Bytes32;
    };

  }

  export type ChatTx = Readonly<{
    kind: 'chat';
    from: Address;                       // recoverable from signature, kept for UX
    message: string;
    nonce: number;
    signature: Bytes32;
  }>;