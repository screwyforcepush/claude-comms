import { ConvexError } from '../convex-client.js';
/**
 * Allowed feedback status values
 * Centralized enum for consistency across tool definitions and handlers
 */
export const ALLOWED_STATUSES = ['pending', 'active', 'review', 'resolved', 'rejected'];
/**
 * 5-State Status Model (Streamlined - No Legacy Aliases)
 * Database contains: pending, active, review, resolved, rejected
 * Schema enforces: pending | active | review | resolved | rejected
 */
export function normalizeStatusFromConvex(status) {
    // Direct mapping - no aliases needed
    if (ALLOWED_STATUSES.includes(status)) {
        return status;
    }
    // Default to pending for any invalid/missing values
    return 'pending';
}
export function mapStatusToConvex(status) {
    // Direct pass-through - schema enforces correct values
    return status;
}
export function normalizeLimit(limit) {
    if (!Number.isFinite(limit) || limit === undefined || limit === null) {
        return 50;
    }
    const normalized = Math.trunc(limit);
    if (normalized <= 0) {
        return 50;
    }
    return Math.min(normalized, 100);
}
export function createSuccessResult(payload) {
    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify(payload, null, 2),
            },
        ],
        isError: false,
    };
}
export function createErrorResult(message) {
    return {
        content: [
            {
                type: 'text',
                text: message,
            },
        ],
        isError: true,
    };
}
export function extractConvexErrorMessage(error, fallback) {
    if (error instanceof ConvexError) {
        return error.message;
    }
    if (error instanceof Error) {
        return error.message;
    }
    return fallback;
}
export function normalizeFeedbackRecord(record) {
    return {
        _id: record._id,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt ?? null,
        url: record.url,
        note: record.note ?? null,
        status: normalizeStatusFromConvex(record.status),
    };
}
//# sourceMappingURL=common.js.map