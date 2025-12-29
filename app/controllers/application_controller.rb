class ApplicationController < ActionController::Base
  # Only allow modern browsers supporting webp images, web push, badges, import maps, CSS nesting, and CSS :has.
  allow_browser versions: :modern
  before_action :refresh_session_expiration

  private

  def refresh_session_expiration
    if user_signed_in?
      current_user
      cookies.permanent[:tutorials_end] = "true"
      cookies.permanent[:terms_accepted] = "true"
    end
  end
end
