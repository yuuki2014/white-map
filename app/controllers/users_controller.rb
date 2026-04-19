class UsersController < ApplicationController
  rescue_from ActiveRecord::RecordNotUnique, with: :record_not_unique
  before_action :set_user, only: %i[ show edit update ]

  def show
    if @user.present?
      render
    else
      redirect_to root_path
    end
  end

  def edit
    if @user.nil? || @user.guest?
      respond_modal("shared/flash_message", flash_message: { alert: "エラーのため編集できません" })
      return
    end
    respond_modal
  end

  def update
    if @user.nil? || @user.guest?
      respond_modal("shared/flash_message", flash_message: { alert: "エラーのため編集できません" })
      return
    end

    uploaded_file = params.dig(:user, :avatar)
    remove_avatar = params.dig(:user, :remove_avatar) == "1"

    if uploaded_file.present? && uploaded_file.size > 500.kilobytes
      @user.errors.add(:avatar, "のサイズが大きすぎます。不正なデータの可能性があります")
      return respond_modal("shared/flash_and_error", locals: { object: @user }, flash_message: { alert: "保存に失敗しました" })
    end

    old_avatar_url = current_avatar_public_url(@user)

    if @user.update(profile_params.except(:avatar))
      begin
        if remove_avatar
          @user.avatar.purge
          purge_cloudflare_url(old_avatar_url)

        elsif uploaded_file.present?
          @user.avatar.attach(
            io: uploaded_file.tempfile,
            filename: uploaded_file.original_filename,
            content_type: uploaded_file.content_type,
            key: avatar_key(@user, uploaded_file)
          )

          purge_cloudflare_url(old_avatar_url)
        end

        respond_modal
      rescue => e
        Rails.logger.error("Avatar update failed for user=#{@user.id}: #{e.class} #{e.message}")
        @user.errors.add(:avatar, "の保存に失敗しました")
        respond_modal("shared/flash_and_error", locals: { object: @user }, flash_message: { alert: "保存に失敗しました" })
      end
    else
      respond_modal("shared/flash_and_error", locals: { object: @user }, flash_message: { alert: "保存に失敗しました" })
    end
  end

  def mypage
    if user_signed_in? && current_user
      redirect_to user_path(current_user)
    else
      render
    end
  end

  private

  def current_avatar_public_url(user)
    return nil unless user.avatar.attached?

    key = user.avatar.blob.key
    "#{ENV.fetch("R2_PUBLIC_ASSETS_HOST")}/#{key}"
  end

  def purge_cloudflare_url(url)
    return if url.blank?

    conn = Faraday.new(url: "https://api.cloudflare.com")
    response = conn.post("/client/v4/zones/#{ENV.fetch("CLOUDFLARE_ZONE_ID")}/purge_cache") do |req|
      req.headers["Authorization"] = "Bearer #{ENV.fetch("CLOUDFLARE_CACHE_PURGE_API_TOKEN")}"
      req.headers["Content-Type"] = "application/json"
      req.body = { files: [url] }.to_json
    end

    Rails.logger.info("Cloudflare purge response: #{response.status} #{response.body}")
  end

  def avatar_key(user, uploaded_file)
    ext = File.extname(uploaded_file.original_filename).downcase
    "avatars/#{user.public_uid}/#{SecureRandom.uuid}#{ext}"
  end

  def record_not_unique
    Rails.logger.debug "ユニークじゃありません"
    # render plain: "404 Not Found", status: 404
  end

  def set_user
    @user = current_user if current_user
  end

  def profile_params
    params.require(:user).permit(:nickname, :avatar, :remove_avatar)
  end
end
