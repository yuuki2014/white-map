class PostsController < ApplicationController
  before_action :set_trip, only: %i[ new create select_position ]

  def index
    @posts = current_user
                .posts
                .includes(:trip, user: { avatar_attachment: :blob })
                .with_attached_images
                .order(visited_at: :desc)

    MediaAccessGrantService.call(posts: @posts, cookies: cookies)
  end

  def new
    return respond_modal("shared/flash_message", flash_message: { alert: "場所を選択してください" }) if params[:lat].nil? || params[:lng].nil?

    @post = @trip.posts.new(
      latitude: params[:lat],
      longitude: params[:lng]
    )

    respond_modal
  end

  def create
    @post = @trip.posts.new(post_params.except(:images))
    @post.user = current_user
    @images = Array(params.dig(:post, :images).compact_blank)
    @post.incoming_images_present = @images.present?

    @images.each do |image|
      if image.size > 5.megabytes
        @post.errors.add(:images, "のサイズが大きすぎます。不正なデータの可能性があります。")
        return respond_modal("shared/flash_and_error", locals: { object: @post }, flash_message: { alert: "保存に失敗しました" })
      end
    end

    if @post.save
      begin
        PostImageAttachService.call(post: @post, files: @images)
        ProcessPostImagesJob.perform_later(@post.id)
        respond_modal(flash_message: { notice: "地図に記録しました" })
      rescue => e
        Rails.logger.error("Post image attach failed: #{e.class} #{e.message}")
        purge_cloudflare_urls(media_origin_urls(@post))
        @post.destroy
        respond_modal("shared/flash_and_error", locals: { object: @post }, flash_message: { alert: "画像の保存に失敗しました。もう一度お試しください" })
      end
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

    if @post.visible_to?(current_user)
      MediaAccessGrantService.call(posts: @post, cookies: cookies)
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
    @post = current_user.posts.with_attached_images.find_by(public_uid: params[:id])

    if @post.nil?
      respond_modal("shared/flash_message", flash_message: { alert: "この記録は削除できません" })
      return
    end

    urls = media_origin_urls(@post)
    @post_dom_id = helpers.dom_id(@post)

    if @post.destroy
      PurgeCloudflareUrlsJob.perform_later(urls)
      respond_modal(flash_message: { notice: "記録を削除しました" })
    else
      respond_modal("shared/flash_and_error", locals: { object: @post }, flash_message: { alert: "記録の削除に失敗しました" })
    end
  end

  private

  def media_origin_url_for_key(key)
    "https://#{ENV.fetch('MEDIA_ORIGIN_HOST')}/#{key}"
  end

  def media_origin_urls(post)
    return [] unless post.images.attached?

    urls = []

    post.images.each do |image|
      urls << media_origin_url_for_key(image.blob.key)
      urls << media_origin_url_for_key(image.variant(:thumb).key)
      urls << media_origin_url_for_key(image.variant(:map_icon).key)
    end

    urls.compact.uniq
  end

  def post_params
    params.require(:post).permit(:body, :latitude, :longitude, :visited_at, images: [])
  end

  def set_trip
    @trip = current_user.trips.find_by(public_uid: params[:trip_id])
  end
end
