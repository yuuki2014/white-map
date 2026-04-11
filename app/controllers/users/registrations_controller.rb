# frozen_string_literal: true

class Users::RegistrationsController < Devise::RegistrationsController
  # before_action :configure_sign_up_params, only: [:create]
  # before_action :configure_account_update_params, only: [:update]
  before_action :load_verified_email_from_token, only: %i[ new create ]

  # GET /resource/sign_up
  # def new
  #   super
  # end

  # POST /resource
  # def create
  #   super
  # end
  def create
    # ゲストユーザーが本登録する場合
    if current_user&.role == "guest"
      self.resource = current_user

      # フォームの入力値（メアド・パスワード）をセット
      resource.assign_attributes(sign_up_params)

      # 会員用にデータを変更
      resource.role = "general"
      resource.nickname = "ユーザー"
      resource.email = @email

      if resource.save
        # セッション切断を防ぐために再ログイン処理をする
        bypass_sign_in(resource)

        # データの準備（トークン生成,日付更新）
        resource.remember_me!

        # ブラウザへ渡す
        cookies.signed["remember_user_token"] = {
          value: resource.class.serialize_into_cookie(resource),
          expires: resource.remember_expires_at,
          domain: :all
        }

        # メール認証待ち
        if resource.respond_to?(:pending_reconfirmation?) && resource.pending_reconfirmation?
          # 認証メール送信メッセージ
          set_flash_message! :notice, :update_needs_confirmation
        else
          # 認証不要なので登録完了メッセージ
          set_flash_message! :notice, :signed_up
        end

        respond_with resource, location: after_sign_up_path_for(resource) # 登録完了後の場所へ飛ぶ
      else
        clean_up_passwords resource
        set_minimum_password_length
        render :new, status: :unprocessable_entity
      end
    # guestアカウントなしで新規登録する場合
    else
      build_resource(sign_up_params) # resource = User.new(user_params)

      # 新規登録用の初期データ
      resource.role = "general"
      resource.nickname = "ユーザー"
      resource.remember_me = true
      resource.email = @email

      resource.save
      yield resource if block_given? # ブロックが渡されていたらここで実行
      if resource.persisted? # 保存されているかチェック
        if resource.active_for_authentication? # 今すぐログインできるかチェック
          set_flash_message! :notice, :signed_up
          sign_up(resource_name, resource) # ログイン処理
          respond_with resource, location: after_sign_up_path_for(resource) # ログイン後のページに移動
        else
          set_flash_message! :notice, :"signed_up_but_#{resource.inactive_message}" # 登録は完了したけど認証がまだだよメッセージ
          expire_data_after_sign_in! # 登録中の中途半端なデータを掃除して、認証待ち
          respond_with resource, location: after_inactive_sign_up_path_for(resource) # 認証待ち用のページへ
        end
      else
        clean_up_passwords resource # パスワードを空に
        set_minimum_password_length # 最低文字数のために「@minimum_password_length」をセット
        render :new, status: :unprocessable_entity
      end
    end
  end
  # GET /resource/edit
  # def edit
  #   super
  # end

  # PUT /resource
  def update
    params[:user]&.delete(:email)

    if params.dig(resource_name, :password).blank?
      self.resource = resource_class.to_adapter.get!(send(:"current_#{resource_name}").to_key)
      resource.errors.add(:password, "を入力してください")
      clean_up_passwords(resource)
      set_minimum_password_length
      return respond_with resource
    end

    super
  end

  # DELETE /resource
  # def destroy
  #   super
  # end

  # GET /resource/cancel
  # Forces the session data which is usually expired after sign
  # in to be expired now. This is useful if the user wants to
  # cancel oauth signing in/up in the middle of the process,
  # removing all OAuth session data.
  # def cancel
  #   super
  # end

  protected

  def after_update_path_for(resource)
    new_user_session_path
  end

  # If you have extra params to permit, append them to the sanitizer.
  # def configure_sign_up_params
  #   devise_parameter_sanitizer.permit(:sign_up, keys: [:attribute])
  # end

  # If you have extra params to permit, append them to the sanitizer.
  # def configure_account_update_params
  #   devise_parameter_sanitizer.permit(:account_update, keys: [:attribute])
  # end

  # The path used after sign up.
  # def after_sign_up_path_for(resource)
  #   super(resource)
  # end

  # The path used after sign up for inactive accounts.
  # def after_inactive_sign_up_path_for(resource)
  #   super(resource)
  # end

  # ログインしている人は入れない設定
  def require_no_authentication
    # ゲストなら何もしない
    if current_user&.role == "guest"
      return
    end
    # ゲスト以外はDeviseの標準処理を実行
    super
  end

  private

  def load_verified_email_from_token
    @token = params[:token]
    @email = custom_verifier.verify(@token, purpose: :email_verifications).to_s.strip.downcase

    # userが登録ずみかチェック
    redirect_to mypage_path, alert: "すでに登録済みのメールアドレスです" if User.exists?(email: @email)
  # トークンが期限切れ、もしくは文字が書き換えられていた場合
  rescue ActiveSupport::MessageVerifier::InvalidSignature
    redirect_to mypage_path, alert: "リンクの有効期限が切れているか、無効なURLです。最初からやり直してください。"
  end
end
