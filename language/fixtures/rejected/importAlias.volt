module importAlias

import modules.domain.{Person as User}

pub fn userId(user: User) -> Int {
  user.id
}
