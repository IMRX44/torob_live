import "server-only";
import { EventEmitter } from "node:events";
import { sql } from "./db";

/**
 * Realtime fan-out over Postgres LISTEN/NOTIFY: works across app instances without
 * extra infrastructure. Topics: `session:<id>`, `shop:<id>`.
 */
declare global {
  // eslint-disable-next-line no-var
  var __torobBus: { emitter: EventEmitter; ready: Promise<void> } | undefined;
}

function bus() {
  if (!globalThis.__torobBus) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(1000);
    const ready = sql()
      .listen("torob_events", (payload) => {
        try {
          const msg = JSON.parse(payload) as { topic: string; event: unknown };
          emitter.emit(msg.topic, msg.event);
        } catch {
          /* ignore malformed */
        }
      })
      .then(() => undefined);
    globalThis.__torobBus = { emitter, ready };
  }
  return globalThis.__torobBus;
}

export async function publish(topic: string, event: unknown) {
  await sql()`SELECT pg_notify('torob_events', ${JSON.stringify({ topic, event })})`;
}

export async function subscribe(topic: string, fn: (event: unknown) => void) {
  const b = bus();
  await b.ready;
  b.emitter.on(topic, fn);
  return () => b.emitter.off(topic, fn);
}
