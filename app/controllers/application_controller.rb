class ApplicationController < ActionController::Base
  # Only allow modern browsers supporting webp images, web push, badges, import maps, CSS nesting, and CSS :has.
  allow_browser versions: :modern
  before_action :refresh_session_expiration, :set_back_url

  private

  def refresh_session_expiration
    if user_signed_in?
      current_user
      cookies.permanent[:tutorials_end] = "true"
      cookies.permanent[:terms_accepted] = "true"
    end
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
end
