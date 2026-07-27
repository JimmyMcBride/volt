module containers

pub fn first_or(items: List<Int>, fallback: Int) -> Int {
  match items {
    [] -> fallback
    [first, ...rest] -> first
  }
}

pub fn prepend_and_count(item: Int, items: List<Int>) -> Int {
  List.length(List.prepend(item, items))
}
