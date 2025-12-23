class CreateFootprints < ActiveRecord::Migration[7.2]
  def change
    create_table :footprints do |t|
      t.references :trip, null: false, foreign_key: true

      t.float :latitude, null: false
      t.float :longitude, null: false
      t.string :geohash, null: false
      t.datetime :recorded_at, null: false

      t.timestamps
    end

    add_index :footprints, [ :trip_id, :recorded_at ]
    add_index :footprints, [ :trip_id, :geohash ]
  end
end
