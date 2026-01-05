class Footprint < ApplicationRecord
  # アソシエーション定義
  belongs_to :trip

  # コールバック定義
  before_validation :generate_geohash

  # 定数定義
  GEOHASH_PRECISION = 9

  # バリデーション定義
  validates :trip_id, :latitude, :longitude, :geohash, :recorded_at, presence: true

  # 初期値定義
  # 記録時刻はアプリ側の時間を入れる
  attribute :recorded_at, :datetime, default: -> { Time.current }

  private

  def generate_geohash
    if latitude.present? && longitude.present?
      self.geohash = GeoHash.encode(latitude, longitude, GEOHASH_PRECISION)
    end
  end
end
