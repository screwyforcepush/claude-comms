import { type ConvexClient } from '../convex-client.js';
export type ToolResultContent = {
    type: 'text';
    text: string;
};
export interface ToolResult {
    [x: string]: unknown;
    content: ToolResultContent[];
    isError?: boolean;
}
export type ToolHandler<TInput> = (client: ConvexClient, input: TInput) => Promise<ToolResult>;
/**
 * Allowed feedback status values
 * Centralized enum for consistency across tool definitions and handlers
 */
export declare const ALLOWED_STATUSES: readonly ["pending", "active", "review", "resolved", "rejected"];
export type ToolStatusInput = (typeof ALLOWED_STATUSES)[number];
/**
 * 5-State Status Model (Streamlined - No Legacy Aliases)
 * Database contains: pending, active, review, resolved, rejected
 * Schema enforces: pending | active | review | resolved | rejected
 */
export declare function normalizeStatusFromConvex(status: unknown): ToolStatusInput;
export declare function mapStatusToConvex(status: ToolStatusInput): string;
export declare function normalizeLimit(limit?: number): number;
export declare function createSuccessResult(payload: unknown): ToolResult;
export declare function createErrorResult(message: string): ToolResult;
export declare function extractConvexErrorMessage(error: unknown, fallback: string): string;
export interface RawFeedbackRecord {
    _id: string;
    createdAt: number;
    url: string;
    route?: string | null;
    path?: string | null;
    note?: string | null;
    screenshotUrl?: string | null;
    status?: string | null;
    viewport?: {
        width: number;
        height: number;
    };
    ua?: string | null;
    releaseId?: string | null;
    env?: string | null;
    project?: string | null;
    flags?: string[] | null;
    overlayJSON?: string | null;
    priority?: string | null;
    assignedTo?: string | null;
    updatedAt?: number | null;
    resolvedAt?: number | null;
}
export interface NormalizedFeedbackRecord {
    _id: string;
    createdAt: number;
    updatedAt: number | null;
    url: string;
    note: string | null;
    status: ToolStatusInput;
}
export declare function normalizeFeedbackRecord(record: RawFeedbackRecord): NormalizedFeedbackRecord;
