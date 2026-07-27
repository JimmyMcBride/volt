module recordMissingField

pub record Person {
  id: Int,
  name: String
}

pub fn createPerson(id: Int) -> Person {
  Person {
    id: id
  }
}
