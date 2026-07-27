module containers

pub fn firstOr(items: List<Int>, fallback: Int) -> Int {
  match items {
    [] -> fallback
    [first, ...rest] -> first
  }
}

pub fn prependAndCount(item: Int, items: List<Int>) -> Int {
  List.length(List.prepend(item, items))
}
