module unusedEffect

pub effect Clock {
  fn now() -> Int
}

pub fn answer() uses {Clock} -> Int {
  42
}
