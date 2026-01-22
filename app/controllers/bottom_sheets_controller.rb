class BottomSheetsController < ApplicationController
  def show
    @trip = Trip.find_by(id: params[:trip_id])
    respond_to do |format|
      format.html { redirect_to root_path }
      format.turbo_stream
    end
  end
end
