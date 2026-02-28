class BottomSheetsController < ApplicationController
  def show
    @trip = Trip.find_by(public_uid: params[:id])
    respond_modal
  end

  def show_post_bottom_sheet
    @trip = current_user.trips.find_by(public_uid: params[:id])
    respond_modal
  end
end
