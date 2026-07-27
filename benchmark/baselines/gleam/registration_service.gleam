import capabilities.{type Clock, type RegistrationStore}
import domain.{AlreadyRegistered, Closed, Event, EventFull, Person, Registration, RegistrationClosed, StoreFailed}
pub fn register(event: Event, person: Person, store: RegistrationStore, clock: Clock) {
  let Event(event_id, capacity, registered, state) = event
  let Person(person_id, _) = person
  use existing <- result.try(case store.find(event_id, person_id) { Some(_) -> Error(AlreadyRegistered) None -> Ok(Nil) })
  case state {
    Closed -> Error(RegistrationClosed)
    _ if registered >= capacity -> Error(EventFull)
    _ -> {
      let registration = Registration(event_id, person_id, clock.now())
      case store.save(registration) { Ok(_) -> Ok(registration) Error(_) -> Error(StoreFailed) }
    }
  }
}
