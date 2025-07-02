// Generic phantom‑brand helper
export type Brand<Base, Tag extends string> = Base & { readonly __brand: Tag };

export type EntityId     = Brand<string, 'EntityId'>;
export type SignerId     = Brand<string, 'SignerId'>;
export type FrameHeight  = Brand<number, 'FrameHeight'>;
export type TxNonce      = Brand<number, 'TxNonce'>;

// Tiny helpers (compile‑time only, zero runtime cost)
export const asEntityId = (s: string) => s as EntityId;
export const asSignerId = (s: string) => s as SignerId;