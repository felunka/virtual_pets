class Pet < ApplicationRecord
  belongs_to :team_member

  validates :name, presence: true, length: { maximum: 60 }
  validates :picture, presence: true, length: { maximum: 8 }
  validates :description, length: { maximum: 500 }
  validates :mood, inclusion: { in: 0..10 }
  validate :team_member_pet_limit, on: :create

  private

  def team_member_pet_limit
    return unless team_member
    return unless team_member.pets.size >= 3

    errors.add(:base, "A team member can only have up to 3 pets")
  end
end
