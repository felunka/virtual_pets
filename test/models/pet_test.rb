require "test_helper"

class PetTest < ActiveSupport::TestCase
  test "rejects mood outside allowed range" do
    pet = Pet.new(team_member: team_members(:alex), name: "Bad Mood", mood: 11, picture: "🐶")

    assert_not pet.valid?
    assert_includes pet.errors[:mood], "is not included in the list"
  end

  test "limits each member to three pets" do
    owner = team_members(:nina)
    owner.pets.create!(name: "One", mood: 5, picture: "1️⃣")
    owner.pets.create!(name: "Two", mood: 5, picture: "2️⃣")
    owner.pets.create!(name: "Three", mood: 5, picture: "3️⃣")

    pet = owner.pets.build(name: "Four", mood: 5, picture: "4️⃣")

    assert_not pet.valid?
    assert_includes pet.errors[:base], "A team member can only have up to 3 pets"
  end
end
