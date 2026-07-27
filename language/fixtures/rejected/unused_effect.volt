module unused_effect

pub effect Clock {
  fn now() -> Int
}

pub fn answer() uses {Clock} -> Int {
  42
}
