pub type EventState { Open Closed }
pub type Event { Event(id: Int, capacity: Int, registered: Int, state: EventState) }
pub type Person { Person(id: Int, name: String) }
pub type Registration { Registration(event_id: Int, person_id: Int, created_at: Int) }
pub type RegistrationError { EventFull AlreadyRegistered RegistrationClosed StoreFailed }
