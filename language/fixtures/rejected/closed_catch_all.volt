module closed_catch_all

pub type Status {
  Open
  Closed
}

pub fn is_open(status: Status) -> Bool {
  match status {
    Open -> true
    _ -> false
  }
}
