import { ConvexError } from '../convex-client.js';
import { createErrorResult, normalizeFeedbackRecord, } from './common.js';
const FALLBACK_LIST_LIMIT = 200;
function isFallbackAllowed(error) {
    if (error instanceof ConvexError) {
        if (/feedback not found/i.test(error.message)) {
            return true;
        }
        if (error.statusCode === 404) {
            return true;
        }
        // Convex returns error for unknown/missing function paths
        if (/could not find public function/i.test(error.message)) {
            return true;
        }
        // Convex returns 400 for unknown function paths
        if (error.statusCode === 400 && /unknown function/i.test(error.message)) {
            return true;
        }
    }
    return false;
}
async function fetchViaGet(client, feedbackId) {
    try {
        const record = await client.query('feedback:get', { feedbackId });
        if (!record || typeof record !== 'object' || Array.isArray(record)) {
            return null;
        }
        return record;
    }
    catch (error) {
        if (isFallbackAllowed(error)) {
            return null;
        }
        throw error;
    }
}
async function fetchViaList(client, feedbackId) {
    const payload = {
        limit: FALLBACK_LIST_LIMIT,
    };
    const project = client.project?.trim();
    if (project) {
        payload.project = project;
    }
    const records = await client.query('feedback:listByFilters', payload);
    if (!Array.isArray(records)) {
        return null;
    }
    return records.find((record) => record._id === feedbackId) ?? null;
}
export const getToolHandler = async (client, input) => {
    const feedbackId = input.feedbackId?.trim();
    if (!feedbackId) {
        return createErrorResult('feedbackId is required and must be a non-empty string.');
    }
    try {
        const record = (await fetchViaGet(client, feedbackId)) ?? (await fetchViaList(client, feedbackId));
        if (!record) {
            return createErrorResult(`Feedback record "${feedbackId}" not found.`);
        }
        const normalized = normalizeFeedbackRecord(record);
        // Fetch screenshot and convert to base64 (from raw record, not exposed in normalized)
        let screenshotBase64 = '';
        if (record.screenshotUrl) {
            try {
                const response = await fetch(record.screenshotUrl);
                if (response.ok) {
                    const buffer = await response.arrayBuffer();
                    screenshotBase64 = Buffer.from(buffer).toString('base64');
                }
            }
            catch (error) {
                // If screenshot fetch fails, continue without it
                console.error('Failed to fetch screenshot:', error);
            }
        }
        // Return both metadata (as text) and image (as image content)
        const content = [
            {
                type: 'text',
                text: JSON.stringify(normalized, null, 2),
            },
        ];
        // Add screenshot as image content if available
        if (screenshotBase64) {
            content.push({
                type: 'image',
                data: screenshotBase64,
                mimeType: 'image/png',
            });
        }
        return {
            content,
            isError: false,
        };
    }
    catch (error) {
        const message = error instanceof ConvexError ? error.message : 'Unknown error fetching feedback.';
        return createErrorResult(`Failed to fetch feedback: ${message}`);
    }
};
//# sourceMappingURL=get.js.map