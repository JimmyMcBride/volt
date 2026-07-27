#[derive(Clone, Debug, PartialEq)] pub enum EventState { Open, Closed }
#[derive(Clone)] pub struct Event { pub id: i64, pub capacity: i64, pub registered: i64, pub state: EventState }
#[derive(Clone)] pub struct Person { pub id: i64, pub name: String }
#[derive(Clone, Debug, PartialEq)] pub struct Registration { pub event_id: i64, pub person_id: i64, pub created_at: i64 }
#[derive(Clone, Debug, PartialEq)] pub enum RegistrationError { EventFull, AlreadyRegistered, RegistrationClosed, StoreFailed }
