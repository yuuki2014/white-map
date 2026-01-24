class Trip < ApplicationRecord
  # テーブルデータ
  # id、主キー
  # user_id null: false、外部キー
  # title, string, null: false、地図の名前、デフォルトで開始時の場所から名前をつける
  # activity_time, integer, default: 0, null: false、活動時間を秒数で保存
  # total_distance, integer, default: 0, null: false、合計距離をmで保存
  # public_uid, uuid, default: -> { "gen_random_uuid()" }, null: false、地図公開用URLに使用するUUID
  # status, integer, default: 0, null: false、地図の公開ステータス
  # started_at, datetime,null: false、地図の作成開始時刻
  # ended_at, datetime、地図の作成終了時刻

  # 定数定義
  TITLE_MAX_LENGTH = 100

  # enum 定義
  # 地図の公開ステータス
  # 非公開:0, 限定公開:10, 公開:20
  enum :status, { private: 0, unlisted: 10, public: 20 }, prefix: :visibility

  # バリデーション定義
  validates :user_id, :activity_time, :total_distance, :status, :started_at, presence: true
  validates :title,
    presence: true,
    length: { maximum: TITLE_MAX_LENGTH },
    format: { without: /\R/, message: "に改行は使えません" }

  # アソシエーション定義
  belongs_to :user
  has_many :footprints, dependent: :destroy

  # 初期値定義
  # 開始時刻はアプリ側の時間を入れる
  attribute :started_at, :datetime, default: -> { Time.current }
  # 地図名のデフォルト値は、開始位置から取得するように後で設定を変える
  attribute :title, :string, default: "デフォルト地図"
end
