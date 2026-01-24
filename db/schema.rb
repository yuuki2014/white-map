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

ActiveRecord::Schema[7.2].define(version: 2026_01_23_042843) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "plpgsql"

  create_table "footprints", force: :cascade do |t|
    t.bigint "trip_id", null: false
    t.float "latitude", null: false
    t.float "longitude", null: false
    t.string "geohash", null: false
    t.datetime "recorded_at", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["trip_id", "geohash"], name: "index_footprints_on_trip_id_and_geohash"
    t.index ["trip_id", "recorded_at"], name: "index_footprints_on_trip_id_and_recorded_at"
    t.index ["trip_id"], name: "index_footprints_on_trip_id"
  end

  create_table "trips", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "title", null: false
    t.integer "activity_time", default: 0, null: false
    t.integer "total_distance", default: 0, null: false
    t.uuid "public_uid", default: -> { "gen_random_uuid()" }, null: false
    t.integer "status", default: 0, null: false
    t.datetime "started_at", null: false
    t.datetime "ended_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["public_uid"], name: "index_trips_on_public_uid", unique: true
    t.index ["user_id"], name: "index_trips_on_user_id"
  end

  create_table "users", force: :cascade do |t|
    t.string "email"
    t.string "encrypted_password", null: false
    t.string "nickname", default: "ゲスト", null: false
    t.integer "role", default: 0, null: false
    t.uuid "public_uid", default: -> { "gen_random_uuid()" }, null: false
    t.integer "map_privacy", default: 0, null: false
    t.string "reset_password_token"
    t.datetime "reset_password_sent_at"
    t.datetime "remember_created_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.uuid "map_share_uuid", default: -> { "gen_random_uuid()" }, null: false
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["map_share_uuid"], name: "index_users_on_map_share_uuid", unique: true
    t.index ["public_uid"], name: "index_users_on_public_uid", unique: true
    t.index ["reset_password_token"], name: "index_users_on_reset_password_token", unique: true
  end

  add_foreign_key "footprints", "trips"
  add_foreign_key "trips", "users"
end
