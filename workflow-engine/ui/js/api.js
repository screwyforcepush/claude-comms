// Convex API references
// Since we're not using codegen, we create function references manually

/**
 * API reference for Convex queries and mutations
 * Uses string-based function references that work with ConvexClient
 */
export const api = {
  scheduler: {
    // Get queue status for a namespace (metrics)
    getQueueStatus: "scheduler:getQueueStatus",

    // Watch queue - get non-complete assignments with job chains
    watchQueue: "scheduler:watchQueue",

    // Get ALL assignments with job chains (D2: includes complete)
    getAllAssignments: "scheduler:getAllAssignments",

    // Get all namespaces with stats
    getAllNamespaces: "scheduler:getAllNamespaces",

    // Get ready jobs (for runners)
    getReadyJobs: "scheduler:getReadyJobs"
  },

  // Assignments API (for guardian mode)
  assignments: {
    // List assignments for a namespace
    list: "assignments:list",
    // Get assignment by ID
    get: "assignments:get",
  },

  // Chat threads API
  chatThreads: {
    // List all threads for a namespace
    list: "chatThreads:list",
    // Get a single thread by ID
    get: "chatThreads:get",
    // Create a new thread
    create: "chatThreads:create",
    // Update thread mode (jam/cook)
    updateMode: "chatThreads:updateMode",
    // Update thread title
    updateTitle: "chatThreads:updateTitle",
    // Delete a thread
    remove: "chatThreads:remove"
  },

  // Chat messages API
  chatMessages: {
    // List messages for a thread
    list: "chatMessages:list",
    // Add a message to a thread
    add: "chatMessages:add"
  },

  // Chat jobs API - LEGACY, kept for future cook mode conversion only
  chatJobs: {
    // LEGACY: Convert chat thread to assignment+job (creates assignment + job)
    // NOTE: DO NOT use for normal chat - use chatActions.sendMessage instead
    // This is for future "Convert to Assignment" feature (cook mode explicit conversion)
    trigger: "chatJobs:trigger",
    // Get active (pending/running) chat job for typing indicator
    getActiveForThread: "chatJobs:getActiveForThread"
  },

};

// Status color mappings for consistent styling
export const statusColors = {
  pending: 'bg-yellow-500',
  active: 'bg-blue-500',
  blocked: 'bg-red-500',
  complete: 'bg-green-500',
  running: 'bg-purple-500',
  failed: 'bg-red-600',
};

export const statusTextColors = {
  pending: 'text-yellow-400',
  active: 'text-blue-400',
  blocked: 'text-red-400',
  complete: 'text-green-400',
  running: 'text-purple-400',
  failed: 'text-red-500',
};

export const statusBorderColors = {
  pending: 'border-yellow-500',
  active: 'border-blue-500',
  blocked: 'border-red-500',
  complete: 'border-green-500',
  running: 'border-purple-500',
  failed: 'border-red-600',
};
