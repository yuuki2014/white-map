class Internal::PostImagesController < ApplicationController
  skip_forgery_protection

  def authorize
    return head :forbidden unless valid_worker_secret? # リクエストを検証

    # 渡されたkeyから、blobを取得
    blob = ActiveStorage::Blob.find_by(key: params[:key])
    return render json: { ok: false }, status: :not_found unless blob

    attachment = ActiveStorage::Attachment.find_by(blob_id: blob.id)

    if attachment&.record_type == "Post" && attachment.name == "images" # 画像が元画像の時
      post = Post.find_by(id: attachment.record_id)

    elsif attachment&.record_type == "ActiveStorage::VariantRecord" # 画像がvariantの時
      variant = ActiveStorage::VariantRecord.find_by(id: attachment.record_id)
      original_blob = variant&.blob
      original_attachment = ActiveStorage::Attachment.find_by(
        blob_id: original_blob&.id,
        record_type: "Post",
        name: "images"
      )
      post = Post.find_by(id: original_attachment&.record_id)
    end

    return render json: { ok: false }, status: :not_found unless post

    # 認可設定
    allowed = post.visible_to?(current_user)

    render json: { ok: allowed }
  end

  private

  # 検証
  def valid_worker_secret?
    stored_token = ENV.fetch("WORKER_SHARED_SECRET")
    provided_token = request.headers["X-Worker-Secret"].to_s

    return false if provided_token.blank?
    return false unless provided_token.bytesize == stored_token.bytesize

    ActiveSupport::SecurityUtils.secure_compare(stored_token, provided_token)
  end
end
