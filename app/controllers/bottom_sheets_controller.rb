class BottomSheetsController < ApplicationController
  def show
    @trip = Trip.find_by(public_uid: params[:id])
    respond_modal
  end

  def show_post_bottom_sheet
    @trip = current_user.trips.find_by(public_uid: params[:id])

    unless @trip
      respond_modal("shared/flash_message", flash_message: { alert: "この地図は見つかりません" })
      return
    end

    respond_modal
  end
end
