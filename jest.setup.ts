import '@testing-library/jest-dom';

process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';

const mockFetch = jest.fn(async () => ({
  ok: true,
  status: 200,
  json: async () => ({ output_text: 'Mock output\n\nReferences:\n- [citation:1] Example' }),
  text: async () => 'ok',
}));

// Provide a default fetch mock for tests that invoke OpenAI calls.
// Individual tests can override this as needed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).fetch = mockFetch;
