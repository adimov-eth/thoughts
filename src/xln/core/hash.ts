import { sha256 as _sha256 } from "@noble/hashes/sha256";

export const sha256 = (msg: Uint8Array): Uint8Array => _sha256(msg);
