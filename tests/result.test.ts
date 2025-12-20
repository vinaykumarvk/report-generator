import { err, isErr, isOk, ok, toResult } from '@/lib/result';

describe('result helpers', () => {
  it('produces ok result', () => {
    const value = ok('data');
    expect(isOk(value)).toBe(true);
    expect(value).toEqual({ ok: true, value: 'data' });
  });

  it('produces err result', () => {
    const failure = err(new Error('fail'));
    expect(isErr(failure)).toBe(true);
    expect(failure.ok).toBe(false);
  });

  it('wraps promise values', async () => {
    const success = await toResult(Promise.resolve(42));
    expect(isOk(success)).toBe(true);

    const failure = await toResult(Promise.reject('oops'));
    expect(isErr(failure)).toBe(true);
  });
});
