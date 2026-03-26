# Brixa Node Engine

Distributed task execution node.

## Current Status: PoC / Design Document

### Working (Validated)
- `core/batch-optimizer.js` - Batching (11K txs)
- `core/pipeline.js` - Pipeline architecture
- `core/interfaces.js` - API definitions
- `core/gpu-prover.js` - Optimized with parallel CPU workers

### Benchmark Results (March 26, 2026)
- **Proving:** 43 proofs/sec (21x improvement from parallel workers)
- **Batching:** 11K txs/batch
- **Pipeline:** ~5K TPS

### Aspirational
- GPU proving (needs NVIDIA hardware for 20x more)

## NOT a Blockchain

Brixa Node Engine is NOT a blockchain. It is chain-agnostic.
