class ApplicationController < ActionController::Base
  # Only allow modern browsers supporting webp images, web push, badges, import maps, CSS nesting, and CSS :has.
  allow_browser versions: :modern
  before_action :redirect_old_render_domain, if: -> { request.host == "white-map.onrender.com" }
  before_action :set_initial_cookies, if: -> { user_signed_in? }
  before_action :set_back_url
  before_action :set_locale

  private

  def set_initial_cookies
    cookies.permanent[:tutorials_end] = "true"
    cookies.permanent[:terms_accepted] = "true"
  end

  def set_back_url
    segments = request.path.split("/").reject(&:blank?)
    parent_path = segments.size <= 1 ? root_path : "/" + segments[0...-1].join("/")

    safe_referer = url_from(request.referer)

    @back_url =
          if safe_referer.present?
            begin
              referer_path = URI.parse(safe_referer).path
              referer_path == request.path ? parent_path : safe_referer
            rescue URI::InvalidURIError
              parent_path
            end
          else
            parent_path
          end
  end

  def respond_modal(*args, fallback: root_path, flash_message: {}, **kwargs, &block)
    flash_message.each { |type, message| flash.now[type] = message }

    respond_to do |format|
      format.html { redirect_to fallback, alert: "このページは直接アクセスできません" }

      format.turbo_stream do
        if block
          block.call
        else
          render(*args, **kwargs)
        end
      end
    end
  end

  def redirect_old_render_domain
    old_host = "white-map.onrender.com"
    new_host = "shiroichizu.app"

    if request.host == old_host
      redirect_to "https://#{new_host}#{request.fullpath}", allow_other_host: true, status: :moved_permanently
    end
  end

  def custom_verifier
    ActiveSupport::MessageVerifier.new(Rails.application.secret_key_base, url_safe: true)
  end

  def set_locale
    I18n.locale = http_accept_language.compatible_language_from(I18n.available_locales) || I18n.default_locale
  end
end
