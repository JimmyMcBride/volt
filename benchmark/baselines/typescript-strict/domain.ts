export type EventState = "open" | "closed";
export type Event = Readonly<{ id: number; capacity: number; registered: number; state: EventState }>;
export type Person = Readonly<{ id: number; name: string }>;
export type Registration = Readonly<{ eventId: number; personId: number; createdAt: number }>;
export type RegistrationError = "event_full" | "already_registered" | "registration_closed" | "store_failed";
export type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };
