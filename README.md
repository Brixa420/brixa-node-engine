# Brixa Node Engine

Distributed task execution node.

## Recent Updates

### Pipeline Architecture (March 26, 2026)
- Created `core/pipeline.js` - Overlaps Batch → Prove → Settle (not sequential)
- Created `core/batch-optimizer.js` - Increases txs/proof from 2,500 to 10K-100K
- Created `core/gpu-prover.js` - GPU acceleration detection (CUDA/OpenCL)
- Created `benchmarks/throughput-benchmark.js` - Performance testing

### Performance Improvements
- **Batching**: Dynamic sizing (10K-100K txs per proof)
- **Proving**: GPU support for 20x speedup (when available)
- **Pipeline**: Parallel stages instead of sequential

## Works With

**Brixa Scaler** (brixa-scaler) - Network routing layer

## API Contract

| Endpoint | Purpose |
|----------|---------|
| POST /task | Execute task, returns proof |
| GET /health | Node alive? |
| GET /capabilities | What can this node do? |
| GET /metrics | Statistics |

Response: task_id, status, result, node_id, execution_time_ms, proof_hash

## NOT a Blockchain

Brixa Node Engine is NOT a blockchain. It is chain-agnostic.
