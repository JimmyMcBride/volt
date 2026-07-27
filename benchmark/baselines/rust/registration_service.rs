use crate::capabilities::{Clock, RegistrationStore};
use crate::domain::{Event, EventState, Person, Registration, RegistrationError};
pub fn register<S: RegistrationStore, C: Clock>(event: &Event, person: &Person, store: &mut S, clock: &mut C) -> Result<Registration, RegistrationError> {
    if store.find(event.id, person.id).is_some() { return Err(RegistrationError::AlreadyRegistered); }
    if matches!(event.state, EventState::Closed) { return Err(RegistrationError::RegistrationClosed); }
    if event.registered >= event.capacity { return Err(RegistrationError::EventFull); }
    let registration = Registration { event_id: event.id, person_id: person.id, created_at: clock.now() };
    store.save(registration.clone()).map_err(|_| RegistrationError::StoreFailed)?;
    Ok(registration)
}
