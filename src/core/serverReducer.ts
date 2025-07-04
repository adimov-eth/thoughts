/**
 * Server reducer logic is implemented in reducer.ts as applyServerFrame
 * This file re-exports it for backward compatibility
 */

export { applyServerFrame as applyServerReducer } from "./reducer";
export type { ServerInput, ServerFrame, ServerState } from "../types";
