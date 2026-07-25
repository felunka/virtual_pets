members = [
  {
    name: "Alex",
    pets: [
      { name: "Sports Spark", mood: 6, description: "Do sports 2x per week", picture: "🏃" },
      { name: "Code Owl", mood: 8, description: "Ship one clean refactor weekly", picture: "🦉" }
    ]
  },
  {
    name: "Nina",
    pets: [
      { name: "Hydra", mood: 7, description: "Drink enough water every day", picture: "🐉" }
    ]
  }
]

members.each do |member_data|
  member = TeamMember.find_or_create_by!(name: member_data[:name])

  member_data[:pets].each do |pet_data|
    member.pets.find_or_create_by!(name: pet_data[:name]) do |pet|
      pet.assign_attributes(pet_data)
    end
  end
end
