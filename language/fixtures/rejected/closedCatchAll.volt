module closedCatchAll

pub type Status {
  Open
  Closed
}

pub fn isOpen(status: Status) -> Bool {
  match status {
    Open -> true
    _ -> false
  }
}
