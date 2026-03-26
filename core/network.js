/**
 * Network Layer - THE NERVOUS SYSTEM
 * Handles peer communication, task forwarding, heartbeats
 */
const http = require('http');
const https = require('https');
const { URL } = require('url');
const logger = require('../utils/logger');

class Network {
    constructor(nodeId, config = {}) {
        this.nodeId = nodeId;
        this.config = {
            port: config.port || 3000,
            protocol: config.protocol || 'http',
            heartbeatInterval: config.heartbeatInterval || 30000,
            peerTimeout: config.peerTimeout || 5000,
            ...config
        };
        
        this.peers = new Map(); // peerId -> { url, lastSeen, load, status }
        this.peerHealth = new Map(); // peerId -> health response
        
        this.pendingRequests = new Map();
        this.messageHandlers = new Map();
        
        this.isRunning = false;
    }

    // Start network layer
    async start() {
        this.isRunning = true;
        
        // Start heartbeat loop
        this.heartbeatInterval = setInterval(() => {
            this.checkPeerHealth();
        }, this.config.heartbeatInterval);
        
        logger.info('Network layer started');
    }

    // Stop network layer
    async stop() {
        this.isRunning = false;
        
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        
        logger.info('Network layer stopped');
    }

    // Add a peer node
    addPeer(peerId, url) {
        this.peers.set(peerId, {
            id: peerId,
            url,
            lastSeen: Date.now(),
            load: 0,
            status: 'connected'
        });
        
        logger.info(`Added peer: ${peerId} at ${url}`);
    }

    // Remove a peer
    removePeer(peerId) {
        this.peers.delete(peerId);
        this.peerHealth.delete(peerId);
        logger.info(`Removed peer: ${peerId}`);
    }

    // Get list of peers
    async getPeers() {
        const activePeers = [];
        
        for (const [id, peer] of this.peers) {
            if (peer.status === 'connected') {
                activePeers.push(peer);
            }
        }
        
        return activePeers;
    }

    // Check health of all peers
    async checkPeerHealth() {
        for (const [id, peer] of this.peers) {
            try {
                const health = await this.request(peer.url, '/health', 'GET');
                this.peerHealth.set(id, health);
                peer.lastSeen = Date.now();
                peer.load = health.load || 0;
                peer.status = 'connected';
            } catch (err) {
                peer.status = 'disconnected';
                logger.debug(`Peer ${id} health check failed`);
            }
        }
    }

    // Get peer health
    getPeerHealth(peer) {
        return this.peerHealth.get(peer.id) || { load: 100, status: 'unknown' };
    }

    // Send task to peer
    async sendToPeer(peerId, task) {
        const peer = this.peers.get(peerId);
        
        if (!peer) {
            throw new Error(`Unknown peer: ${peerId}`);
        }

        try {
            const response = await this.request(peer.url, '/task', 'POST', task);
            return response;
        } catch (err) {
            logger.error(`Failed to send task to ${peerId}:`, err.message);
            throw err;
        }
    }

    // Forward task to best available peer
    async forwardTask(task) {
        const peers = await this.getPeers();
        
        if (peers.length === 0) {
            throw new Error('No peers available for forwarding');
        }

        // Find least loaded peer
        let bestPeer = null;
        let minLoad = Infinity;
        
        for (const peer of peers) {
            const health = this.peerHealth.get(peer.id) || { load: 0 };
            if (health.load < minLoad) {
                minLoad = health.load;
                bestPeer = peer;
            }
        }

        if (!bestPeer) {
            throw new Error('No healthy peers available');
        }

        logger.info(`Forwarding task ${task.id} to ${bestPeer.id}`);
        return this.sendToPeer(bestPeer.id, task);
    }

    // HTTP request helper
    async request(url, path, method = 'GET', body = null) {
        return new Promise((resolve, reject) => {
            const parsedUrl = new URL(path, url);
            const client = parsedUrl.protocol === 'https:' ? https : http;
            
            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
                path: parsedUrl.pathname,
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Node-ID': this.nodeId
                },
                timeout: this.config.peerTimeout
            };

            const req = client.request(options, (res) => {
                let data = '';
                
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        resolve(parsed);
                    } catch {
                        resolve(data);
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            if (body) {
                req.write(JSON.stringify(body));
            }

            req.end();
        });
    }

    // Register message handler
    on(type, handler) {
        this.messageHandlers.set(type, handler);
    }

    // Handle incoming message
    async handleMessage(type, data) {
        const handler = this.messageHandlers.get(type);
        if (handler) {
            return handler(data);
        }
        logger.warn(`No handler for message type: ${type}`);
    }

    // Broadcast to all peers
    async broadcast(type, data) {
        const peers = await this.getPeers();
        const results = [];

        for (const peer of peers) {
            try {
                const result = await this.request(peer.url, `/broadcast/${type}`, 'POST', data);
                results.push({ peer: peer.id, success: true, result });
            } catch (err) {
                results.push({ peer: peer.id, success: false, error: err.message });
            }
        }

        return results;
    }

    // Get network statistics
    getStats() {
        return {
            nodeId: this.nodeId,
            peerCount: this.peers.size,
            peers: Array.from(this.peers.values()).map(p => ({
                id: p.id,
                status: p.status,
                load: p.load,
                lastSeen: p.lastSeen
            }))
        };
    }
}

module.exports = Network;