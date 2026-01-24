class Api::V1::MyMapsController < ApplicationController
  def show
    geohashes = current_user&.cumulative_geohashes

    render json: { geohashes: geohashes || [] }
  end
end
