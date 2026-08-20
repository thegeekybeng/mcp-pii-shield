import { describe, it, expect, vi } from 'vitest';
import { TokenCache } from '../src/cache.js';

describe('TokenCache', () => {
  it('should store and retrieve tokens', () => {
    const cache = new TokenCache(10);
    cache.set('__PERSON_A__', 'Tommy');
    expect(cache.get('__PERSON_A__')).toBe('Tommy');
  });

  it('should automatically clear entries after TTL', async () => {
    vi.useFakeTimers();
    const cache = new TokenCache(1); // 1 second TTL
    cache.set('__EMAIL_1__', 'test@test.com');
    expect(cache.get('__EMAIL_1__')).toBe('test@test.com');
    
    vi.advanceTimersByTime(1100);
    expect(cache.get('__EMAIL_1__')).toBeUndefined();
    vi.useRealTimers();
  });
});
