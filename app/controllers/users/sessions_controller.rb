# frozen_string_literal: true

class Users::SessionsController < Devise::SessionsController
  skip_before_action :refresh_session_expiration, only: [ :new, :create ]
  # before_action :configure_sign_in_params, only: [:create]

  # GET /resource/sign_in
  # def new
  #   super
  # end

  # POST /resource/sign_in
  def create
    # ログインしている場合はidを退避
    if @user
      user_id = @user.id
      sign_out(@user)
    end

    # ここで認証がうまく行くとログインする
    self.resource = warden.authenticate(auth_options)

    if resource
      set_flash_message!(:notice, :signed_in)
      sign_in(resource_name, resource)
      yield resource if block_given?
      respond_with resource, location: after_sign_in_path_for(resource)
    else
      if user_id
        @user = User.find(user_id)
        sign_in(@user)
      end

      self.resource = User.new(sign_in_params)
      self.resource.password = nil

      flash.now[:alert] = I18n.t("devise.failure.invalid", authentication_keys: "メールアドレス")
      render :new, status: :unprocessable_entity
    end
  end

  # DELETE /resource/sign_out
  # def destroy
  #   super
  # end

  protected

  # If you have extra params to permit, append them to the sanitizer.
  # def configure_sign_in_params
  #   devise_parameter_sanitizer.permit(:sign_in, keys: [:attribute])
  # end

  # ログインしている人は入れない設定
  def require_no_authentication
    # ログインチェック
    return unless warden.authenticated?(:user)

    # 勝手にデータを更新しないようにユーザーを取得
    @user = warden.user(:user)

    # ゲストなら飛ばしてcreateアクションへ
    if @user && @user.guest?
      return
    end

    super
  end
end
