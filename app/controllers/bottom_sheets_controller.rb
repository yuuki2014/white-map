class BottomSheetsController < ApplicationController
  def show
    @trip = Trip.find_by(id: params[:trip_id])
    respond_to do |format|
      format.html { redirect_to root_path }
      format.turbo_stream
    end
  end

  def show_post_bottom_sheet
    @trip = current_user.trips.find_by(id: params[:id])
    respond_to do |format|
      format.html { redirect_to root_path }
      format.turbo_stream
    end
  end
end
