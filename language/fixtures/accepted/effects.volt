module effects

pub effect Clock {
  fn now() -> Int
}

pub fn currentTime() uses {Clock} -> Int {
  Clock.now()
}
