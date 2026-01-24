class MyMapsController < ApplicationController
  def show
    @first_footprint = current_user&.footprints.first
    @visited_geohashes = current_user&.cumulative_geohashes || []
  end
end
