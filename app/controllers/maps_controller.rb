class MapsController < ApplicationController
  def new
  end

  def index
    flash[:notice] = "フラッシュテスト"
  end
end
