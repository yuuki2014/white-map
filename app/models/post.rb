#   t.bigint "user_id", null: false
#   t.bigint "trip_id"
#   t.text "body"
#   t.float "latitude", null: false
#   t.float "longitude", null: false
#   t.uuid "public_uid", default: -> { "gen_random_uuid()" }, null: false
#   t.integer "visibility", default: 0, null: false
#   t.datetime "visited_at", null: false
#   t.datetime "created_at", null: false
#   t.datetime "updated_at", null: false
#   t.index ["public_uid"], name: "index_posts_on_public_uid", unique: true
#   t.index ["trip_id"], name: "index_posts_on_trip_id"
#   t.index ["user_id"], name: "index_posts_on_user_id"

class Post < ApplicationRecord
  # enum 定義
  # 投稿の公開ステータス
  # 公開:0, フォロワー限定:10, 非公開:20
  enum :visibility, { public: 0, follower: 10, private: 20 }, prefix: true

  # バリデーション定義
  validates :user_id, :latitude, :longitude, :visibility, :visited_at, presence: true

  # アソシエーション定義
  belongs_to :user
  belongs_to :trip, optional: true

  # 初期値定義
  # 開始時刻はアプリ側の時間を入れる
  attribute :visited_at, :datetime, default: -> { Time.current }

  def to_param
    public_uid
  end
end
