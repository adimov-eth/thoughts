# XLN DAO Architecture - Final Vision

## Core Terminology

### Consensus Layer
- **Proposal** - Block proposal containing transactions
- **Approve** - Vote to accept a block proposal  
- **Commit** - Finalize block after quorum reached
- **Proposer** - Designated signer who creates blocks

### DAO Governance Layer
- **Initiative** - Governance item that DAO members vote on
- **Vote** - Member's support or opposition to an initiative
- **Execute** - Apply passed initiative's transactions

### Data Flow
- **Input** - Command routed to entity (EntityCommand)
- **Transaction** - Atomic business operation (EntityTx)
- **Block** - Durable batch of transactions with consensus
- **Action** - Pure function that mutates state

## Architecture Principles

### 1. Unified Entity Model
Single-signer and multi-signer entities use the **same flow**:
```
Mempool → Block Creation → Consensus → Execution
```
The only difference is consensus requirements:
- **Single-signer**: Auto-approved blocks
- **Multi-signer**: Requires quorum approval

### 2. No Separate Action Queue
- Transactions go directly to mempool
- Block consensus IS the approval mechanism
- No two-stage voting process needed

### 3. DAO Initiatives
For governance decisions, DAOs use **initiatives**:
```typescript
type Initiative = {
  id: string;
  title: string;
  description: string;
  author: SignerIdx;
  actions: EntityTx[];        // Txs to execute if passed
  votes: Map<SignerIdx, boolean>;
  status: 'active' | 'passed' | 'rejected' | 'executed';
}
```

### 4. Clear Separation
- **State** = Consensus state (what's agreed upon)
- **Storage** = Full machine data (everything inside)
- **Server** = Pure router, no business logic
- **Entity** = Where all business logic lives

## Transaction Flow

```
1. User submits Input
   └─> ServerTx { signer, entityId, command }

2. Server routes to Entity
   └─> EntityCommand (addTx, proposeBlock, etc.)

3. Entity processes command
   └─> Transaction added to mempool

4. Block proposed (single or multi-sig)
   └─> ProposedBlock { txs, hash, approvals }

5. Consensus reached
   └─> Block committed

6. Transactions execute
   └─> Actions (pure functions) mutate state
```

## DAO Governance Flow

```
1. Member creates initiative
   └─> { op: 'createInitiative', data: { initiative } }

2. Members vote on initiative  
   └─> { op: 'voteInitiative', data: { id, support } }

3. Initiative passes (threshold met)
   └─> Status changes to 'passed'

4. Execute initiative
   └─> { op: 'executeInitiative', data: { id } }
   └─> Adds initiative's transactions to mempool

5. Normal block consensus
   └─> Transactions execute through standard flow
```

## Server Tick Model

Each 100ms tick:
```typescript
// 1. Current inbox = mempool
const inbox = server.mempool;

// 2. Clear for next tick  
server.mempool = [];

// 3. Process all messages
for (const msg of inbox) {
  // Process generates outbox messages
}

// 4. Outbox messages go to NEXT tick's mempool
// No recursive processing in same tick
```

## Message Routing

Outbox messages are routed based on quorum:
- **Specific signer**: Route to that signer only
- **No signer specified**: Route to ALL quorum members
- Server doesn't know it's sending to itself (pure simulation)

## Benefits of This Architecture

1. **Simplicity**: One flow for all entity types
2. **Flexibility**: Initiatives separate from consensus  
3. **Auditability**: Complete history in blocks
4. **Efficiency**: No duplicate approval mechanisms
5. **Clarity**: Clean terminology separation

## Implementation Priorities

1. ✅ Block consensus for multi-sig entities
2. ✅ Wallet protocol with transfers
3. ⏳ Initiative system for DAO governance
4. ⏳ Execute initiative → mempool flow
5. ⏳ Vote tracking and thresholds
6. ⏳ Initiative status management

This architecture treats DAOs as first-class state machines with proper governance, while keeping the core consensus mechanism simple and unified across all entity types.
