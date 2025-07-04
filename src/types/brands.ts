// Generic phantom-brand helper
export type Brand<Base, Tag extends string> = Base & { readonly __brand: Tag };

export type EntityId = Brand<string, "EntityId">;
export type SignerId = Brand<string, "SignerId">;
export type FrameHeight = Brand<bigint, "FrameHeight">;
export type TxNonce = Brand<number, "TxNonce">;

export const asEntityId = (s: string): EntityId => s as EntityId;
export const asSignerId = (s: string): SignerId => s as SignerId;
export const asHeight = (n: bigint): FrameHeight => n as FrameHeight;
