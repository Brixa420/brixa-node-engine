# Brixa Node Engine

Distributed task execution node.

## Current Status: PoC / Design Document

This is a proof-of-concept architecture, not production infrastructure.

### What's Working (Validated)
- core/batch-optimizer.js - Batching (10K-100K txs/proof in simulation)
- core/pipeline.js - Pipeline architecture concept
- core/interfaces.js - API definitions (BatcherInput, ProofBundle, SettlementConfig)

### Aspirational (Requires Validation)
- core/horizontal-prover.js - Stub code, no live GPU network
- core/recursive-compressor.js - Stub code, no on-chain proofs
- core/sharded-settlement.js - Stub code, no running chains

### Realistic Throughput
- Current: ~5K TPS (local simulation)

### Production Would Require
- Live GPU proving network (100+ nodes in different datacenters)
- On-chain recursive proof verification (submit to testnet)
- Running multi-chain settlement infrastructure

## NOT a Blockchain

Brixa Node Engine is NOT a blockchain. It is chain-agnostic.
