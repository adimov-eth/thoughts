# XLN Platform - v1.4.1-RC2

A programmable trust network implementing hierarchical autonomous state machines for cross-ledger interoperability.

[![Docs](https://img.shields.io/badge/docs-site-blue)](https://example.com)
[![Tests](https://img.shields.io/badge/tests-passing-green)](https://github.com/adimov-eth/thoughts/actions)
[![Version](https://img.shields.io/badge/version-1.4.1--RC2-orange)](docs/spec.md)

## Overview

XLN reimagines blockchain architecture through a Jurisdiction → Entity → Account model, replacing traditional Layer 2 solutions with hierarchical state machines that maintain local consensus while enabling global interoperability.

### Key Features

- **Pure Functional Architecture**: All protocol logic implemented as pure TypeScript functions
- **Hierarchical State Machines**: Server (routing) → Entity (business logic) → Account (bilateral state)
- **BLS Aggregate Signatures**: Efficient quorum-based consensus with threshold signatures
- **Deterministic Execution**: Same inputs always produce same outputs
- **RLP Encoding**: Canonical data serialization throughout

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.2.0 or higher
- Node.js v18+ (for some tooling)

### Installation

```bash
# Install dependencies
bun install

# Run tests
bun test

# Type checking
bun run typecheck

# Linting
bun run lint
```

### Development

```bash
# Run the development server
bun run src/index.ts

# Watch tests during development
bun run test:watch

# Generate documentation
bun run typedoc
mkdocs build
```

## Architecture

The XLN platform consists of several key components:

### Core Protocol (`src/core/`)

- **reducer.ts**: Entity state machine implementation with command processing
- **hash.ts**: Deterministic hashing functions (frame hash with R-1 fix)
- **types.ts**: Complete type definitions for v1.4.1-RC2 spec
- **consensus.ts**: Transaction ordering and consensus helpers
- **quorum.ts**: Quorum weight calculations and threshold checks

### Infrastructure (`src/infra/`)

- **runtime.ts**: Server runtime with I/O and persistence
- **storage.ts**: LevelDB persistence layer
- **decodeInbox.ts**: Message decoding (placeholder)

### Cryptography (`src/crypto/`)

- **bls.ts**: BLS12-381 signatures with sync/async verification
- **hash.ts**: Keccak256 and SHA256 implementations

## Protocol Specification

The complete XLN v1.4.1-RC2 specification is available in [docs/spec.md](docs/spec.md).

### Key Concepts

1. **Entities**: Autonomous state machines with business logic
2. **Quorums**: BLS-based consensus groups with weighted voting
3. **Frames**: Ordered transaction batches with deterministic execution
4. **Credit Lines**: Bilateral state channels between entities

### Transaction Flow

1. Client submits `Input` to server
2. Server routes to appropriate entity
3. Entity processes via `Command`
4. Consensus achieved through `Frame` proposals
5. `Hanko` (BLS aggregate signature) finalizes block

## Testing

The project includes comprehensive test coverage:

```bash
# Run all tests
bun test

# Run specific test files
bun test reducer.test.ts
bun test property.test.ts
bun test bls-signature-recovery.test.ts

# Generate coverage report
bun run test:coverage
```

### Test Categories

- **Unit Tests**: Core protocol logic and reducers
- **Property Tests**: Determinism and invariant checking
- **Integration Tests**: Full protocol flow validation

## Documentation

Detailed documentation is available in the `docs/` directory:

- [Architecture Overview](docs/architecture.md)
- [Data Model](docs/data-model.md)
- [Consensus Mechanism](docs/consensus.md)
- [API Reference](docs/api.md)
- [Migration Guide](docs/migration-v1.4.md)

Generate the full documentation site:

```bash
bun run typedoc
mkdocs serve
```

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes following conventional commits
4. Ensure all tests pass (`bun test`)
5. Submit a pull request

### Development Guidelines

- Maintain pure functional style
- Use TypeScript strict mode
- Follow existing code patterns
- Add tests for new features
- Update documentation as needed

## License

See [LICENSE](LICENSE) file for details.

## Resources

- [XLN Specification v1.4.1-RC2](docs/spec.md)
- [GitHub Repository](https://github.com/adimov-eth/thoughts)
- [Issue Tracker](https://github.com/adimov-eth/thoughts/issues)
