import { register } from "./registration_service.js";
export const publicTest = register(
  { id: 1, capacity: 2, registered: 0, state: "open" },
  { id: 7, name: "Ada" },
  { find: () => undefined, save: () => ({ ok: true, value: undefined }) },
  { now: () => 100 }
);
