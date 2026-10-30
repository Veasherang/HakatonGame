/** Минимальная шина событий без зависимости от Phaser. */
export class Emitter {
  constructor() {
    this.handlers = new Map();
  }

  on(event, handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event).add(handler);
    return () => this.off(event, handler);
  }

  once(event, handler) {
    const off = this.on(event, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  off(event, handler) {
    this.handlers.get(event)?.delete(handler);
  }

  emit(event, payload) {
    const handlers = this.handlers.get(event);
    if (!handlers) return;
    for (const handler of [...handlers]) {
      try {
        handler(payload);
      } catch (error) {
        // Ошибка одного подписчика не должна ломать игровой цикл.
        console.error(`[Emitter] ${event}:`, error);
      }
    }
  }

  clear() {
    this.handlers.clear();
  }
}
