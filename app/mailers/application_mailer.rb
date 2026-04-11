class ApplicationMailer < ActionMailer::Base
  default from: -> {
    email_address_with_name(
      ENV.fetch("MAILER_SENDER", "noreply@shiroichizu.app"),
      I18n.t("mailer.sender_name")
    )
  }
  layout "mailer"
end
