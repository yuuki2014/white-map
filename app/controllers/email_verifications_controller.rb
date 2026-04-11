class EmailVerificationsController < ApplicationController
  before_action :redirect_logged_in_users, only: %i[ new create ]

  def new
  end

  def create
    @email = params["email"]

    if @email.present? && @email.match?(Devise.email_regexp)

      token = custom_verifier.generate(@email, purpose: :email_verifications, expires_in: 1.hour)

      user = User.find_by(email: @email)
      UserMailer.with(token: token, email: @email).email_verification.deliver_later unless user
      respond_modal("shared/flash_message", flash_message: { notice: "メールを送信しました" })
    else
      respond_modal("shared/flash_message", flash_message: { alert: "正しいメールアドレスを入力してください" })
    end
  end

  private

  def redirect_logged_in_users
    if user_signed_in? && !current_user.guest?
      redirect_to mypage_path, alert: "すでにログインしています"
    end
  end
end
