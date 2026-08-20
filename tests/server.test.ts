import { describe, it, expect } from 'vitest';
import { MaskingEngine } from '../src/masking.js';
import { TokenCache } from '../src/cache.js';

describe('MCP tool integration tests', () => {
  it('should verify unmasking roundtrip matches original data', () => {
    const cache = new TokenCache(10);
    const engine = new MaskingEngine(cache, ['Vance']);
    const masked = engine.mask('Hello Vance');
    const restored = engine.unmask(masked);
    expect(restored).toBe('Hello Vance');
  });
});
