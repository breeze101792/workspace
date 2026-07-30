// Simple pub/sub event bus
const _listeners = {};

export function on(event, fn) {
  (_listeners[event] = _listeners[event] || []).push(fn);
  return () => {
    _listeners[event] = _listeners[event].filter(f => f !== fn);
  };
}

export function emit(event, data) {
  (_listeners[event] || []).forEach(fn => fn(data));
}
