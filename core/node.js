/**
 * Brixa Node Engine - Main Entry Point
 * A distributed node execution engine that can receive tasks, route them, execute them, and return results.
 * 
 * Usage: node core/node.js [--port 3000] [--node-id custom-id]
 */
const fs = require('fs');
const path = require('path');

// Parse command line args
const args = process.argv.slice(2);
const config = {
    port: 3000,
    nodeId: null,
    role: 'general'
};

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && args[i + 1]) {
        config.port = parseInt(args[i + 1]);
        i++;
    } else if (args[i] === '--node-id' && args[i + 1]) {
        config.nodeId = args[i + 1];
        i++;
    } else if (args[i] === '--role') {
        config.role = args[i + 1] || 'general';
        i++;
    }
}

// Import core modules
const logger = require('../utils/logger');
const { generateNodeId, generateTaskId } = require('../utils/id');
const StateManager = require('./state');
const Network = require('./network');
const Router = require('./router');
const Executor = require('./executor');
const ZKProofGenerator = require('./zkproof');
const APIServer = require('../api/server');

class Node {
    constructor(config = {}) {
        this.config = {
            port: config.port || 3000,
            nodeId: config.nodeId || generateNodeId(),
            role: config.role || 'general',
            ...config
        };
        
        this.status = 'initializing';
        this.startTime = Date.now();
        
        // Initialize core components
        this.stateManager = new StateManager();
        this.network = new Network(this.config.nodeId, { port: this.config.port });
        this.router = new Router(this.network);
        this.executor = new Executor(this.stateManager, this.config.nodeId);
        this.zkProver = new ZKProofGenerator();
        this.apiServer = new APIServer(this, { port: this.config.port });
        
        // Setup router with node ID
        this.router.setLocalNodeId(this.config.nodeId);
        
        // Stats
        this.stats = {
            tasksReceived: 0,
            tasksCompleted: 0,
            tasksFailed: 0,
            tasksForwarded: 0
        };
        
        logger.info('='.repeat(50));
        logger.info('Brixa Node Engine Starting...');
        logger.info(`Node ID: ${this.config.nodeId}`);
        logger.info(`Role: ${this.config.role}`);
        logger.info(`Port: ${this.config.port}`);
        logger.info('='.repeat(50));
    }

    // Start the node
    async start() {
        try {
            // Initialize state
            this.stateManager.updateNodeState({
                id: this.config.nodeId,
                role: this.config.role,
                status: 'starting',
                port: this.config.port
            });
            
            // Start network
            await this.network.start();
            
            // Start API server
            await this.apiServer.start();
            
            // Update status
            this.status = 'running';
            this.stateManager.updateNodeState({
                status: 'running',
                uptime: Date.now() - this.startTime
            });
            
            logger.info('✓ Node started successfully');
            logger.info(`  - Node ID: ${this.config.nodeId}`);
            logger.info(`  - API: http://localhost:${this.config.port}`);
            logger.info(`  - Endpoints:`);
            logger.info(`    GET  /health - Health check`);
            logger.info(`    GET  /state  - World state`);
            logger.info(`    POST /task  - Submit task`);
            
            // Run initial world tick test
            await this.testWorldTick();
            
            return true;
            
        } catch (err) {
            logger.error('Failed to start node:', err.message);
            this.status = 'error';
            throw err;
        }
    }

    // Stop the node
    async stop() {
        logger.info('Stopping node...');
        
        await this.apiServer.stop();
        await this.network.stop();
        
        this.status = 'stopped';
        this.stateManager.updateNodeState({ status: 'stopped' });
        
        logger.info('Node stopped');
    }

    // Test world tick task
    async testWorldTick() {
        logger.info('Running test: world_tick task...');
        
        const testTask = {
            id: generateTaskId(),
            type: 'world_tick',
            payload: {},
            origin: this.config.nodeId,
            timestamp: Date.now()
        };
        
        try {
            const result = await this.processTask(testTask);
            
            if (result.success) {
                logger.info('✓ Test passed: world_tick');
                logger.info(`  Result: tick #${result.result.tick}, ${result.result.entityCount} entities`);
            } else {
                logger.error('✗ Test failed:', result.error);
            }
            
            return result;
            
        } catch (err) {
            logger.error('✗ Test error:', err.message);
            throw err;
        }
    }

    // Process a single task
    async processTask(task) {
        this.stats.tasksReceived++;
        
        logger.info(`Processing task: ${task.id} (${task.type})`);
        
        // Route the task
        const route = await this.router.route(task);
        
        logger.debug(`Task ${task.id} routed to: ${route.destination}`);
        
        // Execute locally or forward
        let result;
        
        if (route.destination === 'local') {
            result = await this.executor.execute(task);
        } else {
            // Forward to peer
            this.stats.tasksForwarded++;
            try {
                result = await this.network.sendToPeer(route.destination, task);
            } catch (err) {
                logger.error(`Forward failed, executing locally:`, err.message);
                result = await this.executor.execute(task);
            }
        }
        
        // Update stats
        if (result.success) {
            this.stats.tasksCompleted++;
        } else {
            this.stats.tasksFailed++;
        }
        
        // Update node state
        this.stateManager.updateNodeState({
            tasksProcessed: this.stats.tasksCompleted
        });
        
        return result;
    }

    // Process multiple tasks
    async processBatch(tasks) {
        const results = [];
        
        for (const task of tasks) {
            const result = await this.processTask(task);
            results.push(result);
        }
        
        return results;
    }

    // Get node summary
    getSummary() {
        return this.stateManager.getSummary();
    }

    // Get world state
    getState() {
        return this.stateManager.getWorldState();
    }

    // Get node state
    getNodeState() {
        return this.stateManager.getNodeState();
    }

    // Get statistics
    getStats() {
        return {
            node: {
                nodeId: this.config.nodeId,
                role: this.config.role,
                status: this.status,
                uptime: Date.now() - this.startTime
            },
            tasks: this.stats,
            router: this.router.getStats(),
            executor: this.executor.getStats(),
            network: this.network.getStats(),
            receipts: this.executor.getReceiptStats()
        };
    }

    // Get receipts
    getReceipts() {
        return this.executor.getReceipts();
    }

    // Get uncommitted receipts
    getUncommittedReceipts(limit) {
        return this.executor.getUncommittedReceipts(limit);
    }

    // Generate snapshot for chain commit
    generateSnapshot() {
        return this.executor.generateSnapshot();
    }

    // Mark receipt as committed
    markReceiptCommitted(receiptId, txHash) {
        return this.executor.markReceiptCommitted(receiptId, txHash);
    }

    // Get receipt by ID
    getReceipt(receiptId) {
        return this.executor.getReceipt(receiptId);
    }

    // Get receipt statistics
    getReceiptStats() {
        return this.executor.getReceiptStats();
    }

    // Request ZK proof for a receipt (async)
    requestZKProof(receipt) {
        return this.zkProver.requestProof(receipt);
    }

    // Get ZK proof by ID
    getZKProof(proofId) {
        return this.zkProver.getProof(proofId);
    }

    // Get ZK proof batch for settlement
    getZKBatch(limit) {
        return this.zkProver.generateSettlementBatch(limit);
    }

    // Get ZK prover statistics
    getZKStats() {
        return this.zkProver.getStats();
    }

    // Get peers
    getPeers() {
        return this.network.getPeers();
    }

    // Add peer
    addPeer(peerId, url) {
        this.network.addPeer(peerId, url);
    }

    // Remove peer
    removePeer(peerId) {
        this.network.removePeer(peerId);
    }
}

// Export for use as module
module.exports = Node;

// Run if executed directly
if (require.main === module) {
    const node = new Node(config);
    
    // Handle shutdown
    process.on('SIGINT', async () => {
        logger.info('Received SIGINT, shutting down...');
        await node.stop();
        process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
        logger.info('Received SIGTERM, shutting down...');
        await node.stop();
        process.exit(0);
    });
    
    // Start node
    node.start().catch(err => {
        logger.error('Fatal error:', err);
        process.exit(1);
    });
}