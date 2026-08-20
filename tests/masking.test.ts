import { describe, it, expect } from 'vitest';
import { MaskingEngine } from '../src/masking.js';
import { TokenCache } from '../src/cache.js';

describe('MaskingEngine', () => {
  const cache = new TokenCache(60);
  const roster = ['Alex Rivera', 'Sarah Jenkins'];
  const engine = new MaskingEngine(cache, roster);

  it('should mask names, emails, and phones', () => {
    const text = 'Hello Alex Rivera, email me at alex@example.com or call 555-123-4567.';
    const masked = engine.mask(text);
    
    expect(masked).toContain('__PERSON_A__');
    expect(masked).toContain('__EMAIL_1__');
    expect(masked).toContain('__PHONE_1__');
  });

  it('should restore original text', () => {
    const text = 'Hello Alex Rivera, email me at alex@example.com.';
    const masked = engine.mask(text);
    const restored = engine.unmask(masked);
    expect(restored).toBe(text);
  });

  it('should perform schema-based masking on objects', () => {
    const row = {
      name: 'Alex Rivera',
      email: 'alex@example.com',
      salary: 5000
    };
    const masked = engine.maskObject(row);
    expect(masked.name).toBeDefined();
    expect(masked.name).not.toBe('Alex Rivera');
    expect(masked.email).toBeDefined();
    expect(masked.email).not.toBe('alex@example.com');
    expect(masked.salary).toBe(5000);
  });
});
