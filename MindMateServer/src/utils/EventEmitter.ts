// utils/EventEmitter.ts
type EventHandler = (...args: any[]) => void;

export class EventEmitter {
  private events: Map<string, Set<EventHandler>>;

  constructor() {
    this.events = new Map();
  }

  addListener(event: string, handler: EventHandler): void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)?.add(handler);
  }

  removeListener(event: string, handler: EventHandler): void {
    this.events.get(event)?.delete(handler);
  }

  emit(event: string, ...args: any[]): void {
    this.events.get(event)?.forEach(handler => {
      try {
        handler(...args);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    });
  }

  on(event: string, handler: EventHandler): void {
    this.addListener(event, handler);
  }

  off(event: string, handler: EventHandler): void {
    this.removeListener(event, handler);
  }

  removeAllListeners(): void {
    this.events.clear();
  }
}