import { randomUUID } from 'crypto'
export type Uuid = () => string
export const uuid: Uuid = () => randomUUID()
