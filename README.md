# Brixa Node Engine

Distributed task execution node.

## Works With

**Brixa Scaler** (brixa-scaler) - Network routing layer

## API Contract (with Scaler)

| Endpoint | Purpose |
|----------|---------|
| POST /task | Execute task, returns proof |
| GET /health | Node alive? |
| GET /capabilities | What can this node do? |
| GET /metrics | Statistics |

Response: task_id, status, result, node_id, execution_time_ms, proof_hash

## NOT a Blockchain

Brixa Node Engine is NOT a blockchain. It connects to any blockchain for settlement.
