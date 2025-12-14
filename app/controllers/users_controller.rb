class UsersController < ApplicationController
  rescue_from ActiveRecord::RecordNotUnique, with: :record_not_unique

  private

  def record_not_unique
    Rails.logger.debug "ユニークじゃありません"
    # render plain: "404 Not Found", status: 404
  end
end
