import type { Registration, Result } from "./domain.js";
export interface RegistrationStore {
  find(eventId: number, personId: number): Registration | undefined;
  save(registration: Registration): Result<void, "store_failed">;
}
export interface Clock { now(): number }
export interface Notification { send(message: string): void }
