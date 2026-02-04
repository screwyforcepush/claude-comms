import { describe, expect, it, vi } from 'vitest';
import { ConvexError } from '../convex-client.js';
import { getToolHandler } from './get.js';
const createMockClient = () => ({
    query: vi.fn(),
});
describe('get tool handler', () => {
    it('queries Convex feedback:get and returns formatted record', async () => {
        const mockClient = createMockClient();
        const querySpy = mockClient.query;
        querySpy.mockResolvedValue({
            _id: 'feedback_1',
            createdAt: 100,
            url: 'https://example.com',
            note: 'Please fix chart',
            screenshotUrl: 'url',
            overlayJSON: '{}',
            status: 'review',
            updatedAt: 200,
            resolvedAt: null,
        });
        const result = await getToolHandler(mockClient, { feedbackId: 'feedback_1' });
        expect(querySpy).toHaveBeenCalledWith('feedback:get', { feedbackId: 'feedback_1' });
        expect(result).toMatchObject({
            content: [{ type: 'text', text: expect.any(String) }],
            isError: false,
        });
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed).toMatchObject({
            _id: 'feedback_1',
            status: 'review',
            note: 'Please fix chart',
            url: 'https://example.com',
        });
    });
    it('falls back to feedback:list when feedback:get is unavailable', async () => {
        const mockClient = createMockClient();
        const querySpy = mockClient.query;
        querySpy
            .mockRejectedValueOnce(new ConvexError('Function not found', 404))
            .mockResolvedValueOnce([
            { _id: 'feedback_2', createdAt: 111, url: 'https://example.com', screenshotUrl: 'url', overlayJSON: '{}', status: 'pending' },
            { _id: 'feedback_1', createdAt: 100, url: 'https://example.com', screenshotUrl: 'url', overlayJSON: '{}', status: 'resolved' },
        ]);
        const result = await getToolHandler(mockClient, { feedbackId: 'feedback_1' });
        expect(querySpy).toHaveBeenNthCalledWith(1, 'feedback:get', { feedbackId: 'feedback_1' });
        expect(querySpy).toHaveBeenNthCalledWith(2, 'feedback:listByFilters', { limit: 200 });
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed).toMatchObject({
            _id: 'feedback_1',
            status: 'resolved',
        });
    });
    it('returns error payload when feedback is not found', async () => {
        const mockClient = createMockClient();
        const querySpy = mockClient.query;
        querySpy.mockResolvedValue([]);
        const result = await getToolHandler(mockClient, { feedbackId: 'missing' });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toMatch(/not found/i);
    });
    it('validates feedbackId input', async () => {
        const mockClient = createMockClient();
        const result = await getToolHandler(mockClient, { feedbackId: '' });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toMatch(/feedbackId is required/i);
    });
});
//# sourceMappingURL=get.test.js.map