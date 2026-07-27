use crate::domain::Registration;
pub trait RegistrationStore {
    fn find(&self, event_id: i64, person_id: i64) -> Option<Registration>;
    fn save(&mut self, registration: Registration) -> Result<(), ()>;
}
pub trait Clock { fn now(&mut self) -> i64; }
pub trait Notification { fn send(&mut self, message: &str); }
