import { TokenCache } from './cache.js';

const COMMON_NAMES = new Set([
  'tommy', 'sarah', 'alex', 'john', 'emma', 'liam', 'olivia', 'noah', 'ava',
  'sophia', 'jackson', 'mia', 'lucas', 'isabella', 'ethan', 'chloe', 'mason',
  'lily', 'logan', 'zoey', 'james', 'grace', 'jacob', 'emily', 'michael', 'abby',
  'ben', 'daniel', 'david', 'william', 'lucy', 'jack', 'henry', 'charlotte',
  'mary', 'robert', 'patricia', 'jennifer', 'linda', 'elizabeth',
  'barbara', 'susan', 'jessica', 'karen', 'nancy', 'lisa', 'betty', 'sandra'
]);

export class MaskingEngine {
  private cache: TokenCache;
  private roster: Set<string>;

  constructor(cache: TokenCache, initialRoster: string[] = []) {
    this.cache = cache;
    this.roster = new Set(initialRoster.map(n => n.trim().toLowerCase()).filter(Boolean));
  }

  public addRosterNames(names: string[]): void {
    names.forEach(name => {
      if (name) this.roster.add(name.trim().toLowerCase());
    });
  }

  public mask(text: string): string {
    const matches: Array<{ term: string; index: number; length: number; type: string }> = [];

    // 1. Roster name matching
    this.roster.forEach(name => {
      const escaped = name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
      let match;
      while ((match = regex.exec(text)) !== null) {
        matches.push({ term: match[0], index: match.index, length: match[0].length, type: 'ROSTER_NAME' });
      }
    });

    // 2. Email matching
    const emailRegex = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
    let emailMatch;
    while ((emailMatch = emailRegex.exec(text)) !== null) {
      matches.push({ term: emailMatch[0], index: emailMatch.index, length: emailMatch[0].length, type: 'EMAIL' });
    }

    // 3. Phone matching
    const phoneRegex = /\b(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
    let phoneMatch;
    while ((phoneMatch = phoneRegex.exec(text)) !== null) {
      matches.push({ term: phoneMatch[0], index: phoneMatch.index, length: phoneMatch[0].length, type: 'PHONE' });
    }

    // 4. Identifier matching
    const idRegex = /\b((?:STU|EMP|ACC|ORD)-\d{5}|[sS]\d{7}[a-zA-Z])\b/gi;
    let idMatch;
    while ((idMatch = idRegex.exec(text)) !== null) {
      matches.push({ term: idMatch[0], index: idMatch.index, length: idMatch[0].length, type: 'IDENTIFIER' });
    }

    // 5. Common names heuristic matching
    const words = text.match(/\b[A-Z][a-z]+\b/g) || [];
    const uniqueWords = [...new Set(words)];
    uniqueWords.forEach(word => {
      if (COMMON_NAMES.has(word.toLowerCase())) {
        const escaped = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, 'g');
        let match;
        while ((match = regex.exec(text)) !== null) {
          matches.push({ term: match[0], index: match.index, length: match[0].length, type: 'NLP_NAME' });
        }
      }
    });

    // Deduplicate and remove overlaps
    const sorted = matches.sort((a, b) => b.length - a.length || a.index - b.index);
    const finalMatches: typeof matches = [];
    sorted.forEach(m => {
      const overlap = finalMatches.some(accepted =>
        m.index < accepted.index + accepted.length && accepted.index < m.index + m.length
      );
      if (!overlap) {
        finalMatches.push(m);
      }
    });
    finalMatches.sort((a, b) => a.index - b.index);

    // Apply pseudonymization
    const termToTokenMap = new Map<string, string>();
    let counters = { person: 0, id: 0, email: 0, phone: 0 };

    finalMatches.forEach(m => {
      const key = m.term.toLowerCase();
      if (!termToTokenMap.has(key)) {
        if (m.type === 'ROSTER_NAME' || m.type === 'NLP_NAME') {
          const char = String.fromCharCode(65 + (counters.person % 26));
          termToTokenMap.set(key, `__PERSON_${char}__`);
          counters.person++;
        } else if (m.type === 'EMAIL') {
          termToTokenMap.set(key, `__EMAIL_${++counters.email}__`);
        } else if (m.type === 'PHONE') {
          termToTokenMap.set(key, `__PHONE_${++counters.phone}__`);
        } else {
          termToTokenMap.set(key, `__ID_${++counters.id}__`);
        }
      }
      const token = termToTokenMap.get(key)!;
      this.cache.set(token, m.term);
    });

    let sanitized = text;
    [...finalMatches].sort((a, b) => b.index - a.index).forEach(m => {
      const token = termToTokenMap.get(m.term.toLowerCase());
      if (token) {
        sanitized = sanitized.substring(0, m.index) + token + sanitized.substring(m.index + m.length);
      }
    });

    return sanitized;
  }

  public maskObject(obj: Record<string, any>): Record<string, any> {
    const piiColumns = new Set(['name', 'first_name', 'last_name', 'email', 'phone', 'nric', 'address', 'contact', 'phone_number']);
    const masked: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (key === '__proto__' || key === 'constructor') {
        continue;
      }
      if (typeof value === 'string') {
        const isPIIColumn = piiColumns.has(key.toLowerCase());
        if (isPIIColumn) {
          const token = this.getOrGenerateToken(key, value);
          masked[key] = token;
        } else {
          masked[key] = this.mask(value);
        }
      } else {
        masked[key] = value;
      }
    }
    return masked;
  }

  public unmask(text: string): string {
    let output = text;
    const tokens = this.cache.getKeys().sort((a, b) => b.length - a.length);

    tokens.forEach(token => {
      const orig = this.cache.get(token);
      if (orig) {
        const escaped = token.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        output = output.replace(new RegExp(escaped, 'g'), orig);
      }
    });
    return output;
  }

  private getOrGenerateToken(columnName: string, value: string): string {
    const cleanCol = columnName.toLowerCase();
    let token = '';
    if (cleanCol.includes('email')) {
      token = `__EMAIL_${Math.floor(Math.random() * 1000)}__`;
    } else if (cleanCol.includes('phone') || cleanCol.includes('contact')) {
      token = `__PHONE_${Math.floor(Math.random() * 1000)}__`;
    } else if (cleanCol.includes('nric')) {
      token = `__ID_${Math.floor(Math.random() * 1000)}__`;
    } else {
      token = `__PERSON_${Math.floor(Math.random() * 1000)}__`;
    }
    this.cache.set(token, value);
    return token;
  }
}
