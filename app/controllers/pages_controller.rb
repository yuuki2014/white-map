class PagesController < ApplicationController
  def terms
    respond_to do |format|
      format.html { redirect_to root_path }
      format.turbo_stream
    end
  end

  def privacy_policy
    respond_to do |format|
      format.html { redirect_to root_path }
      format.turbo_stream
    end
  end
end
