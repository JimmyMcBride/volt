module all_syntax

pub record Point {
  x: Int,
  y: Int
}

pub type State {
  Idle
  Active(Point)
}

pub effect Clock {
  fn now() -> Int
}

fn choose(flag: Bool, yes: Int, no: Int) -> Int {
  if flag {
    yes
  } else {
    no
  }
}

pub fn current_time() uses {Clock} -> Int {
  Clock.now()
}

pub fn make_state(x: Int, y: Int) -> State {
  Active(Point {
    x: x,
    y: y
  })
}

pub fn state_x(state: State) -> Int {
  match state {
    Idle -> 0
    Active(Point {
      x: x,
      y: y
    }) -> x + y
  }
}

pub fn point_axis(point: Point) -> Int {
  match point {
    Point {
      x: 0,
      y: y
    } -> y
    _ -> point.x
  }
}

pub fn first_or(items: List<Int>, fallback: Int) -> Int {
  match items {
    [] -> fallback
    [head, ...tail] -> head
  }
}

pub fn option_or(value: Option<Int>, fallback: Int) -> Int {
  match value {
    None -> fallback
    Some(present) -> present
  }
}

pub fn result_or(value: Result<Int, String>, fallback: Int) -> Int {
  match value {
    Ok(present) -> present
    Error(message) -> fallback
  }
}

pub fn describe(value: Int) -> String {
  match value {
    0 -> "zero\n"
    _ -> "other\t"
  }
}

pub fn expressions(a: Int, b: Int, label: String, flag: Bool) -> Bool {
  let arithmetic: Int = -a + b * 2 / 1 % 3 in
  let text = label + "\\value" in
  (arithmetic >= 0 && !flag) || (text != "none" && a < b)
}

pub fn unit() -> Unit {
  ()
}

pub fn selected(flag: Bool) -> Int {
  choose(flag, 1, 0)
}
