module modules.registration

import modules.domain.{Person, Role}

pub fn person_id(person: Person) -> Int {
  person.id
}

pub fn is_person_admin(person: Person) -> Bool {
  person.role == Admin
}
