class CustomDeviseMailer < Devise::Mailer
  default from: ->(*) {
    email_address_with_name(
      ENV.fetch("MAILER_SENDER", "noreply@shiroichizu.app"),
      I18n.t("mailer.sender_name")
    )
  }

  default template_path: "devise/mailer"

  protected

  def headers_for(action, opts)
    super.except(:reply_to)
  end
end
