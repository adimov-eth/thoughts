# XLN Platform Documentation - v1.4.1-RC2

Welcome to the XLN platform documentation. This site provides comprehensive information about the XLN programmable trust network, including architecture overviews, specifications, and API references.

## Core Documentation

- [**XLN Specification v1.4.1-RC2**](spec.md) - Complete protocol specification
- [Architecture Overview](architecture.md) - System design and components
- [Data Model](data-model.md) - Type definitions and encoding
- [Consensus Mechanism](consensus.md) - Frame/Hanko consensus protocol
- [Migration Guide v1.4](migration-v1.4.md) - Upgrade from v1.3 to v1.4.1-RC2

## Technical Details

- [Layer Architecture](layers.md) - Hierarchical system layers
- [Data Flow](data-flow.md) - Transaction processing pipeline
- [Walkthrough](walkthrough.md) - Step-by-step chat example
- [Threat Model](threat-model.md) - Security considerations

## API Documentation

- [API Reference](api/index.html) - Generated TypeDoc documentation
- [Protocol Types](api/modules/core_types.html) - Core type definitions
- [Reducer Functions](api/modules/core_reducer.html) - State machine logic

## Quick Links

- [GitHub Repository](https://github.com/adimov-eth/thoughts)
- [Issue Tracker](https://github.com/adimov-eth/thoughts/issues)
- [Pull Requests](https://github.com/adimov-eth/thoughts/pulls)

## Getting Started

```bash
# Install dependencies
bun install

# Run tests
bun test

# Start development server
bun run src/index.ts
```

For detailed setup instructions, see the [README](../README.md).
