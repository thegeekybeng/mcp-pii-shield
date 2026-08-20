export class TokenCache {
  private store = new Map<string, string>();
  private timers = new Map<string, NodeJS.Timeout>();
  private ttlSeconds: number;

  constructor(ttlSeconds: number = 1800) {
    this.ttlSeconds = ttlSeconds;
  }

  public set(token: string, value: string): void {
    if (token === '__proto__' || token === 'constructor') {
      return;
    }
    this.store.set(token, value);
    
    // Clear old timer if setting the same token
    if (this.timers.has(token)) {
      clearTimeout(this.timers.get(token)!);
    }

    const timer = setTimeout(() => {
      this.store.delete(token);
      this.timers.delete(token);
    }, this.ttlSeconds * 1000);

    // Keep process from hanging if timer is active
    if (typeof timer.unref === 'function') {
      timer.unref();
    }
    
    this.timers.set(token, timer);
  }

  public get(token: string): string | undefined {
    if (token === '__proto__' || token === 'constructor') {
      return undefined;
    }
    return this.store.get(token);
  }

  public getKeys(): string[] {
    return Array.from(this.store.keys());
  }
}
