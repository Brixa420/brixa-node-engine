/**
 * Task Router - THE BRAIN
 * Decides where tasks go: locally or to peer nodes
 */
const logger = require('../utils/logger');
const { generateTaskId } = require('../utils/id');

class TaskRouter {
    constructor(network) {
        this.network = network;
        this.localNodeId = null;
        this.routeTable = {
            'dm': { handler: 'dm_task', local: true },
            'world': { handler: 'world_task', local: true },
            'quest': { handler: 'quest_task', local: true },
            'ai': { handler: 'ai_task', local: true },
            'game': { handler: 'game_task', local: true }
        };
        this.loadThreshold = 70; // CPU % threshold for forwarding
        this.stats = {
            routed: 0,
            local: 0,
            forwarded: 0,
            failed: 0
        };
    }

    setLocalNodeId(nodeId) {
        this.localNodeId = nodeId;
    }

    // Main routing function
    async route(task) {
        // Ensure task has required fields
        if (!task.id) {
            task.id = generateTaskId();
        }
        if (!task.timestamp) {
            task.timestamp = Date.now();
        }
        if (!task.origin) {
            task.origin = this.localNodeId;
        }

        logger.info(`Routing task ${task.id} of type ${task.type}`);

        // Check if we should handle locally or forward
        const shouldLocal = await this.shouldExecuteLocally(task);
        
        if (shouldLocal) {
            this.stats.local++;
            this.stats.routed++;
            logger.debug(`Route: ${task.id} → LOCAL`);
            return { destination: 'local', task };
        } else {
            // Find best peer to forward to
            const peerNode = await this.findBestPeer();
            
            if (peerNode) {
                this.stats.forwarded++;
                this.stats.routed++;
                logger.debug(`Route: ${task.id} → ${peerNode.id}`);
                return { destination: peerNode.id, task, peerUrl: peerNode.url };
            } else {
                // No peers available, execute locally anyway
                logger.warn(`No peers available, executing ${task.id} locally`);
                this.stats.local++;
                this.stats.routed++;
                return { destination: 'local', task };
            }
        }
    }

    // Decide if task should run locally
    async shouldExecuteLocally(task) {
        // Always run certain types locally
        const localOnlyTypes = ['world_tick', 'state_sync', 'health_check'];
        if (localOnlyTypes.includes(task.type)) {
            return true;
        }

        // Check local load
        const load = await this.getLocalLoad();
        
        if (load < this.loadThreshold) {
            return true;
        }

        // Check if task has explicit preference
        if (task.forceLocal === true) {
            return true;
        }

        // If overloaded, check for peers
        const peers = await this.network.getPeers();
        if (peers.length === 0) {
            return true; // No peers, must run locally
        }

        return false;
    }

    // Get local CPU load (simulated for now)
    async getLocalLoad() {
        // TODO: Replace with real CPU monitoring
        // For now, return random load between 20-80%
        return Math.floor(Math.random() * 60) + 20;
    }

    // Find best peer node (least loaded)
    async findBestPeer() {
        const peers = await this.network.getPeers();
        
        if (!peers || peers.length === 0) {
            return null;
        }

        // Find peer with lowest load
        let bestPeer = null;
        let minLoad = Infinity;

        for (const peer of peers) {
            try {
                const health = await this.network.getPeerHealth(peer);
                if (health && health.load < minLoad) {
                    minLoad = health.load;
                    bestPeer = peer;
                }
            } catch (err) {
                logger.debug(`Peer ${peer.id} health check failed:`, err.message);
            }
        }

        return bestPeer;
    }

    // Register a route handler
    registerRoute(type, config) {
        this.routeTable[type] = config;
        logger.info(`Registered route: ${type} → ${config.handler}`);
    }

    // Get route info for a task type
    getRouteInfo(type) {
        return this.routeTable[type] || null;
    }

    // Get routing statistics
    getStats() {
        return {
            ...this.stats,
            successRate: this.stats.routed > 0 
                ? ((this.stats.local + this.stats.forwarded) / this.stats.routed * 100).toFixed(1) + '%'
                : '0%'
        };
    }

    // Reset statistics
    resetStats() {
        this.stats = {
            routed: 0,
            local: 0,
            forwarded: 0,
            failed: 0
        };
    }
}

module.exports = TaskRouter;