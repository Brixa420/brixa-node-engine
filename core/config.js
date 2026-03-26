/**
 * Config - Node configuration
 */
module.exports = {
    node: {
        port: 3000,
        role: 'general',
        logLevel: 'INFO'
    },
    network: {
        heartbeatInterval: 30000,
        peerTimeout: 5000
    },
    router: {
        loadThreshold: 70 // CPU % threshold for forwarding
    },
    state: {
        saveInterval: 60000 // Save state every 60 seconds
    }
};