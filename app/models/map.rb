class Map < ApplicationRecord
  # enum 定義
  # 地図の公開ステータス
  # 非公開:0, 限定公開:10, 公開:20
  enum :status, { private: 0, unlisted: 10, public: 20 }, prefix: :visibility

  # バリデーション定義
  validates :user_id, :name, :activity_time, :total_distance, :status, :started_at, presence: true

  # アソシエーション定義
  belongs_to :user

  # 初期値を設定
  attribute :started_at, :datetime, default: -> { Time.current }
  # 地図名のデフォルト値は、開始位置から取得するように後で設定を変える
  attribute :name, :string, default: "デフォルト地図"
end
