module modules.registration

import modules.domain.{Person}

pub fn person_id(person: Person) -> Int {
  person.id
}
