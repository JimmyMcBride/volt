import type { Clock, RegistrationStore } from "./capabilities.js";
import type { Event, Person, Registration, RegistrationError, Result } from "./domain.js";
export function register(event: Event, person: Person, store: RegistrationStore, clock: Clock): Result<Registration, RegistrationError> {
  if (store.find(event.id, person.id) !== undefined) return { ok: false, error: "already_registered" };
  if (event.state === "closed") return { ok: false, error: "registration_closed" };
  if (event.registered >= event.capacity) return { ok: false, error: "event_full" };
  const registration = { eventId: event.id, personId: person.id, createdAt: clock.now() };
  return store.save(registration).ok ? { ok: true, value: registration } : { ok: false, error: "store_failed" };
}
