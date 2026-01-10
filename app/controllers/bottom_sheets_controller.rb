class BottomSheetsController < ApplicationController
  def show
    respond_to do |format|
      # format.html { redirect_to root_path }
      format.turbo_stream
    end
  end
end
