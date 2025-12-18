class UsersController < ApplicationController
  rescue_from ActiveRecord::RecordNotUnique, with: :record_not_unique
  before_action :set_user, only: [ :show ]

  def show
  end

  def mypage
    if user_signed_in? && current_user
      redirect_to user_path(current_user)
    else
      render
    end
  end

  private

  def record_not_unique
    Rails.logger.debug "ユニークじゃありません"
    # render plain: "404 Not Found", status: 404
  end

  def set_user
    @user = current_user if current_user
  end
end
