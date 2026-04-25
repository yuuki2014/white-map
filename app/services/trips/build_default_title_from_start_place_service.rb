class Trips::BuildDefaultTitleFromStartPlaceService
  DEFAULT_TITLE = "名無しの地図".freeze

  def self.call(trip:)
    return trip.title unless trip.title == DEFAULT_TITLE

    first_footprint = trip.footprints.order(recorded_at: :asc).first
    return DEFAULT_TITLE if first_footprint.nil?

    response = Faraday.get(
      "https://geoapi.heartrails.com/api/json",
      {
        method: "searchByGeoLocation",
        x: first_footprint.longitude,
        y: first_footprint.latitude
      }
    )

    return DEFAULT_TITLE unless response.success?

    location_data = JSON.parse(response.body).dig("response", "location")&.first
    return DEFAULT_TITLE if location_data.nil?

    prefecture = location_data["prefecture"]
    city       = location_data["city"]
    town       = location_data["town"]

    title = [ prefecture, city, town ].compact_blank.join
    return DEFAULT_TITLE if title.blank?

    "#{title}の地図"
  rescue JSON::ParserError, Faraday::Error
    DEFAULT_TITLE
  end
end
