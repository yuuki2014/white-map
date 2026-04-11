class UserMailer < ApplicationMailer
  def email_verification
    @token = params[:token]
    @email = params[:email]

    mail(to: @email, subject: "【シロイチズ】本登録のご案内")
  end

  def email_change_verification
    @token = params[:token]
    @email = params[:email]

    mail(to: @email, subject: "【シロイチズ】メールアドレス変更のご案内")
  end
end
