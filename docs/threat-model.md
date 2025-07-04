# Threat model

| Threat                 | Defence                                                                |
| ---------------------- | ---------------------------------------------------------------------- |
| Forged frame           | BLS aggregate signature binds the frame hash to quorum power           |
| Replay old SIGN        | SignerRecord nonce increases every commit                              |
| Censorship by proposer | Any signer may PROPOSE if the mempool is non-empty                     |
| State fork             | Merkle root embedded in ServerFrame; divergence detected during replay |
