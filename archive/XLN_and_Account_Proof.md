# Part 1: XLN and Account-Proof

This document contains a structured and improved transcript of a conversation about XLN, a Layer 2 scaling solution, and the concept of "account-proof."

## Key Concepts

*   **Account-Proof:** A versioned data structure associated with each user, containing "sub-contracts." It avoids the need to deploy contracts to the mainchain for every interaction.
*   **Sub-Contracts:** A new type of smart contract that doesn't require deployment on the mainchain, reducing transaction costs.
*   **Jurisdictional Machine:** The main blockchain (e.g., Ethereum).
*   **Channels:** Isolated, two-party communication channels for transactions, similar to the Lightning Network.
*   **Hubs:** Central entities responsible for rebalancing and ensuring liquidity within the system.
*   **Inforce Depths:** A mechanism to settle debts when funds touch a hub's reserve balance.

## Conversation Transcript

**Speaker 1:** The core idea is to move away from a single shared-state machine, which is what I believe makes LegacyFi a dead-end. Rollups are just another layer of the same shared-state concept. Instead, we should be building on top of GPUs, using many small, logically isolated channels.

**Speaker 2:** How do you connect these isolated channels?

**Speaker 1:** Let's say I want to transact with Tinkoff Bank. We would have a sub-contract within our respective account-proofs. This sub-contract guarantees that if a dispute arises, we can take it to the jurisdictional machine. It's similar to a rollup, but it's only between two parties, not a shared state for everyone.

**Speaker 2:** So, if I understand correctly, you have a sort of interbank network on a full EVM, and the settlement with a specific bank is handled through these channels, almost like colored coins in Bitcoin?

**Speaker 1:** Not exactly like Bitcoin, it's all EVM-based. You have locked tokens in the channel, which act as security.

**Speaker 2:** What happens if a bank or a hub goes offline?

**Speaker 1:** If a bank stops responding, you can initiate a dispute. They are required to have reserves. The hubs are responsible for rebalancing every 10-20 minutes. They batch signatures from channels where they've gained collateral and move it to channels where they've made promises.

**Speaker 2:** So, if Coinbase, for example, were to "rug pull," would I get my money back?

**Speaker 1:** If you've enforced your account-proof, you are guaranteed to get your funds back, unless there's a complete exit scam. There is still counterparty risk, similar to the FTX situation. However, with an account-proof system, you as a user have more control over your collateral. You can demand 100% insurance, which would cost a bit more, but it would be an option.
