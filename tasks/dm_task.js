/**
 * DM Task Handler
 * Handles Dungeon Master tasks: narration, dialogue, game events
 */
const logger = require('../utils/logger');

// DM response templates
const templates = {
    attack: [
        "The {target} takes {damage} damage!",
        "Your strike hits the {target} for {damage} points!",
        "The {target} reels from your attack, taking {damage} damage!"
    ],
    heal: [
        "A warm glow surrounds {target}, restoring {health} HP!",
        "{target} feels rejuvenated, gaining {health} hit points!",
        "Healing energy flows through {target}, restoring {health} HP!"
    ],
    discovery: [
        "You discover {item}!",
        "You found {item}!",
        "Your careful search reveals {item}!"
    ],
    encounter: [
        "A {enemy} appears!",
        "{enemy} blocks your path!",
        "Suddenly, {enemy} emerges from the shadows!"
    ]
};

async function handleDM(task, stateManager, context) {
    logger.info('Handling dm task');
    
    const { action, target, params } = task.payload || {};
    
    // Route to specific handlers
    switch (action) {
        case 'attack':
            return handleAttack(target, params, stateManager);
        case 'heal':
            return handleHeal(target, params, stateManager);
        case 'narrate':
            return handleNarrateDM(target, params, stateManager);
        case 'dialogue':
            return handleDialogue(target, params, stateManager);
        case 'event':
            return handleGameEvent(target, params, stateManager);
        default:
            return {
                success: false,
                error: `Unknown DM action: ${action}`
            };
    }
}

async function handleAttack(target, params, stateManager) {
    const damage = params?.damage || 10;
    const template = templates.attack[Math.floor(Math.random() * templates.attack.length)];
    const narration = template.replace('{target}', target).replace('{damage}', damage);
    
    return {
        success: true,
        narration,
        action: 'attack',
        target,
        damage,
        timestamp: Date.now()
    };
}

async function handleHeal(target, params, stateManager) {
    const health = params?.health || 20;
    const template = templates.heal[Math.floor(Math.random() * templates.heal.length)];
    const narration = template.replace('{target}', target).replace('{health}', health);
    
    return {
        success: true,
        narration,
        action: 'heal',
        target,
        healthRestored: health,
        timestamp: Date.now()
    };
}

async function handleNarrateDM(scene, params, stateManager) {
    const { description, mood } = params || {};
    
    // Get current world state for context
    const world = stateManager.getWorldState();
    
    const narration = description || "The adventure continues...";
    
    // Log the narration event
    const worldUpdates = {
        events: world.events || []
    };
    worldUpdates.events.push({
        type: 'narration',
        content: narration,
        mood: mood || 'neutral',
        timestamp: Date.now()
    });
    
    // Keep only last 50 events
    if (worldUpdates.events.length > 50) {
        worldUpdates.events = worldUpdates.events.slice(-50);
    }
    
    stateManager.updateWorldState(worldUpdates);
    
    return {
        success: true,
        narration,
        mood: mood || 'neutral',
        tick: world.tick,
        timestamp: Date.now()
    };
}

async function handleDialogue(character, params, stateManager) {
    const { message, emotion } = params || {};
    
    return {
        success: true,
        character,
        dialogue: message || "...",
        emotion: emotion || 'neutral',
        timestamp: Date.now()
    };
}

async function handleGameEvent(eventType, params, stateManager) {
    const world = stateManager.getWorldState();
    
    const event = {
        type: eventType,
        params: params || {},
        timestamp: Date.now()
    };
    
    // Add to world events
    const events = world.events || [];
    events.push(event);
    
    if (events.length > 50) {
        events.shift();
    }
    
    stateManager.updateWorldState({ events });
    
    return {
        success: true,
        event: eventType,
        timestamp: Date.now()
    };
}

// Export the main handler (for compatibility)
async function handleNarrate(task, stateManager, context) {
    return handleDM(task, stateManager, context);
}

module.exports = {
    handleDM,
    handleNarrate
};