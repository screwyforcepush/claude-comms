import { describe, expect, it, vi } from 'vitest';
import { ConvexError } from '../convex-client.js';
import { listToolHandler } from './list.js';
const createMockClient = (project) => ({
    query: vi.fn(),
    project,
});
describe('list tool handler', () => {
    it('maps status filter to backend values and formats output', async () => {
        const mockClient = createMockClient();
        const querySpy = mockClient.query;
        querySpy.mockResolvedValue([
            {
                _id: 'feedback_1',
                createdAt: 123,
                url: 'https://example.com',
                route: '/dashboard',
                path: null,
                note: 'Check dashboard charts',
                screenshotUrl: 'https://convex.storage/screenshot.png',
                status: 'review',
                viewport: { width: 1280, height: 720 },
                ua: 'Chrome',
                releaseId: null,
                env: 'staging',
                project: 'acme-app',
                flags: ['beta'],
            },
        ]);
        const result = await listToolHandler(mockClient, { status: 'review' });
        expect(querySpy).toHaveBeenCalledWith('feedback:listByStatus', expect.objectContaining({
            status: 'review',
            limit: 50,
        }));
        expect(result).toMatchObject({
            content: [
                {
                    type: 'text',
                    text: expect.any(String),
                },
            ],
            isError: false,
        });
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed).toHaveLength(1);
        expect(parsed[0]).toMatchObject({
            _id: 'feedback_1',
            status: 'review',
            note: 'Check dashboard charts',
            url: 'https://example.com',
        });
    });
    it('scopes list queries by configured project', async () => {
        const mockClient = createMockClient('acme-app');
        const querySpy = mockClient.query;
        querySpy.mockResolvedValue([
            {
                _id: 'feedback_1',
                createdAt: 123,
                url: 'https://example.com',
                status: 'pending',
                project: 'acme-app',
            },
        ]);
        const result = await listToolHandler(mockClient, {});
        expect(querySpy).toHaveBeenCalledWith('feedback:listByFilters', {
            limit: 50,
            project: 'acme-app',
        });
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed).toEqual([
            {
                _id: 'feedback_1',
                createdAt: 123,
                updatedAt: null,
                url: 'https://example.com',
                note: null,
                status: 'pending',
            },
        ]);
    });
    it('caps limit at 100 to guard against large fetches', async () => {
        const mockClient = createMockClient();
        const querySpy = mockClient.query;
        querySpy.mockResolvedValue([]);
        await listToolHandler(mockClient, { limit: 250 });
        expect(querySpy).toHaveBeenCalledWith('feedback:listByFilters', { limit: 100 });
    });
    it('returns MCP error payload when status filter is invalid', async () => {
        const mockClient = createMockClient();
        const querySpy = mockClient.query;
        const result = await listToolHandler(mockClient, { status: 'invalid' });
        expect(querySpy).not.toHaveBeenCalled();
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toMatch(/status must be one of/i);
    });
    it('propagates Convex errors into MCP error payloads', async () => {
        const mockClient = createMockClient();
        const querySpy = mockClient.query;
        querySpy.mockRejectedValue(new ConvexError('network failure', 500));
        const result = await listToolHandler(mockClient, {});
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toMatch(/network failure/);
    });
});
//# sourceMappingURL=list.test.js.map