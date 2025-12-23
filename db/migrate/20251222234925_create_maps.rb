class CreateMaps < ActiveRecord::Migration[7.2]
  def change
    create_table :maps do |t|
      t.references :user, null: false, foreign_key: true

      # 地図の名前。デフォルト値はrailsで設定する
      t.string :name, null: false

      # 活動時間(秒)
      t.integer :activity_time, null: false, default: 0

      # 地図記録中の距離(m)
      t.integer :total_distance, null: false, default: 0

      # 地図のURL用
      t.uuid :public_uid, null: false, default: -> { "gen_random_uuid()" }

      # 地図のステータス(非公開:0,限定公開:10,公開:20)
      t.integer :status, null: false, default: 0

      # 記録開始時刻(アプリで設定)
      t.datetime :started_at, null: false

      # 記録終了時刻(デフォルトなし)
      t.datetime :ended_at, null: true

      t.timestamps
    end

    add_index :maps, :public_uid, unique: true
  end
end
