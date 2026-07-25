# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_07_25_142138) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "pets", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.text "description"
    t.integer "mood", default: 5, null: false
    t.string "name", null: false
    t.string "picture", default: "🐣", null: false
    t.bigint "team_member_id", null: false
    t.datetime "updated_at", null: false
    t.index ["team_member_id"], name: "index_pets_on_team_member_id"
    t.check_constraint "mood >= 0 AND mood <= 10", name: "pets_mood_between_0_and_10"
  end

  create_table "team_members", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.datetime "updated_at", null: false
    t.index "lower((name)::text)", name: "index_team_members_on_lower_name", unique: true
  end

  add_foreign_key "pets", "team_members"
end
