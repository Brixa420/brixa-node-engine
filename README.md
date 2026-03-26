# Brixa Node Engine

Distributed task execution node.

## Recent Updates (March 26, 2026)

### Critical Interfaces
- `core/interfaces.js` - Standardized API between layers

#### 1. Transaction Ingestion (BatcherInput)
Any tx format accepted:
- txData: Opaque payload (any format)
- intent: "payment" | "compute" | "storage" (for sharding)
- priority: Ordering hint (0-100)

#### 2. Proof Output (ProofBundle)
Standardized proof package - any settlement layer verifies:
- merkleRoot, proof (SNARK/STARK), publicInputs, metadata
- Hardware info: "cpu" | "cuda" | "opencl"

#### 3. Settlement Config (SettlementConfig)
Configurable finality:
- mode: "time" | "batchSize" | "manual"
- destination: "ethereum" | "polygon" | "custom" | "none"
- compression: "none" | "recursive" | "aggregate"

Presets: fast, balanced, secure, throughput

## Works With

**Brixa Scaler** (brixa-scaler) - Network routing layer

## NOT a Blockchain

Brixa Node Engine is NOT a blockchain. It is chain-agnostic.
