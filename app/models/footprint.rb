# == Schema Information
#
# Table name: footprints
#
#  id          :bigint           not null, primary key
#  trip_id     :bigint           not null
#  latitude    :float            not null
#  longitude   :float            not null
#  geohash     :string           not null
#  recorded_at :datetime         not null
#  created_at  :datetime         not null
#  updated_at  :datetime         not null

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
