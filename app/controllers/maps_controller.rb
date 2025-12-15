class MapsController < ApplicationController
  def new
    Rails.logger.debug current_user.inspect
    Rails.logger.debug current_user.inspect
    Rails.logger.debug current_user.inspect
    Rails.logger.debug current_user.inspect
    Rails.logger.debug current_user.inspect
  end

  def index
    flash[:notice] = "フラッシュテスト"
  end
end
