import type { EntityTx, Address } from "../../src/core/types";
import { keccak_256 as keccak } from "@noble/hashes/sha3";

export const createChatTx = (
  sender: Address,
  msg: string,
  nonce: bigint = 1n,
): EntityTx => ({
  kind: "chat",
  data: { message: msg },
  nonce,
  from: sender,
  sig: sender + "00", // Mock signature - first 42 chars are the sender address
});
