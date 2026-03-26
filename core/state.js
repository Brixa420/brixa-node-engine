/**
 * State Manager - Manages JSON state files
 */
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const STATE_DIR = path.join(__dirname, '..', 'state');

class StateManager {
    constructor() {
        this.worldState = null;
        this.nodeState = null;
        this.stateFiles = {
            world: path.join(STATE_DIR, 'world_state.json'),
            node: path.join(STATE_DIR, 'node_state.json')
        };
        this.ensureStateDir();
    }

    ensureStateDir() {
        if (!fs.existsSync(STATE_DIR)) {
            fs.mkdirSync(STATE_DIR, { recursive: true });
            logger.info('Created state directory:', STATE_DIR);
        }
    }

    // Load state from file
    loadState(type = 'world') {
        const filePath = this.stateFiles[type];
        try {
            if (fs.existsSync(filePath)) {
                const data = fs.readFileSync(filePath, 'utf8');
                const state = JSON.parse(data);
                logger.info(`Loaded ${type} state from file`);
                return state;
            }
        } catch (err) {
            logger.error(`Failed to load ${type} state:`, err.message);
        }
        
        // Return default state
        return type === 'world' ? this.getDefaultWorldState() : this.getDefaultNodeState();
    }

    // Save state to file
    saveState(type = 'world', state = null) {
        const filePath = this.stateFiles[type];
        const data = state || (type === 'world' ? this.worldState : this.nodeState);
        
        try {
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            logger.debug(`Saved ${type} state to file`);
            return true;
        } catch (err) {
            logger.error(`Failed to save ${type} state:`, err.message);
            return false;
        }
    }

    // Get world state (with lazy load)
    getWorldState() {
        if (!this.worldState) {
            this.worldState = this.loadState('world');
        }
        return this.worldState;
    }

    // Update world state
    updateWorldState(updates) {
        this.worldState = this.getWorldState();
        
        // Apply updates
        for (const [key, value] of Object.entries(updates)) {
            this.worldState[key] = value;
        }
        
        this.worldState.lastUpdate = Date.now();
        this.worldState.tick = (this.worldState.tick || 0) + 1;
        
        this.saveState('world');
        return this.worldState;
    }

    // Get node state
    getNodeState() {
        if (!this.nodeState) {
            this.nodeState = this.loadState('node');
        }
        return this.nodeState;
    }

    // Update node state
    updateNodeState(updates) {
        this.nodeState = this.getNodeState();
        
        for (const [key, value] of Object.entries(updates)) {
            this.nodeState[key] = value;
        }
        
        this.nodeState.lastUpdate = Date.now();
        
        this.saveState('node');
        return this.nodeState;
    }

    // Get default world state
    getDefaultWorldState() {
        return {
            tick: 0,
            entities: {},
            players: {},
            worldTime: 0,
            weather: 'clear',
            events: [],
            lastUpdate: Date.now()
        };
    }

    // Get default node state
    getDefaultNodeState() {
        return {
            id: null,
            role: 'general',
            status: 'initializing',
            load: 0,
            peers: [],
            tasksProcessed: 0,
            uptime: 0,
            lastUpdate: Date.now()
        };
    }

    // Sync state from another node
    syncState(remoteState, type = 'world') {
        if (type === 'world') {
            this.worldState = remoteState;
        } else {
            this.nodeState = remoteState;
        }
        this.saveState(type);
        logger.info(`Synced ${type} state from remote`);
    }

    // Get state summary
    getSummary() {
        const world = this.getWorldState();
        const node = this.getNodeState();
        
        return {
            world: {
                tick: world.tick,
                entityCount: Object.keys(world.entities || {}).length,
                playerCount: Object.keys(world.players || {}).length
            },
            node: {
                id: node.id,
                status: node.status,
                load: node.load,
                tasksProcessed: node.tasksProcessed
            }
        };
    }
}

module.exports = StateManager;