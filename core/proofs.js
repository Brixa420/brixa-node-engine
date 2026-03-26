/**
 * Execution Proofs & Receipts
 * Provides cryptographic proof that a task was executed
 */
const crypto = require('crypto');

class ExecutionProof {
    constructor(nodeId) {
        this.nodeId = nodeId;
    }

    /**
     * Generate deterministic hash for task execution
     * Same input always produces same proof
     */
    generateProofHash(task, result) {
        // Create deterministic input string
        const inputData = {
            taskId: task.id,
            type: task.type,
            payload: task.payload,
            result: result,
            timestamp: task.timestamp
        };
        
        // Sort keys for deterministic output
        const canonical = JSON.stringify(inputData, Object.keys(inputData).sort());
        
        return crypto.createHash('sha256').update(canonical).digest('hex');
    }

    /**
     * Create execution proof for a task
     */
    createProof(task, result) {
        const proofHash = this.generateProofHash(task, result);
        
        return {
            taskId: task.id,
            nodeId: this.nodeId,
            type: task.type,
            inputHash: this.hashInput(task),
            resultHash: this.hashResult(result),
            proofHash,
            timestamp: Date.now(),
            executedAt: task.timestamp
        };
    }

    /**
     * Verify an execution proof
     */
    verifyProof(task, result, proof) {
        const expectedHash = this.generateProofHash(task, result);
        
        return {
            valid: expectedHash === proof.proofHash,
            expected: expectedHash,
            actual: proof.proofHash
        };
    }

    /**
     * Hash task input only
     */
    hashInput(task) {
        const input = {
            id: task.id,
            type: task.type,
            payload: task.payload,
            timestamp: task.timestamp
        };
        return crypto.createHash('sha256')
            .update(JSON.stringify(input, Object.keys(input).sort()))
            .digest('hex');
    }

    /**
     * Hash result only
     */
    hashResult(result) {
        return crypto.createHash('sha256')
            .update(JSON.stringify(result))
            .digest('hex');
    }
}

/**
 * Task Receipt - The "transaction equivalent"
 */
class TaskReceipt {
    constructor() {
        this.receipts = new Map();
    }

    /**
     * Create a receipt for executed task
     */
    create(task, result, proof, duration) {
        const receipt = {
            receiptId: `receipt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            taskId: task.id,
            nodeId: proof.nodeId,
            type: task.type,
            status: result.success ? 'success' : 'failed',
            result: result.result || result.error,
            proofHash: proof.proofHash,
            inputHash: proof.inputHash,
            resultHash: proof.resultHash,
            duration,
            timestamp: proof.timestamp,
            committed: false,
            commitTx: null
        };
        
        this.receipts.set(receipt.receiptId, receipt);
        
        return receipt;
    }

    /**
     * Get receipt by ID
     */
    get(receiptId) {
        return this.receipts.get(receiptId);
    }

    /**
     * Get all receipts
     */
    getAll() {
        return Array.from(this.receipts.values());
    }

    /**
     * Get uncommitted receipts (for chain commit)
     */
    getUncommitted(limit = 100) {
        return this.getAll()
            .filter(r => !r.committed)
            .slice(0, limit);
    }

    /**
     * Mark receipt as committed to chain
     */
    markCommitted(receiptId, txHash) {
        const receipt = this.receipts.get(receiptId);
        if (receipt) {
            receipt.committed = true;
            receipt.commitTx = txHash;
            receipt.committedAt = Date.now();
        }
        return receipt;
    }

    /**
     * Batch commit receipts
     */
    batchCommit(receiptIds, txHash) {
        const results = [];
        for (const id of receiptIds) {
            results.push(this.markCommitted(id, txHash));
        }
        return results;
    }

    /**
     * Generate snapshot for chain commit
     */
    generateSnapshot() {
        const receipts = this.getUncommitted(100);
        
        if (receipts.length === 0) {
            return null;
        }
        
        // Calculate merkle root of receipts
        const hashList = receipts.map(r => r.proofHash);
        const merkleRoot = this.calculateMerkleRoot(hashList);
        
        return {
            snapshotId: `snap_${Date.now()}`,
            receiptCount: receipts.length,
            merkleRoot,
            receipts: receipts.map(r => r.receiptId),
            timestamp: Date.now(),
            // Include aggregated state hash
            stateHash: this.hashState(receipts)
        };
    }

    /**
     * Simple merkle root calculation
     */
    calculateMerkleRoot(hashes) {
        if (hashes.length === 0) return '';
        if (hashes.length === 1) return hashes[0];
        
        const pairs = [];
        for (let i = 0; i < hashes.length; i += 2) {
            const left = hashes[i];
            const right = hashes[i + 1] || left;
            pairs.push(crypto.createHash('sha256').update(left + right).digest('hex'));
        }
        
        return this.calculateMerkleRoot(pairs);
    }

    /**
     * Hash state from receipts
     */
    hashState(receipts) {
        const stateData = receipts.map(r => ({
            taskId: r.taskId,
            type: r.type,
            resultHash: r.resultHash
        }));
        
        return crypto.createHash('sha256')
            .update(JSON.stringify(stateData))
            .digest('hex');
    }

    /**
     * Get statistics
     */
    getStats() {
        const all = this.getAll();
        const committed = all.filter(r => r.committed).length;
        
        return {
            total: all.length,
            committed,
            pending: all.length - committed,
            success: all.filter(r => r.status === 'success').length,
            failed: all.filter(r => r.status === 'failed').length
        };
    }
}

module.exports = {
    ExecutionProof,
    TaskReceipt
};