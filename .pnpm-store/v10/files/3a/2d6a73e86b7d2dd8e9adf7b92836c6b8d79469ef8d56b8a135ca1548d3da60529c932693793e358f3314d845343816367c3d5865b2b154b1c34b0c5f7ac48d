import { ConvexError } from '../convex-client.js';
import { ALLOWED_STATUSES, createErrorResult, createSuccessResult, mapStatusToConvex, normalizeFeedbackRecord, normalizeLimit, } from './common.js';
async function fetchRecords(client, input, limit) {
    const project = client.project?.trim();
    const baseArgs = { limit };
    if (project) {
        baseArgs.project = project;
    }
    if (input.status) {
        const convexStatus = mapStatusToConvex(input.status);
        return client.query('feedback:listByStatus', {
            ...baseArgs,
            status: convexStatus,
        });
    }
    return client.query('feedback:listByFilters', baseArgs);
}
export const listToolHandler = async (client, input) => {
    if (input.status && !ALLOWED_STATUSES.includes(input.status)) {
        return createErrorResult(`Invalid status "${input.status}". Status must be one of: ${ALLOWED_STATUSES.join(', ')}.`);
    }
    const limit = normalizeLimit(input.limit);
    try {
        const rawRecords = await fetchRecords(client, input, limit);
        const rawArray = Array.isArray(rawRecords) ? rawRecords : [];
        const normalizedRecords = rawArray.map(normalizeFeedbackRecord);
        return createSuccessResult(normalizedRecords);
    }
    catch (error) {
        const message = error instanceof ConvexError ? error.message : 'Unknown error listing feedback.';
        return createErrorResult(`Failed to list feedback: ${message}`);
    }
};
//# sourceMappingURL=list.js.map