# Brixa Node Engine

Distributed task execution node for the Brixa network.

## Works With

**Brixa Scaler** - Network routing layer

The Node Engine and Scaler communicate via a strict API contract.

## API Contract

### POST /task
Request: {"task_id": "uuid", "type": "dm|world|quest|ai", "payload": {}}
Response: {"task_id", "status", "result", "node_id", "execution_time_ms", "proof_hash"}

### GET /health - Node health status
### GET /capabilities - Node capabilities
### GET /metrics - Node statistics
