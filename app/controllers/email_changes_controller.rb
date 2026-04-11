class EmailChangesController < ApplicationController
  before_action :authenticate_user!

  def edit
    token = params[:token]
    user = current_user

    data = custom_verifier.verify(token, purpose: :email_change_verifications)

    current_email = data["current_email"]
    new_email     = data["new_email"]
    token_uuid    = data["user_uuid"]

    same_user  = user.public_uid == token_uuid
    same_email = user.email.present? && user.email == current_email

    raise ActiveSupport::MessageVerifier::InvalidSignature unless same_user && same_email
    raise ActiveSupport::MessageVerifier::InvalidSignature if new_email.blank?

    user.update!(email: new_email)
    redirect_to mypage_path, notice: "メールアドレスを更新しました"
  rescue ActiveSupport::MessageVerifier::InvalidSignature
    # トークンが期限切れ、もしくは文字が書き換えられていた場合
    redirect_to mypage_path, alert: "リンクの有効期限が切れているか、無効なURLです。最初からやり直してください。"
  rescue ActiveRecord::RecordInvalid
    redirect_to account_setting_path, alert: "メールアドレスを更新できませんでした。入力内容を確認してください。"
  end
end
