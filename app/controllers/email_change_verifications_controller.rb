class EmailChangeVerificationsController < ApplicationController
  before_action :authenticate_user!, only: %i[ new create ]

  def new
  end

  def create
    @user = current_user
    @new_email = params["email"].to_s.strip.downcase
    password = params[:password].to_s

    unless @user.valid_password?(password)
      flash.now[:alert] = "正しいパスワードを入力してください"
      render :new, status: :unprocessable_entity
      return
    end

    unless @new_email.present? && @new_email.match?(Devise.email_regexp)
      flash.now[:alert] = "正しいメールアドレスを入力してください"
      render :new, status: :unprocessable_entity
      return
    end

    if @new_email.casecmp?(@user.email)
      flash.now[:alert] = "現在のメールアドレスと同じです"
      render :new, status: :unprocessable_entity
      return
    end

    unless User.exists?(email: @new_email)
      token = custom_verifier.generate(
        {
          user_uuid: @user.public_uid,
          current_email: @user.email,
          new_email: @new_email
        },
        purpose: :email_change_verifications,
        expires_in: 1.hour
      )

      UserMailer.with(token: token, email: @new_email).email_change_verification.deliver_later
    end

    redirect_to account_setting_path, notice: "確認メールを送信しました"
  end
end
