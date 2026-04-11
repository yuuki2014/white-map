# frozen_string_literal: true

class Users::PasswordsController < Devise::PasswordsController
  before_action :validate_reset_password_token, only: %i[ edit update ]
  # GET /resource/password/new
  # def new
  #   super
  # end

  # POST /resource/password
  # def create
  #   super
  # end

  # GET /resource/password/edit?reset_password_token=abcdef
  # def edit
  #   super
  # end

  # PUT /resource/password
  # def update
  #   super
  # end

  # protected

  # def after_resetting_password_path_for(resource)
  #   super(resource)
  # end

  # The path used after sending reset password instructions
  # def after_sending_reset_password_instructions_path_for(resource_name)
  #   super(resource_name)
  # end

  private

  # ログインしている人は入れない設定
  def require_no_authentication
    # ゲストなら何もしない
    if current_user&.role == "guest"
      return
    end
    # ゲスト以外はDeviseの標準処理を実行
    super
  end

  def validate_reset_password_token
    raw_token =
      if action_name == "edit"
        params[:reset_password_token].to_s
      else
        resource_params[:reset_password_token].to_s
      end

    digest = Devise.token_generator.digest(
      resource_class,
      :reset_password_token,
      raw_token
    )

    # DBのdigestと合っているか検証
    user = resource_class.find_by(reset_password_token: digest)

    if user.nil? || !user.reset_password_period_valid?
      flash[:alert] = t("devise.passwords.token_invalid")
      redirect_to new_session_path(resource_name)
    end
  end
end
