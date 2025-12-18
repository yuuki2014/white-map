class ApplicationController < ActionController::Base
  # Only allow modern browsers supporting webp images, web push, badges, import maps, CSS nesting, and CSS :has.
  allow_browser versions: :modern
  before_action :refresh_session_expiration

  private

  def refresh_session_expiration
    current_user if current_user
  end
end
