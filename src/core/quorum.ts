import type { Address, Quorum } from "../types";

/**
 * Calculate the voting power of a specific address in the quorum
 */
export const sharesOf = (address: Address, quorum: Quorum): bigint => {
  const member = quorum.members.find((m) => m.address === address);
  return member ? member.shares : 0n;
};

/**
 * Calculate total voting power from a set of signatures
 */
export const totalPower = (
  signers: Address[] | Set<Address>,
  quorum: Quorum,
): bigint => {
  const signerSet = signers instanceof Set ? signers : new Set(signers);
  return quorum.members.reduce(
    (sum, member) =>
      signerSet.has(member.address) ? sum + member.shares : sum,
    0n,
  );
};

/**
 * Check if the provided signatures meet the quorum threshold
 */
export const hasQuorum = (
  signers: Address[] | Set<Address>,
  quorum: Quorum,
): boolean => {
  return totalPower(signers, quorum) >= quorum.threshold;
};

/**
 * Calculate the effective weight of signatures against a quorum
 */
export const effectiveWeight = (
  sigs: Record<Address, string>,
  quorum: Quorum,
): bigint => {
  const signerAddresses = Object.keys(sigs) as Address[];
  return totalPower(signerAddresses, quorum);
};
