/**
 * EventBus — connects Three.js, PixiJS, and React without coupling them.
 * Any layer emits events here. Any layer listens here.
 */
const listeners = {};

const EventBus = {
  on(event, cb) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(cb);
    return () => this.off(event, cb);
  },
  off(event, cb) {
    if (!listeners[event]) return;
    listeners[event] = listeners[event].filter(fn => fn !== cb);
  },
  emit(event, data) {
    (listeners[event] || []).forEach(cb => cb(data));
  },
  clear() {
    Object.keys(listeners).forEach(k => delete listeners[k]);
  }
};

export default EventBus;
