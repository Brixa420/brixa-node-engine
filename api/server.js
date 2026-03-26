/**
 * API Server - HTTP endpoints
 */
const http = require('http');
const url = require('url');
const logger = require('../utils/logger');
const { generateTaskId } = require('../utils/id');

class APIServer {
    constructor(node, config = {}) {
        this.node = node;
        this.config = {
            port: config.port || 3000,
            host: config.host || '0.0.0.0',
            ...config
        };
        
        this.server = null;
        this.isRunning = false;
        
        // Request handlers
        this.routes = {
            'GET /': this.handleRoot.bind(this),
            'GET /health': this.handleHealth.bind(this),
            'GET /state': this.handleGetState.bind(this),
            'POST /task': this.handlePostTask.bind(this),
            'POST /task/batch': this.handleBatchTasks.bind(this),
            'GET /stats': this.handleStats.bind(this),
            'GET /receipts': this.handleReceipts.bind(this),
            'GET /snapshot': this.handleSnapshot.bind(this),
            'POST /receipts/:id/commit': this.handleCommitReceipt.bind(this),
            'POST /zk/proof': this.handleZKProofRequest.bind(this),
            'GET /zk/proof': this.handleZKProofGet.bind(this),
            'GET /zk/batch': this.handleZKBatch.bind(this),
            'GET /peers': this.handlePeers.bind(this),
            'POST /peers': this.handleAddPeer.bind(this),
            'DELETE /peers/:id': this.handleRemovePeer.bind(this),
        };
    }

    // Start the server
    async start() {
        this.server = http.createServer(this.handleRequest.bind(this));
        
        this.server.listen(this.config.port, this.config.host, () => {
            this.isRunning = true;
            logger.info(`API Server listening on http://${this.config.host}:${this.config.port}`);
        });
        
        this.server.on('error', (err) => {
            logger.error('Server error:', err.message);
        });
    }

    // Stop the server
    async stop() {
        if (this.server) {
            this.server.close();
            this.isRunning = false;
            logger.info('API Server stopped');
        }
    }

    // Handle incoming HTTP request
    async handleRequest(req, res) {
        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Node-ID');
        
        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        // Parse URL
        const parsedUrl = new url.URL(req.url, `http://${req.headers.host}`);
        const method = req.method;
        const path = parsedUrl.pathname;
        
        logger.debug(`${method} ${path}`);
        
        // Find handler
        const routeKey = `${method} ${path}`;
        let handler = this.routes[routeKey];
        
        // Check for parameterized routes
        if (!handler) {
            if (method === 'DELETE' && path.startsWith('/peers/')) {
                handler = this.handleRemovePeer.bind(this);
            }
        }
        
        if (!handler) {
            this.sendJSON(res, 404, { error: 'Not found', path });
            return;
        }
        
        // Read body for POST/PUT
        let body = null;
        if (['POST', 'PUT'].includes(method)) {
            body = await this.readBody(req);
        }
        
        // Execute handler
        try {
            await handler(req, res, body);
        } catch (err) {
            logger.error(`Handler error:`, err.message);
            this.sendJSON(res, 500, { error: err.message });
        }
    }

    // Read request body
    readBody(req) {
        return new Promise((resolve, reject) => {
            let data = '';
            
            req.on('data', chunk => data += chunk);
            req.on('end', () => {
                try {
                    resolve(data ? JSON.parse(data) : null);
                } catch {
                    resolve(data);
                }
            });
            req.on('error', reject);
        });
    }

    // Send JSON response
    sendJSON(res, statusCode, data) {
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(statusCode);
        res.end(JSON.stringify(data));
    }

    // ============ Handlers ============

    // Root handler
    handleRoot(req, res) {
        this.sendJSON(res, 200, {
            name: 'Brixa Node Engine',
            version: '1.0.0',
            nodeId: this.node.nodeId,
            status: this.node.status,
            endpoints: [
                'GET / - This info',
                'GET /health - Health check',
                'GET /state - World state',
                'POST /task - Submit task',
                'POST /task/batch - Submit multiple tasks',
                'GET /stats - Node statistics',
                'GET /peers - List peers',
                'POST /peers - Add peer'
            ]
        });
    }

    // Health check
    handleHealth(req, res) {
        const summary = this.node.getSummary();
        
        this.sendJSON(res, 200, {
            status: 'healthy',
            nodeId: this.node.nodeId,
            uptime: process.uptime(),
            load: summary.node.load,
            tasksProcessed: summary.node.tasksProcessed,
            timestamp: Date.now()
        });
    }

    // Get world state
    handleGetState(req, res) {
        const state = this.node.getState();
        
        this.sendJSON(res, 200, state);
    }

    // Submit task
    handlePostTask(req, res, body) {
        if (!body || !body.type) {
            this.sendJSON(res, 400, { error: 'Missing task type' });
            return;
        }
        
        // Create task with ID
        const task = {
            id: body.id || generateTaskId(),
            type: body.type,
            payload: body.payload || {},
            origin: body.origin || this.node.nodeId,
            timestamp: body.timestamp || Date.now()
        };
        
        logger.info(`Received task: ${task.id} (${task.type})`);
        
        // Process task through node
        this.node.processTask(task)
            .then(result => {
                this.sendJSON(res, 200, result);
            })
            .catch(err => {
                logger.error(`Task failed:`, err.message);
                this.sendJSON(res, 500, { error: err.message });
            });
    }

    // Batch tasks
    handleBatchTasks(req, res, body) {
        if (!body || !Array.isArray(body.tasks)) {
            this.sendJSON(res, 400, { error: 'Missing tasks array' });
            return;
        }
        
        const tasks = body.tasks.map(t => ({
            id: t.id || generateTaskId(),
            type: t.type,
            payload: t.payload || {},
            origin: t.origin || this.node.nodeId,
            timestamp: t.timestamp || Date.now()
        }));
        
        logger.info(`Received batch of ${tasks.length} tasks`);
        
        this.node.processBatch(tasks)
            .then(results => {
                this.sendJSON(res, 200, { results });
            })
            .catch(err => {
                logger.error(`Batch failed:`, err.message);
                this.sendJSON(res, 500, { error: err.message });
            });
    }

    // Get statistics
    handleStats(req, res) {
        const stats = this.node.getStats();
        
        this.sendJSON(res, 200, stats);
    }

    // Get receipts
    handleReceipts(req, res) {
        const url = require('url');
        const queryObject = new url.URL(req.url, `http://${req.headers.host}`).searchParams;
        const uncommitted = queryObject.get('uncommitted') === 'true';
        const limit = parseInt(queryObject.get('limit')) || 100;
        
        let receipts;
        if (uncommitted) {
            receipts = this.node.getUncommittedReceipts(limit);
        } else {
            receipts = this.node.getReceipts();
        }
        
        this.sendJSON(res, 200, {
            receipts,
            stats: this.node.getReceiptStats()
        });
    }

    // Get snapshot for chain commit
    handleSnapshot(req, res) {
        const snapshot = this.node.generateSnapshot();
        
        if (!snapshot) {
            this.sendJSON(res, 200, { message: 'No uncommitted receipts', snapshot: null });
            return;
        }
        
        this.sendJSON(res, 200, { snapshot });
    }

    // Commit receipt to chain
    handleCommitReceipt(req, res, body) {
        const url = require('url');
        const queryObject = new url.URL(req.url, `http://${req.headers.host}`).searchParams;
        const receiptId = queryObject.get('id') || (body && body.receiptId);
        const txHash = body && body.txHash;
        
        if (!receiptId || !txHash) {
            this.sendJSON(res, 400, { error: 'Missing receiptId or txHash' });
            return;
        }
        
        const receipt = this.node.markReceiptCommitted(receiptId, txHash);
        
        if (!receipt) {
            this.sendJSON(res, 404, { error: 'Receipt not found' });
            return;
        }
        
        this.sendJSON(res, 200, { success: true, receipt });
    }

    // Request ZK proof for a receipt
    async handleZKProofRequest(req, res, body) {
        if (!body || !body.receiptId) {
            this.sendJSON(res, 400, { error: 'Missing receiptId' });
            return;
        }
        
        // Get receipt
        const receipt = this.node.getReceipt(body.receiptId);
        
        if (!receipt) {
            this.sendJSON(res, 404, { error: 'Receipt not found' });
            return;
        }
        
        // Request async ZK proof (soft confirmation)
        const result = this.node.requestZKProof(receipt);
        
        // Immediately return - proof generates async
        this.sendJSON(res, 202, {
            ...result,
            message: 'ZK proof requested (async) - soft confirmation received'
        });
    }

    // Get ZK proof status
    handleZKProofGet(req, res) {
        const url = require('url');
        const queryObject = new url.URL(req.url, `http://${req.headers.host}`).searchParams;
        const proofId = queryObject.get('id');
        
        if (!proofId) {
            this.sendJSON(res, 400, { error: 'Missing proofId query param' });
            return;
        }
        
        const proof = this.node.getZKProof(proofId);
        
        if (!proof) {
            this.sendJSON(res, 404, { error: 'Proof not found' });
            return;
        }
        
        this.sendJSON(res, 200, { proof });
    }

    // Get ZK proof batch for settlement
    handleZKBatch(req, res) {
        const url = require('url');
        const queryObject = new url.URL(req.url, `http://${req.headers.host}`).searchParams;
        const limit = parseInt(queryObject.get('limit')) || 50;
        
        const batch = this.node.getZKBatch(limit);
        
        if (!batch) {
            this.sendJSON(res, 200, { message: 'No completed proofs', batch: null });
            return;
        }
        
        this.sendJSON(res, 200, { batch });
    }

    // Get peers
    handlePeers(req, res) {
        const peers = this.node.getPeers();
        
        this.sendJSON(res, 200, { peers });
    }

    // Add peer
    handleAddPeer(req, res, body) {
        if (!body || !body.peerId || !body.url) {
            this.sendJSON(res, 400, { error: 'Missing peerId or url' });
            return;
        }
        
        this.node.addPeer(body.peerId, body.url);
        
        this.sendJSON(res, 200, { 
            success: true, 
            peerId: body.peerId,
            message: `Peer ${body.peerId} added`
        });
    }

    // Remove peer
    handleRemovePeer(req, res) {
        const pathParts = req.url.split('/');
        const peerId = pathParts[pathParts.length - 1];
        
        if (!peerId) {
            this.sendJSON(res, 400, { error: 'Missing peerId' });
            return;
        }
        
        this.node.removePeer(peerId);
        
        this.sendJSON(res, 200, { 
            success: true, 
            peerId,
            message: `Peer ${peerId} removed`
        });
    }
}

module.exports = APIServer;