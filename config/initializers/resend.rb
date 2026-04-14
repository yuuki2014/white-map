require "resend"
if ENV["RESEND_API_KEY"].present?
  Resend.configure do |config|
    config.api_key = ENV.fetch("RESEND_API_KEY")
  end
end
