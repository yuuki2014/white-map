class UsersController < ApplicationController
  rescue_from ActiveRecord::RecordNotUnique, with: :record_not_unique
  before_action :set_user, only: %i[ show edit update ]

  def show
    if @user.present?
      render
    else
      redirect_to root_path
    end
  end

  def edit
    if @user.nil? || @user.guest?
      respond_modal("shared/flash_message", flash_message: { alert: "エラーのため編集できません" })
      return
    end
    respond_modal
  end

  def update
    if @user.nil? || @user.guest?
      respond_modal("shared/flash_message", flash_message: { alert: "エラーのため編集できません" })
      return
    end

    if params[:user] && params[:user][:remove_avatar] == "1"
      @user.avatar.purge
    end

    if params[:user] && params[:user][:avatar].present?
      uploaded_file = params[:user][:avatar]

      if uploaded_file.size > 100.kilobytes
        @user.errors.add(:avatar, "のサイズが大きすぎます。不正なデータの可能性があります")
        return respond_modal("shared/flash_and_error", locals: { object: @user }, flash_message: { alert: "保存に失敗しました" })
      end
    end

    if @user.update(profile_params)
      respond_modal
    else
      respond_modal("shared/flash_and_error", locals: { object: @user }, flash_message: { alert: "保存に失敗しました" })
    end
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

  def profile_params
    params.require(:user).permit(:nickname, :avatar, :remove_avatar)
  end
end
