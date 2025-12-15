class Guest::SessionsController < ApplicationController
  rescue_from ActiveRecord::RecordNotUnique, with: :record_not_unique

  def create
    # ゲストユーザー作成
    @guest_user = User.create_guest

    # ゲストのリメンバー機能をオンにする
    @guest_user.remember_me = true

    # 作成したゲストでログイン
    sign_in @guest_user

    redirect_to root_path
  end

  private

  def record_not_unique
    Rails.logger.debug "ユニークじゃありません"
    # render plain: "404 Not Found", status: 404
  end
end
