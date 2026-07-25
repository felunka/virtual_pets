class CreatePets < ActiveRecord::Migration[8.1]
  def change
    create_table :pets do |t|
      t.references :team_member, null: false, foreign_key: true
      t.string :name, null: false
      t.integer :mood, null: false, default: 5
      t.text :description
      t.string :picture, null: false, default: "🐣"

      t.timestamps
    end

    add_check_constraint :pets, "mood BETWEEN 0 AND 10", name: "pets_mood_between_0_and_10"
  end
end
