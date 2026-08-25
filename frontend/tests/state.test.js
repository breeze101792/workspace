import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { on, emit } from '../js/state.js';

// Pure pub/sub module — no DOM required.
// state.js keeps a module-scoped listener map shared across every test in this
// file, so we unsubscribe everything in afterEach to keep tests isolated.

describe('state.js pub/sub', () => {
  const unsubs = [];

  function subscribe(evt, fn) {
    const un = on(evt, fn);
    unsubs.push(un);
    return un;
  }

  afterEach(() => {
    unsubs.splice(0).forEach((un) => un());
  });

  it('calls a subscribed listener with emitted data', () => {
    let received = null;
    subscribe('evt', (d) => { received = d; });
    emit('evt', { a: 1 });
    expect(received).toEqual({ a: 1 });
  });

  it('calls multiple listeners in registration order', () => {
    const order = [];
    subscribe('multi', () => order.push(1));
    subscribe('multi', () => order.push(2));
    emit('multi');
    expect(order).toEqual([1, 2]);
  });

  it('does not call listeners registered for a different event', () => {
    let called = false;
    subscribe('other', () => { called = true; });
    emit('unrelated');
    expect(called).toBe(false);
  });

  it('does nothing when emitting an event with no listeners', () => {
    expect(() => emit('none', 'x')).not.toThrow();
  });

  it('unsubscribe removes the listener', () => {
    const un = subscribe('evt', () => { throw new Error('should not be called'); });
    un();
    emit('evt', 1);
  });

  it('passes undefined when emitting without data', () => {
    let received = 'sentinel';
    subscribe('empty', (d) => { received = d; });
    emit('empty');
    expect(received).toBe(undefined);
  });

  it('unsubscribing one listener leaves others intact', () => {
    const calls = [];
    subscribe('group', () => calls.push('a'));
    const unB = subscribe('group', () => calls.push('b'));
    unB();
    emit('group');
    expect(calls).toEqual(['a']);
  });
});
