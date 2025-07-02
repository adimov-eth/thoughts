# Part 2: Rollups and Blockchain Scaling

This document contains a structured and improved transcript of a conversation about different types of rollups and their role in blockchain scaling.

## Key Concepts

*   **Optimistic Rollups:** Assume transactions are valid by default and only run computations in case of a dispute.
*   **Validity Rollups (ZK-Rollups):** Use cryptographic proofs (zero-knowledge proofs) to verify the validity of every transaction.
*   **Based Rollups:** A newer type of rollup where the sequencer is not a single entity but rather the base chain itself.

## Conversation Transcript

**Speaker 1:** In a based rollup, if you can easily compute the state, you just show the transaction and the memory slot, and the sequencer processes it. If not, you present the last block you saw and a chain of proofs without transactions. The rollup validates it. You only need to send hashes and the global state of the block, not the full details.

**Speaker 2:** Are we talking about optimistic or validity-based rollups?

**Speaker 1:** No, this is a "based" rollup. It's a new concept from last year. I believe Coinbase is using something similar.

**Speaker 2:** I've only heard of optimistic and validity rollups. I'll have to read up on based rollups.

**Speaker 1:** You should also check out RiseChain. They are currently in testnet and are implementing a based rollup.

**Speaker 2:** It seems none of the mainstream rollups are using this principle yet.

**Speaker 1:** The idea is to create a system that can be an alternative to things like Syfe and Aragon.
