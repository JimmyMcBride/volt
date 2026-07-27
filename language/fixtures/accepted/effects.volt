module effects

pub effect Clock {
  fn now() -> Int
}

pub fn current_time() uses {Clock} -> Int {
  Clock.now()
}
