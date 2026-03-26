# Brixa Node Engine

Distributed task execution node for the Brixa Blockchain.

## The Architecture

**Brixa = The Scaler IS The Blockchain**

Brixa isnt a "scaler" sitting on top of slow chains - its a standalone fast blockchain built from scratch.

## Works With

**Brixa Chain** (brixa-scaler) - The blockchain that IS the scaler

## Why This Matters

- Traditional chains: "All nodes do everything, hope its fast"
- Brixa: "Split work across cores, prove its correct"

## API Contract

- POST /task - Execute task, returns proof
- GET /health - Node alive?
- GET /capabilities - What can this node do?
- GET /metrics - Statistics

Response: task_id, status, result, node_id, execution_time_ms, proof_hash
