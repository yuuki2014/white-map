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
  include ActionView::Helpers::NumberHelper

  # 定数定義
  MAX_IMAGES_COUNT = 6
  MAX_BODY_LENGTH = 300
  MAX_IMAGE_SIZE = 5.megabytes
  ALLOWED_IMAGE_TYPES = %w[
    image/jpeg
    image/jpg
    image/webp
  ].freeze

  attr_accessor :incoming_images_present

  # enum 定義
  # 投稿の公開ステータス
  # 地図に合わせる:0, 全体公開:10 フォロワー限定:10, 非公開:20
  enum :visibility, { inherit_trip: 0, public: 10, follower: 20, private: 30 }, prefix: true

  scope :listed_publicly, -> {
    joins(:trip).where(
      "posts.visibility = :public OR (posts.visibility = :inherit_trip AND trips.status = :trip_public)",
      public: visibilities[:public],
      inherit_trip: visibilities[:inherit_trip],
      trip_public: Trip.statuses[:public]
    )
  }



  # バリデーション定義
  validates :user_id, :latitude, :longitude, :visibility, :visited_at, presence: true
  validate :body_or_images_presence
  validate :visited_at_cannot_be_in_the_future
  validates :body, length: { maximum: MAX_BODY_LENGTH  }

  # アソシエーション定義
  belongs_to :user
  belongs_to :trip, optional: true

  # Active Storage設定
  has_many_attached :images do |attachable|
    # マップ用アイコン
    attachable.variant :map_icon, resize_to_fill: [ 100, 100 ], saver: { quality: 70 }

    # 一覧表示用、比率維持
    attachable.variant :thumb, resize_to_limit: [ 600, 600 ], saver: { quality: 85 }
  end

  validate :validate_images_size
  validate :validate_images_count
  validate :allow_image_type

  # 初期値定義
  # 開始時刻はアプリ側の時間を入れる
  attribute :visited_at, :datetime, default: -> { Time.current }

  def to_param
    public_uid
  end

  def visible_to?(user)
    user == self.user || visibility_public? || ( visibility_inherit_trip? && (trip.visibility_unlisted? || trip.visibility_public?) )
  end

  private

  def validate_images_count
    return unless images.attached?

    if images.attachments.size > MAX_IMAGES_COUNT
      errors.add(:images, "は#{MAX_IMAGES_COUNT}枚までです")
    end
  end

  def validate_images_size
    return unless images.attached?

    images.each do |image|
      if image.blob.byte_size > MAX_IMAGE_SIZE
        errors.add(:images, "は1枚あたり#{number_to_human_size(MAX_IMAGE_SIZE)}以下にしてください")
        break
      end
    end
  end

  def body_or_images_presence
    normalized_body = body.to_s.strip

    return if normalized_body.present? || images.attached? || incoming_images_present

    errors.add(:base, "本文または画像のどちらかが必須です")
  end

  def visited_at_cannot_be_in_the_future
    return if visited_at.blank?

    if visited_at > Time.current
      errors.add(:visited_at, "は未来の日時に設定できません")
    end
  end

  def allow_image_type
    return unless images.attached?

    images.each do |image|
      unless image.content_type&.in?(ALLOWED_IMAGE_TYPES)
        errors.add(:images, "の形式が未対応です。再度添付し直してください")
        break
      end
    end
  end
end
