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

    if params[:post] && params[:post][:images].present?
      params[:post][:images].each do |image|
        if image.size > 5.megabytes
          @post.errors.add(:images, "のサイズが大きすぎます。不正なデータの可能性があります。")
          return respond_modal("shared/flash_and_error", locals: { object: @post }, flash_message: { alert: "保存に失敗しました" })
        end
      end
    end

    if @post.save
      respond_modal(flash_message: { notice: "地図に記録しました" })
    else
      respond_modal("shared/flash_and_error", locals: { object: @post }, flash_message: { alert: "記録に失敗しました" })
    end
  end

  def select_position
    respond_modal
  end

  def preview
    @post = Post.includes(:trip, user: { avatar_attachment: :blob }).with_attached_images.find_by(public_uid: params[:id])

    if @post.nil?
      return respond_modal("shared/flash_message", flash_message: { alert: "投稿が見つかりません" })
    end

    if @post.user == current_user || ((@post.trip.visibility_unlisted? || @post.trip.visibility_public?) && @post.visibility_public?)
      respond_modal
    else
      respond_modal("shared/flash_message", flash_message: { alert: "この投稿は表示できません" })
    end
  end

  def show
    preview
  end

  def image_viewer
    preview
  end

  def confirm_destroy
    @post = current_user&.posts&.find_by(public_uid: params[:id])

    unless @post
      respond_modal("shared/flash_message", flash_message: { alert: "削除できません" })
      return
    end

    respond_modal
  end

  def destroy
    @post = current_user.posts.find_by(public_uid: params[:id])

    if @post.nil?
      respond_modal("shared/flash_message", flash_message: { alert: "この記録は削除できません" })
      return
    end

    if @post.destroy
      respond_modal(flash_message: { alert: "記録を削除しました" })
    else
      respond_modal("shared/flash_and_error", locals: { object: @post }, flash_message: { alert: "記録の削除に失敗しました" })
    end
  end

  private

  def post_params
    params.require(:post).permit(:body, :latitude, :longitude, images: [])
  end

  def set_trip
    @trip = current_user.trips.find_by(public_uid: params[:id])
  end
end
