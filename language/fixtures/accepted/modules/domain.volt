module modules.domain

pub type Role {
  Admin
  Member
}

pub record Person {
  id: Int,
  name: String,
  role: Role
}
