class Explore::TripsController < ApplicationController
  def index
    public_trips = Trip.visibility_public

    @trips = public_trips.includes(user: { avatar_attachment: :blob }).order(started_at: :desc)
    @geohash_counts = Footprint.where(trip_id: @trips.select(:id)).group(:trip_id).distinct.count(:geohash)
  end
end
