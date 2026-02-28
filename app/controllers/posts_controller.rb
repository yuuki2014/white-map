class PostsController < ApplicationController
  before_action :set_trip, only: %i[ new create select_position ]

  def new
    return respond_modal("shared/flash_message", flash_message: { alert: "場所を選択してください" }) if params[:lat].nil? || params[:lng].nil?

    @post = @trip.posts.new(
      latitude: params[:lat],
      longitude: params[:lng]
    )

    respond_modal
  end

  def create
    @post = @trip.posts.new(post_params)
    @post.user = current_user

    if @post.save
      respond_modal(flash_message: { notice: "地図に記録しました" })
    else
      respond_modal("shared/flash_and_error", locals: { object: @post }, flash_message: { alert: "記録に失敗しました" })
    end
  end

  def select_position
    respond_modal
  end

  private

  def post_params
    params.require(:post).permit(:body, :latitude, :longitude)
  end

  def set_trip
    @trip = current_user.trips.find_by(public_uid: params[:id])
  end
end
