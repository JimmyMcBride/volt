module records

pub record Person {
  id: Int,
  name: String
}

pub fn rename(person: Person, name: String) -> Person {
  Person {
    id: person.id,
    name: name
  }
}
