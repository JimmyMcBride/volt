module record_missing_field

pub record Person {
  id: Int,
  name: String
}

pub fn create_person(id: Int) -> Person {
  Person {
    id: id
  }
}
