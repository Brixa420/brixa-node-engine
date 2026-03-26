/**
 * Quest Task Handler
 * Handles quest generation, updates, and completion
 */
const logger = require('../utils/logger');

async function handleQuest(task, stateManager, context) {
    const { action, questId, params } = task.payload;
    
    logger.info(`Handling quest task: ${action}`);
    
    const world = stateManager.getWorldState();
    
    // Initialize quests if not exist
    if (!world.quests) {
        world.quests = {};
    }
    
    let result;
    
    switch (action) {
        case 'generate':
            // Generate a new quest
            const newQuest = {
                id: questId || `quest_${Date.now()}`,
                title: params?.title || 'New Quest',
                description: params?.description || 'A new adventure awaits!',
                difficulty: params?.difficulty || 'normal',
                rewards: params?.rewards || { gold: 100, xp: 50 },
                objectives: params?.objectives || [],
                status: 'active',
                createdAt: Date.now()
            };
            
            world.quests[newQuest.id] = newQuest;
            result = { quest: newQuest, status: 'created' };
            break;
            
        case 'update':
            // Update existing quest
            if (!state.quests[questId]) {
                throw new Error(`Quest not found: ${questId}`);
            }
            
            const quest = state.quests[questId];
            if (params.status) quest.status = params.status;
            if (params.title) quest.title = params.title;
            if (params.description) quest.description = params.description;
            if (params.objectives) quest.objectives = params.objectives;
            
            quest.updatedAt = Date.now();
            result = { quest, status: 'updated' };
            break;
            
        case 'complete':
            // Mark quest as complete
            if (!state.quests[questId]) {
                throw new Error(`Quest not found: ${questId}`);
            }
            
            state.quests[questId].status = 'completed';
            state.quests[questId].completedAt = Date.now();
            
            result = { 
                questId, 
                status: 'completed',
                rewards: state.quests[questId].rewards
            };
            break;
            
        case 'list':
            // List all quests
            const quests = Object.values(state.quests);
            result = { 
                quests,
                count: quests.length,
                active: quests.filter(q => q.status === 'active').length,
                completed: quests.filter(q => q.status === 'completed').length
            };
            break;
            
        default:
            throw new Error(`Unknown quest action: ${action}`);
    }
    
    stateManager.updateWorldState(world);
    
    return result;
}

module.exports = handleQuest;