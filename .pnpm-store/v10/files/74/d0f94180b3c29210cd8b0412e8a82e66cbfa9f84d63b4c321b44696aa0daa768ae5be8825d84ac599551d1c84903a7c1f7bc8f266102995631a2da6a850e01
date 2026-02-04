/**
 * Unit tests for ConvexClient
 *
 * Tests cover:
 * - Successful query/mutation operations
 * - Error handling (network, HTTP, timeout, parsing)
 * - Authentication with AGENT_SECRET
 * - URL validation and normalization
 * - Environment variable configuration
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConvexClient, ConvexError, createConvexClientFromEnv } from './convex-client.js';
// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;
describe('ConvexClient', () => {
    const validUrl = 'https://test-deployment.convex.cloud';
    const mockResponse = { data: 'test-result' };
    beforeEach(() => {
        mockFetch.mockClear();
        vi.clearAllTimers();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });
    describe('Constructor', () => {
        it('creates client with valid URL', () => {
            const client = new ConvexClient({ convexUrl: validUrl });
            expect(client).toBeInstanceOf(ConvexClient);
        });
        it('removes trailing slash from URL', () => {
            const client = new ConvexClient({ convexUrl: 'https://test.convex.cloud/' });
            expect(client).toBeInstanceOf(ConvexClient);
        });
        it('throws error when convexUrl is empty', () => {
            expect(() => new ConvexClient({ convexUrl: '' })).toThrow(ConvexError);
            expect(() => new ConvexClient({ convexUrl: '' })).toThrow('ConvexClient requires a convexUrl');
        });
        it('throws error when convexUrl is invalid', () => {
            expect(() => new ConvexClient({ convexUrl: 'not-a-url' })).toThrow(ConvexError);
            expect(() => new ConvexClient({ convexUrl: 'not-a-url' })).toThrow('Invalid convexUrl format');
        });
        it('accepts optional agentSecret', () => {
            const client = new ConvexClient({
                convexUrl: validUrl,
                agentSecret: 'test-secret',
            });
            expect(client).toBeInstanceOf(ConvexClient);
        });
        it('accepts custom timeout', () => {
            const client = new ConvexClient({
                convexUrl: validUrl,
                timeout: 5000,
            });
            expect(client).toBeInstanceOf(ConvexClient);
            expect(client.timeout).toBe(5000);
        });
        it('uses default timeout of 30000ms when not specified', () => {
            const client = new ConvexClient({ convexUrl: validUrl });
            expect(client).toBeInstanceOf(ConvexClient);
            expect(client.timeout).toBe(30000);
        });
    });
    describe('query()', () => {
        it('makes POST request to /api/query endpoint', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mockResponse,
            });
            const client = new ConvexClient({ convexUrl: validUrl });
            await client.query('feedback:list', { limit: 10 });
            expect(mockFetch).toHaveBeenCalledWith(`${validUrl}/api/query`, expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    'Content-Type': 'application/json',
                }),
            }));
        });
        it('sends path and args in request body', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mockResponse,
            });
            const client = new ConvexClient({ convexUrl: validUrl });
            const args = { status: 'pending', limit: 50 };
            await client.query('feedback:listByStatus', args);
            const callArgs = mockFetch.mock.calls[0];
            const body = JSON.parse(callArgs[1]?.body);
            expect(body).toEqual({
                path: 'feedback:listByStatus',
                args,
            });
        });
        it('returns parsed JSON response', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mockResponse,
            });
            const client = new ConvexClient({ convexUrl: validUrl });
            const result = await client.query('feedback:list');
            expect(result).toEqual(mockResponse);
        });
        it('handles empty args parameter', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mockResponse,
            });
            const client = new ConvexClient({ convexUrl: validUrl });
            await client.query('feedback:pathsWithCounts');
            const callArgs = mockFetch.mock.calls[0];
            const body = JSON.parse(callArgs[1]?.body);
            expect(body.args).toEqual({});
        });
        it('includes Authorization header when agentSecret provided', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mockResponse,
            });
            const client = new ConvexClient({
                convexUrl: validUrl,
                agentSecret: 'test-secret-123',
            });
            await client.query('feedback:list');
            expect(mockFetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: 'Bearer test-secret-123',
                }),
            }));
        });
        it('does not include Authorization header when agentSecret not provided', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mockResponse,
            });
            const client = new ConvexClient({ convexUrl: validUrl });
            await client.query('feedback:list');
            const callArgs = mockFetch.mock.calls[0];
            const headers = callArgs[1]?.headers;
            expect(headers.Authorization).toBeUndefined();
        });
    });
    describe('mutation()', () => {
        it('makes POST request to /api/mutation endpoint', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => null,
            });
            const client = new ConvexClient({ convexUrl: validUrl });
            await client.mutation('feedback:updateStatus', {
                feedbackId: 'test-id',
                status: 'resolved',
            });
            expect(mockFetch).toHaveBeenCalledWith(`${validUrl}/api/mutation`, expect.objectContaining({
                method: 'POST',
            }));
        });
        it('sends path and args in request body', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => null,
            });
            const client = new ConvexClient({ convexUrl: validUrl });
            const args = { feedbackId: 'px77r379s6hj6r3krxk0zw43z97smtn1', status: 'review' };
            await client.mutation('feedback:updateStatus', args);
            const callArgs = mockFetch.mock.calls[0];
            const body = JSON.parse(callArgs[1]?.body);
            expect(body).toEqual({
                path: 'feedback:updateStatus',
                args,
            });
        });
        it('returns mutation result', async () => {
            const mutationResult = { success: true, message: 'Updated' };
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mutationResult,
            });
            const client = new ConvexClient({ convexUrl: validUrl });
            const result = await client.mutation('feedback:updateStatus', {
                feedbackId: 'test-id',
                status: 'resolved',
            });
            expect(result).toEqual(mutationResult);
        });
    });
    describe('Error Handling', () => {
        describe('HTTP Status Errors', () => {
            it('throws ConvexError with actionable message for 401 Unauthorized', async () => {
                mockFetch.mockResolvedValue({
                    ok: false,
                    status: 401,
                    text: async () => 'Unauthorized',
                });
                const client = new ConvexClient({ convexUrl: validUrl });
                await expect(client.query('feedback:list')).rejects.toThrow(ConvexError);
                await expect(client.query('feedback:list')).rejects.toThrow('Authentication failed');
                await expect(client.query('feedback:list')).rejects.toThrow('AGENT_SECRET');
            });
            it('throws ConvexError with actionable message for 403 Forbidden', async () => {
                mockFetch.mockResolvedValue({
                    ok: false,
                    status: 403,
                    text: async () => 'Forbidden',
                });
                const client = new ConvexClient({ convexUrl: validUrl });
                await expect(client.query('feedback:list')).rejects.toThrow(ConvexError);
                await expect(client.query('feedback:list')).rejects.toThrow('Authentication failed');
            });
            it('throws ConvexError with actionable message for 404 Not Found', async () => {
                mockFetch.mockResolvedValue({
                    ok: false,
                    status: 404,
                    text: async () => 'Not Found',
                });
                const client = new ConvexClient({ convexUrl: validUrl });
                await expect(client.query('feedback:list')).rejects.toThrow(ConvexError);
                await expect(client.query('feedback:list')).rejects.toThrow('Convex deployment not found');
                await expect(client.query('feedback:list')).rejects.toThrow('Verify the URL is correct');
            });
            it('throws ConvexError with actionable message for 500 Server Error', async () => {
                mockFetch.mockResolvedValue({
                    ok: false,
                    status: 500,
                    text: async () => 'Internal Server Error',
                });
                const client = new ConvexClient({ convexUrl: validUrl });
                await expect(client.query('feedback:list')).rejects.toThrow(ConvexError);
                await expect(client.query('feedback:list')).rejects.toThrow('Convex server error');
                await expect(client.query('feedback:list')).rejects.toThrow('temporarily unavailable');
            });
            it('throws ConvexError for other HTTP errors', async () => {
                mockFetch.mockResolvedValue({
                    ok: false,
                    status: 400,
                    text: async () => 'Bad Request',
                });
                const client = new ConvexClient({ convexUrl: validUrl });
                await expect(client.query('feedback:list')).rejects.toThrow(ConvexError);
                await expect(client.query('feedback:list')).rejects.toThrow('status 400');
            });
            it('includes statusCode in ConvexError', async () => {
                mockFetch.mockResolvedValue({
                    ok: false,
                    status: 404,
                    text: async () => 'Not Found',
                });
                const client = new ConvexClient({ convexUrl: validUrl });
                try {
                    await client.query('feedback:list');
                    expect.fail('Should have thrown');
                }
                catch (error) {
                    expect(error).toBeInstanceOf(ConvexError);
                    expect(error.statusCode).toBe(404);
                }
            });
        });
        describe('Response Parsing Errors', () => {
            it('throws ConvexError when response is not valid JSON', async () => {
                mockFetch.mockResolvedValue({
                    ok: true,
                    status: 200,
                    json: async () => {
                        throw new Error('Invalid JSON');
                    },
                });
                const client = new ConvexClient({ convexUrl: validUrl });
                await expect(client.query('feedback:list')).rejects.toThrow(ConvexError);
                await expect(client.query('feedback:list')).rejects.toThrow('Failed to parse Convex response as JSON');
            });
            it('throws ConvexError when response contains error field', async () => {
                mockFetch.mockResolvedValue({
                    ok: true,
                    status: 200,
                    json: async () => ({
                        error: 'ValidationError',
                        message: 'Invalid feedbackId format',
                    }),
                });
                const client = new ConvexClient({ convexUrl: validUrl });
                await expect(client.query('feedback:list')).rejects.toThrow(ConvexError);
                await expect(client.query('feedback:list')).rejects.toThrow('Convex function error');
                await expect(client.query('feedback:list')).rejects.toThrow('Invalid feedbackId format');
            });
            it('uses error field if message not present', async () => {
                mockFetch.mockResolvedValue({
                    ok: true,
                    status: 200,
                    json: async () => ({
                        error: 'SomeError',
                    }),
                });
                const client = new ConvexClient({ convexUrl: validUrl });
                await expect(client.query('feedback:list')).rejects.toThrow('SomeError');
            });
        });
        describe('Network Errors', () => {
            it('throws ConvexError on timeout', async () => {
                const abortError = new Error('AbortError');
                abortError.name = 'AbortError';
                mockFetch.mockRejectedValue(abortError);
                const client = new ConvexClient({ convexUrl: validUrl, timeout: 1000 });
                await expect(client.query('feedback:list')).rejects.toThrow(ConvexError);
                await expect(client.query('feedback:list')).rejects.toThrow('timed out');
            });
            it('throws ConvexError on network failure', async () => {
                mockFetch.mockRejectedValue(new Error('Network request failed'));
                const client = new ConvexClient({ convexUrl: validUrl });
                await expect(client.query('feedback:list')).rejects.toThrow(ConvexError);
                await expect(client.query('feedback:list')).rejects.toThrow('Network error');
            });
            it('throws ConvexError on fetch error', async () => {
                mockFetch.mockRejectedValueOnce(new Error('fetch failed'));
                const client = new ConvexClient({ convexUrl: validUrl });
                await expect(client.query('feedback:list')).rejects.toThrow(ConvexError);
            });
        });
        describe('ConvexError class', () => {
            it('has correct name property', () => {
                const error = new ConvexError('test error');
                expect(error.name).toBe('ConvexError');
            });
            it('stores statusCode when provided', () => {
                const error = new ConvexError('test error', 404);
                expect(error.statusCode).toBe(404);
            });
            it('stores response data when provided', () => {
                const response = { error: 'test', details: 'info' };
                const error = new ConvexError('test error', 400, response);
                expect(error.response).toEqual(response);
            });
            it('extends Error correctly', () => {
                const error = new ConvexError('test error');
                expect(error).toBeInstanceOf(Error);
                expect(error.message).toBe('test error');
            });
        });
    });
    describe('createConvexClientFromEnv()', () => {
        const originalEnv = process.env;
        beforeEach(() => {
            process.env = { ...originalEnv };
        });
        afterEach(() => {
            process.env = originalEnv;
        });
        it('creates client from CONVEX_URL environment variable', () => {
            process.env.CONVEX_URL = validUrl;
            const client = createConvexClientFromEnv();
            expect(client).toBeInstanceOf(ConvexClient);
        });
        it('includes AGENT_SECRET when set', () => {
            process.env.CONVEX_URL = validUrl;
            process.env.AGENT_SECRET = 'env-secret-123';
            const client = createConvexClientFromEnv();
            expect(client).toBeInstanceOf(ConvexClient);
        });
        it('parses CONVEX_TIMEOUT as integer', () => {
            process.env.CONVEX_URL = validUrl;
            process.env.CONVEX_TIMEOUT = '5000.9';
            const client = createConvexClientFromEnv();
            expect(client).toBeInstanceOf(ConvexClient);
            expect(client.timeout).toBe(5000);
        });
        it('falls back to default timeout when CONVEX_TIMEOUT is invalid', () => {
            process.env.CONVEX_URL = validUrl;
            process.env.CONVEX_TIMEOUT = 'not-a-number';
            const client = createConvexClientFromEnv();
            expect(client.timeout).toBe(30000);
        });
        it('falls back to default timeout when CONVEX_TIMEOUT is non-positive', () => {
            process.env.CONVEX_URL = validUrl;
            process.env.CONVEX_TIMEOUT = '0';
            const client = createConvexClientFromEnv();
            expect(client.timeout).toBe(30000);
        });
        it('throws ConvexError when CONVEX_URL not set', () => {
            delete process.env.CONVEX_URL;
            expect(() => createConvexClientFromEnv()).toThrow(ConvexError);
            expect(() => createConvexClientFromEnv()).toThrow('CONVEX_URL environment variable is required');
        });
        it('works with only CONVEX_URL set', () => {
            process.env.CONVEX_URL = validUrl;
            delete process.env.AGENT_SECRET;
            delete process.env.CONVEX_TIMEOUT;
            const client = createConvexClientFromEnv();
            expect(client).toBeInstanceOf(ConvexClient);
        });
    });
    describe('Integration Scenarios', () => {
        it('successfully queries feedback records', async () => {
            const mockFeedback = [
                {
                    _id: 'feedback-1',
                    path: 'button--primary',
                    status: 'pending',
                    note: 'Test feedback',
                },
            ];
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mockFeedback,
            });
            const client = new ConvexClient({ convexUrl: validUrl });
            const result = await client.query('feedback:listByStatus', {
                status: 'pending',
                limit: 10,
            });
            expect(result).toEqual(mockFeedback);
        });
        it('successfully updates feedback status', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => null,
            });
            const client = new ConvexClient({ convexUrl: validUrl });
            await client.mutation('feedback:updateStatus', {
                feedbackId: 'px77r379s6hj6r3krxk0zw43z97smtn1',
                status: 'resolved',
            });
            expect(mockFetch).toHaveBeenCalledTimes(1);
            const callArgs = mockFetch.mock.calls[0];
            expect(callArgs[0]).toBe(`${validUrl}/api/mutation`);
        });
        it('handles authentication flow correctly', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ data: 'authenticated' }),
            });
            const client = new ConvexClient({
                convexUrl: validUrl,
                agentSecret: 'secure-token',
            });
            await client.query('feedback:list');
            const callArgs = mockFetch.mock.calls[0];
            const headers = callArgs[1]?.headers;
            expect(headers.Authorization).toBe('Bearer secure-token');
        });
        it('handles multiple sequential requests', async () => {
            mockFetch
                .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => [{ _id: '1' }],
            })
                .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => null,
            });
            const client = new ConvexClient({ convexUrl: validUrl });
            const queryResult = await client.query('feedback:list');
            expect(queryResult).toEqual([{ _id: '1' }]);
            await client.mutation('feedback:updateStatus', {
                feedbackId: '1',
                status: 'resolved',
            });
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });
    });
});
//# sourceMappingURL=convex-client.test.js.map