/**
 * Executor - THE HANDS
 * Runs the actual task work
 */
const logger = require('../utils/logger');
const StateManager = require('./state');
const { ExecutionProof, TaskReceipt } = require('./proofs');

// Import task handlers
const worldTask = require('../tasks/world_task');
const dmTask = require('../tasks/dm_task');
const questTask = require('../tasks/quest_task');

class Executor {
    constructor(stateManager, nodeId) {
        this.stateManager = stateManager;
        this.nodeId = nodeId;
        this.handlers = {};
        this.proof = new ExecutionProof(nodeId);
        this.receipts = new TaskReceipt();
        this.stats = {
            executed: 0,
            succeeded: 0,
            failed: 0,
            totalTime: 0
        };
        this.registerDefaultHandlers();
    }

    // Register default task handlers
    registerDefaultHandlers() {
        this.registerHandler('world_tick', worldTask.handleWorldTick);
        this.registerHandler('world_update', worldTask.handleWorldUpdate);
        this.registerHandler('entity_create', worldTask.handleEntityCreate);
        this.registerHandler('entity_update', worldTask.handleEntityUpdate);
        this.registerHandler('dm', dmTask.handleDM);
        this.registerHandler('narrate', dmTask.handleNarrate);
        this.registerHandler('quest', questTask);
        this.registerHandler('quest_generate', questTask.handleQuestGenerate);
        this.registerHandler('quest_update', questTask.handleQuestUpdate);
        
        logger.info('Registered default task handlers');
    }

    // Register a custom handler
    registerHandler(type, handler) {
        this.handlers[type] = handler;
        logger.debug(`Registered handler: ${type}`);
    }

    // Execute a task
    async execute(task) {
        const startTime = Date.now();
        
        logger.info(`Executing task ${task.id} (type: ${task.type})`);
        
        this.stats.executed++;

        try {
            // Find handler for task type
            const handler = this.handlers[task.type];
            
            if (!handler) {
                throw new Error(`No handler for task type: ${task.type}`);
            }

            // Execute the handler
            const result = await handler(task, this.stateManager, {
                executor: this,
                stats: this.stats
            });

            const duration = Date.now() - startTime;
            this.stats.succeeded++;
            this.stats.totalTime += duration;

            logger.info(`Task ${task.id} completed in ${duration}ms`);

            // Create execution proof (deterministic)
            const proof = this.proof.createProof(task, result);
            
            // Create receipt
            const receipt = this.receipts.create(task, result, proof, duration);

            return {
                success: true,
                taskId: task.id,
                result,
                proof,
                receiptId: receipt.receiptId,
                duration
            };

        } catch (err) {
            const duration = Date.now() - startTime;
            this.stats.failed++;
            
            logger.error(`Task ${task.id} failed:`, err.message);

            // Still create proof for failed tasks
            const errorResult = { error: err.message };
            const proof = this.proof.createProof(task, errorResult);
            const receipt = this.receipts.create(task, { success: false, error: err.message }, proof, duration);

            return {
                success: false,
                taskId: task.id,
                error: err.message,
                proof,
                receiptId: receipt.receiptId,
                duration
            };
        }
    }

    // Execute multiple tasks in batch
    async executeBatch(tasks) {
        const results = [];
        
        for (const task of tasks) {
            const result = await this.execute(task);
            results.push(result);
        }

        return results;
    }

    // Execute tasks in parallel with concurrency limit
    async executeParallel(tasks, concurrency = 5) {
        const results = [];
        const queue = [...tasks];
        const running = [];

        while (queue.length > 0 || running.length > 0) {
            // Start new tasks up to concurrency limit
            while (running.length < concurrency && queue.length > 0) {
                const task = queue.shift();
                const promise = this.execute(task).then(result => {
                    const index = running.indexOf(promise);
                    if (index > -1) {
                        running.splice(index, 1);
                    }
                    results.push(result);
                });
                running.push(promise);
            }

            // Wait for one to complete
            if (running.length > 0) {
                await Promise.race(running);
            }
        }

        return results;
    }

    // Get executor statistics
    getStats() {
        const avgTime = this.stats.executed > 0 
            ? Math.round(this.stats.totalTime / this.stats.executed) 
            : 0;
            
        return {
            ...this.stats,
            avgTime,
            successRate: this.stats.executed > 0
                ? ((this.stats.succeeded / this.stats.executed) * 100).toFixed(1) + '%'
                : '0%'
        };
    }

    // List available handlers
    listHandlers() {
        return Object.keys(this.handlers);
    }

    // Get receipt by ID
    getReceipt(receiptId) {
        return this.receipts.get(receiptId);
    }

    // Get all receipts
    getReceipts() {
        return this.receipts.getAll();
    }

    // Get uncommitted receipts
    getUncommittedReceipts(limit) {
        return this.receipts.getUncommitted(limit);
    }

    // Generate snapshot for chain commit
    generateSnapshot() {
        return this.receipts.generateSnapshot();
    }

    // Mark receipt as committed
    markReceiptCommitted(receiptId, txHash) {
        return this.receipts.markCommitted(receiptId, txHash);
    }

    // Get receipt statistics
    getReceiptStats() {
        return this.receipts.getStats();
    }
}

module.exports = Executor;