import domain.{type Registration}
pub type RegistrationStore {
  RegistrationStore(find: fn(Int, Int) -> Option(Registration), save: fn(Registration) -> Result(Nil, Nil))
}
pub type Clock { Clock(now: fn() -> Int) }
pub type Notification { Notification(send: fn(String) -> Nil) }
