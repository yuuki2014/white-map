# frozen_string_literal: true

class Users::RegistrationsController < Devise::RegistrationsController
  # before_action :configure_sign_up_params, only: [:create]
  # before_action :configure_account_update_params, only: [:update]

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
    if current_user && current_user&.role == "guest"
      self.resource = current_user

      # フォームの入力値（メアド・パスワード）をセット
      resource.assign_attributes(sign_up_params)

      if resource.email_changed? && resource.respond_to?(:confirmation_token)
        # メール認証ありの場合は何もしない
        # 認証後にゲストデータを会員用に変更
      else
        # 会員用にデータを変更
        resource.role = "general"
        resource.nickname = "ユーザー"
      end

      if resource.save
        # セッション切断を防ぐために再ログイン処理をする
        bypass_sign_in(resource)

        # データベース上の準備（トークン生成,日付更新）
        resource.remember_me!

        # ブラウザへ渡す
        cookies.signed["remember_user_token"] = {
          value: resource.class.serialize_into_cookie(resource),
          expires: resource.remember_expires_at,
          domain: :all
        }

        # メール認証待ち（pending_reconfirmation?）でメッセージを変える
        if resource.respond_to?(:pending_reconfirmation?) && resource.pending_reconfirmation?
          # 認証メール送信メッセージ
          set_flash_message! :notice, :update_needs_confirmation
        else
          # 認証不要なので登録完了メッセージ
          set_flash_message! :notice, :signed_up
        end

        respond_with resource, location: after_sign_up_path_for(resource)
      else
        clean_up_passwords resource
        set_minimum_password_length
        respond_with resource
      end

    # guestアカウントなしで新規登録する場合
    else
      build_resource(sign_up_params)

      # 新規登録用の初期データ
      resource.role = "general"
      resource.nickname = "ユーザー"
      resource.remember_me = true

      resource.save
      yield resource if block_given?
      if resource.persisted?
        if resource.active_for_authentication?
          set_flash_message! :notice, :signed_up
          sign_up(resource_name, resource)
          respond_with resource, location: after_sign_up_path_for(resource)
        else
          set_flash_message! :notice, :"signed_up_but_#{resource.inactive_message}"
          expire_data_after_sign_in!
          respond_with resource, location: after_inactive_sign_up_path_for(resource)
        end
      else
        clean_up_passwords resource
        set_minimum_password_length
        respond_with resource
      end
    end
  end
  # GET /resource/edit
  # def edit
  #   super
  # end

  # PUT /resource
  # def update
  #   super
  # end

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
end
