class TeamMember < ApplicationRecord
  has_many :pets, dependent: :destroy

  validates :name, presence: true,
                   uniqueness: { case_sensitive: false },
                   length: { maximum: 60 }

  scope :alphabetical, -> { order(Arel.sql("lower(name) ASC")) }
end
