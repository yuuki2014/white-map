class DecisionsController < ApplicationController
  def create
    context  = params[:context]
    decision = params[:decision]

    case [context, decision]
    when ["tutorials", "end"]
      cookies.permanent[:tutorials_end] = "true"
      respond_to do |format|
        format.turbo_stream { render turbo_stream: turbo_stream.update("modal-container", partial: "tutorials/terms_modal") }
        format.html { redirect_to root_path }
      end

    when ["terms", "accepted"]
      cookies.permanent[:terms_accepted] = "true"

      # ゲストユーザー作成
      @guest_user = User.create_guest
      # ゲストのリメンバー機能をオンにする
      @guest_user.remember_me = true
      # 作成したゲストでログイン
      sign_in @guest_user

      respond_to do |format|
        format.turbo_stream { render "tutorials/terms_accepted", formats: :turbo_stream }
        format.html { redirect_to root_path }
      end

    when ["terms", "dismissed"]
      respond_to do |format|
        format.turbo_stream { render "tutorials/terms_required_modal", formats: :turbo_stream }
        format.html { redirect_to root_path }
      end

    else
      head :bad_request
    end
  end
end
