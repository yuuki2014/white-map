class AddUuidToUsers < ActiveRecord::Migration[7.2]
  def change
    add_column :users, :map_share_uuid, :uuid, null: false, default: -> { "gen_random_uuid()" }

    add_index :users, :map_share_uuid, unique: true
  end
end
