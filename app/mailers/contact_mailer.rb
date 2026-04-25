class ContactMailer < ApplicationMailer
  def notify_admin(user:, subject:, body:, user_agent:, ip:)
    @user = user
    @body = body
    @user_agent = user_agent
    @ip = ip

    mail_options = {
      to: ENV.fetch("CONTACT_TO_EMAIL"),
      subject: "【シロイチズお問い合わせ】#{subject}"
    }

    mail_options[:reply_to] = @user.email if @user.email.present?

    mail(mail_options)
  end
end
