module import_alias

import modules.domain.{Person as User}

pub fn user_id(user: User) -> Int {
  user.id
}
