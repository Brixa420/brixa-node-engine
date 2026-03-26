/**
 * ID Generator - Unique ID creation
 */
let counter = 0;

function generateId(prefix = 'task') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    counter = (counter + 1) % 10000;
    return `${prefix}_${timestamp}_${random}_${counter}`;
}

function generateNodeId() {
    const hostname = require('os').hostname();
    const random = Math.random().toString(36).substring(2, 6);
    return `node-${hostname.split('-').pop()}-${random}`;
}

function generateTaskId() {
    return generateId('task');
}

function generateRequestId() {
    return generateId('req');
}

module.exports = {
    generateId,
    generateNodeId,
    generateTaskId,
    generateRequestId
};