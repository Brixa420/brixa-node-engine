/**
 * World Task Handler
 * Handles world simulation tasks: tick, update, entities
 */
const logger = require('../utils/logger');

async function handleWorldTick(task, stateManager, context) {
    logger.info('Handling world_tick task');
    
    // Get current world state
    const world = stateManager.getWorldState();
    
    // Increment tick
    world.tick = (world.tick || 0) + 1;
    world.worldTime += 1;
    world.lastUpdate = Date.now();
    
    // Process world events
    if (world.events && world.events.length > 0) {
        // Process oldest event
        const event = world.events.shift();
        logger.debug(`Processing world event: ${event.type}`);
    }
    
    // Update all entities
    if (world.entities) {
        for (const [entityId, entity] of Object.entries(world.entities)) {
            if (entity.lastUpdate) {
                const timeSinceUpdate = Date.now() - entity.lastUpdate;
                if (timeSinceUpdate > 60000) { // 1 minute
                    entity.status = 'idle';
                }
            }
        }
    }
    
    // Update state
    stateManager.updateWorldState({
        tick: world.tick,
        worldTime: world.worldTime,
        lastUpdate: world.lastUpdate,
        events: world.events
    });
    
    return {
        tick: world.tick,
        worldTime: world.worldTime,
        entityCount: Object.keys(world.entities || {}).length,
        status: 'success'
    };
}

async function handleWorldUpdate(task, stateManager, context) {
    logger.info('Handling world_update task');
    
    const { updates } = task.payload || {};
    
    if (!updates) {
        throw new Error('No updates provided in payload');
    }
    
    // Apply updates to world state
    const world = stateManager.getWorldState();
    
    for (const [key, value] of Object.entries(updates)) {
        world[key] = value;
    }
    
    world.lastUpdate = Date.now();
    
    stateManager.updateWorldState(updates);
    
    return {
        updated: Object.keys(updates),
        timestamp: world.lastUpdate,
        status: 'success'
    };
}

async function handleEntityCreate(task, stateManager, context) {
    logger.info('Handling entity_create task');
    
    const { entityType, entityId, data } = task.payload || {};
    
    if (!entityType || !entityId) {
        throw new Error('Missing entityType or entityId in payload');
    }
    
    const world = stateManager.getWorldState();
    
    if (!world.entities) {
        world.entities = {};
    }
    if (!world.entities[entityType]) {
        world.entities[entityType] = {};
    }
    
    // Create entity with default fields
    world.entities[entityType][entityId] = {
        id: entityId,
        type: entityType,
        ...data,
        createdAt: Date.now(),
        lastUpdate: Date.now(),
        status: 'active'
    };
    
    stateManager.updateWorldState({ entities: world.entities });
    
    logger.info(`Created entity: ${entityType}/${entityId}`);
    
    return {
        entityType,
        entityId,
        status: 'created',
        createdAt: world.entities[entityType][entityId].createdAt
    };
}

async function handleEntityUpdate(task, stateManager, context) {
    logger.info('Handling entity_update task');
    
    const { entityType, entityId, updates } = task.payload || {};
    
    if (!entityType || !entityId || !updates) {
        throw new Error('Missing required fields in payload');
    }
    
    const world = stateManager.getWorldState();
    
    if (!world.entities || !world.entities[entityType] || !world.entities[entityType][entityId]) {
        throw new Error(`Entity not found: ${entityType}/${entityId}`);
    }
    
    // Apply updates
    const entity = world.entities[entityType][entityId];
    for (const [key, value] of Object.entries(updates)) {
        entity[key] = value;
    }
    entity.lastUpdate = Date.now();
    
    stateManager.updateWorldState({ entities: world.entities });
    
    return {
        entityType,
        entityId,
        updated: Object.keys(updates),
        status: 'updated'
    };
}

async function handleEntityDelete(task, stateManager, context) {
    logger.info('Handling entity_delete task');
    
    const { entityType, entityId } = task.payload || {};
    
    if (!entityType || !entityId) {
        throw new Error('Missing entityType or entityId in payload');
    }
    
    const world = stateManager.getWorldState();
    
    if (world.entities && world.entities[entityType]) {
        delete world.entities[entityType][entityId];
        stateManager.updateWorldState({ entities: world.entities });
    }
    
    return {
        entityType,
        entityId,
        status: 'deleted'
    };
}

module.exports = {
    handleWorldTick,
    handleWorldUpdate,
    handleEntityCreate,
    handleEntityUpdate,
    handleEntityDelete
};