module missingEffect

pub effect Clock {
  fn now() -> Int
}

pub fn currentTime() -> Int {
  Clock.now()
}
