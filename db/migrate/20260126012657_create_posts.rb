class CreatePosts < ActiveRecord::Migration[7.2]
  def change
    create_table :posts do |t|
      t.references :user, null: false, foreign_key: true
      t.references :trip, null: true, foreign_key: true

      t.text :body
      t.float :latitude, null: false
      t.float :longitude, null: false
      t.uuid :public_uid, null: false, default: -> { "gen_random_uuid()" }
      t.integer :visibility, null: false, default: 0
      t.datetime :visited_at, null: false

      t.timestamps
    end

    add_index :posts, :public_uid, unique: true
  end
end
