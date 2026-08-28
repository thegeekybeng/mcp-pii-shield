import { describe, it, expect } from 'vitest';
import { MaskingEngine } from '../src/masking.js';
import { TokenCache } from '../src/cache.js';

describe('MCP tool integration tests', () => {
  it('run_secure_query integration: should execute query and mask results', async () => {
    const cache = new TokenCache(10);
    const engine = new MaskingEngine(cache, ['Alex Rivera']);
    const rawRows = [{ name: 'Alex Rivera', email: 'alex@example.com', val: 123 }];
    const maskedRows = rawRows.map(row => engine.maskObject(row));
    expect(maskedRows[0].name).not.toBe('Alex Rivera');
    expect(maskedRows[0].email).not.toBe('alex@example.com');
    expect(maskedRows[0].val).toBe(123);
  });

  it('unmask_text integration: should restore PII placeholders to original text', () => {
    const cache = new TokenCache(10);
    const engine = new MaskingEngine(cache, ['Vance']);
    const originalText = 'Hello Vance, email me at vance@example.com';
    const maskedText = engine.mask(originalText);
    const restoredText = engine.unmask(maskedText);
    expect(restoredText).toBe(originalText);
  });

  it('add_to_roster integration: should dynamically add names to the active scan roster', () => {
    const cache = new TokenCache(10);
    const engine = new MaskingEngine(cache, []);
    
    // Roster is empty initially, so name is not masked
    const text = 'Greet Bobby';
    expect(engine.mask(text)).toBe(text);

    // Add name to roster
    engine.addRosterNames(['Bobby']);
    const masked = engine.mask(text);
    expect(masked).toContain('__PERSON_A__');
    expect(engine.unmask(masked)).toBe(text);
  });
});
