module modules.registration

import modules.domain.{Person, Role}

pub fn personId(person: Person) -> Int {
  person.id
}

pub fn isPersonAdmin(person: Person) -> Bool {
  person.role == Admin
}
