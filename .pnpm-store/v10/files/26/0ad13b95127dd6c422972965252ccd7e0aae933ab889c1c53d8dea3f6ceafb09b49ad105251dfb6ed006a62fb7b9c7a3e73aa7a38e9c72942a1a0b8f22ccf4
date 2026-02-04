/**
 * ConvexClient - HTTP API Wrapper for Convex
 *
 * Pure HTTP client for calling Convex queries and mutations without the Convex SDK.
 * Designed for use in MCP servers where the full SDK is not needed.
 *
 * Architecture:
 * - Zero business logic (pure HTTP wrapper)
 * - No Convex SDK dependency
 * - Optional authentication via AGENT_SECRET header
 * - Comprehensive error handling with actionable messages
 */
/**
 * Error thrown when a Convex API call fails
 */
export declare class ConvexError extends Error {
    readonly statusCode?: number | undefined;
    readonly response?: unknown | undefined;
    constructor(message: string, statusCode?: number | undefined, response?: unknown | undefined);
}
/**
 * Options for configuring the ConvexClient
 */
export interface ConvexClientOptions {
    /**
     * Base URL of the Convex deployment (e.g., "https://your-deployment.convex.cloud")
     */
    convexUrl: string;
    /**
     * Optional authentication secret for agent access
     * Set via AGENT_SECRET environment variable
     */
    agentSecret?: string;
    /**
     * Optional project identifier to scope all feedback queries
     * Set via PROJECT environment variable
     */
    project?: string;
    /**
     * Request timeout in milliseconds (default: 30000)
     */
    timeout?: number;
}
/**
 * HTTP client for Convex backend operations
 *
 * Provides query and mutation methods that communicate with Convex via HTTP API.
 * Uses JSON-RPC format for all requests.
 *
 * @example
 * ```typescript
 * const client = new ConvexClient({
 *   convexUrl: 'https://your-deployment.convex.cloud',
 *   agentSecret: process.env.AGENT_SECRET
 * });
 *
 * // Query feedback records
 * const records = await client.query('feedback:listByStatus', {
 *   status: 'pending',
 *   limit: 10
 * });
 *
 * // Update feedback status
 * await client.mutation('feedback:updateStatus', {
 *   feedbackId: 'px77r379s6hj6r3krxk0zw43z97smtn1',
 *   status: 'review'
 * });
 * ```
 */
export declare class ConvexClient {
    private readonly convexUrl;
    private readonly agentSecret?;
    private readonly _project?;
    private readonly timeout;
    constructor(options: ConvexClientOptions);
    /**
     * Get the configured project identifier (if set)
     */
    get project(): string | undefined;
    /**
     * Execute a Convex query via HTTP API
     *
     * Queries are read-only operations that retrieve data from the database.
     * They are executed via POST to /api/query endpoint.
     *
     * @param path - Convex function path (e.g., "feedback:listByStatus")
     * @param args - Function arguments as key-value pairs
     * @returns Query result (type depends on the specific query)
     *
     * @throws {ConvexError} If the request fails or returns an error
     *
     * @example
     * ```typescript
     * const pending = await client.query('feedback:listByStatus', {
     *   status: 'pending',
     *   limit: 50
     * });
     * ```
     */
    query<TResult = unknown>(path: string, args?: Record<string, unknown>): Promise<TResult>;
    /**
     * Execute a Convex mutation via HTTP API
     *
     * Mutations are write operations that modify data in the database.
     * They are executed via POST to /api/mutation endpoint.
     *
     * @param path - Convex function path (e.g., "feedback:updateStatus")
     * @param args - Function arguments as key-value pairs
     * @returns Mutation result (type depends on the specific mutation)
     *
     * @throws {ConvexError} If the request fails or returns an error
     *
     * @example
     * ```typescript
     * await client.mutation('feedback:updateStatus', {
     *   feedbackId: 'px77r379s6hj6r3krxk0zw43z97smtn1',
     *   status: 'resolved'
     * });
     * ```
     */
    mutation<TResult = unknown>(path: string, args?: Record<string, unknown>): Promise<TResult>;
    /**
     * Internal method for making HTTP requests to Convex
     *
     * Handles:
     * - URL construction
     * - Request headers (Content-Type, Authentication)
     * - Timeout management
     * - Response parsing
     * - Error handling and mapping
     *
     * @private
     */
    private request;
}
/**
 * Create a ConvexClient instance from environment variables
 *
 * Reads configuration from:
 * - CONVEX_URL (required): Convex deployment URL
 * - AGENT_SECRET (optional): Authentication secret
 * - PROJECT (optional): Project identifier to scope feedback queries
 * - CONVEX_TIMEOUT (optional): Request timeout in milliseconds
 *
 * @returns Configured ConvexClient instance
 * @throws {ConvexError} If CONVEX_URL is not set
 *
 * @example
 * ```typescript
 * // In your MCP server
 * const client = createConvexClientFromEnv();
 * const feedback = await client.query('feedback:list', { limit: 10 });
 * ```
 */
export declare function createConvexClientFromEnv(): ConvexClient;
