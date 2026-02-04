import { ConvexError } from '../convex-client.js';
import { ALLOWED_STATUSES, createErrorResult, createSuccessResult, mapStatusToConvex, } from './common.js';
export const updateToolHandler = async (client, input) => {
    const feedbackId = input.feedbackId?.trim();
    const rawStatus = input.status;
    if (!feedbackId) {
        return createErrorResult('feedbackId is required and must be a non-empty string.');
    }
    if (!rawStatus || !ALLOWED_STATUSES.includes(rawStatus)) {
        return createErrorResult(`Invalid status "${rawStatus}". Status must be one of: ${ALLOWED_STATUSES.join(', ')}.`);
    }
    const convexStatus = mapStatusToConvex(rawStatus);
    try {
        await client.mutation('feedback:updateStatus', {
            feedbackId,
            status: convexStatus,
        });
        return createSuccessResult({
            success: true,
            message: `Feedback ${feedbackId} successfully updated to ${rawStatus}.`,
        });
    }
    catch (error) {
        const message = error instanceof ConvexError ? error.message : 'Unknown error updating feedback.';
        return createErrorResult(`Failed to update feedback: ${message}`);
    }
};
//# sourceMappingURL=update.js.map