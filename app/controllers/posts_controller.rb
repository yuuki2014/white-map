class PostsController < ApplicationController
  def new
    @trip = current_user.trips.find_by(id: params[:id])
    @post = @trip.posts.new(user: current_user)

    respond_to do |format|
      format.html { redirect_to root_path }
      format.turbo_stream
    end
  end

  def create
    @trip = current_user.trips.find_by(id: params[:id])
    @post = @trip.posts.new(post_params)
    @post.user = current_user

    if @post.save
      flash.now[:notice] = "地図に記録しました"
      respond_to do |format|
        format.html { redirect_to root_path }
        format.turbo_stream
      end
    else
      flash.now[:alert] = "記録に失敗しました"
      respond_to do |format|
        format.html { redirect_to root_path }
        format.turbo_stream { render "shared/flash_and_error" }
      end
    end
  end

  def select_position
    @trip = current_user.trips.find_by(id: params[:id])

    respond_to do |format|
      format.html { redirect_to root_path }
      format.turbo_stream
    end
  end

  def post_flash
    flash.now[:alert] = "場所を選択してください"
    respond_to do |format|
      format.html { redirect_to root_path }
      format.turbo_stream
    end
  end

  private

  def post_params
    params.require(:post).permit(:body, :latitude, :longitude)
  end
end
