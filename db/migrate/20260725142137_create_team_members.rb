class CreateTeamMembers < ActiveRecord::Migration[8.1]
  def change
    create_table :team_members do |t|
      t.string :name, null: false

      t.timestamps
    end

    add_index :team_members, "lower(name)", unique: true, name: "index_team_members_on_lower_name"
  end
end
