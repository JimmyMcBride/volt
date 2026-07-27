module missing_effect

pub effect Clock {
  fn now() -> Int
}

pub fn current_time() -> Int {
  Clock.now()
}
