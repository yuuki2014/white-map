class User < ApplicationRecord
  # Include default devise modules. Others available are:
  # :confirmable, :lockable, :timeoutable, :trackable and :omniauthable
  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable

  # enum 定義
  # ゲスト:0, 一般会員:10, 管理者:99
  enum :role, { guest: 0, general: 10, admin: 99 }
  # 非公開:0, 限定公開:10, 公開:20
  enum :map_privacy, { private: 0, limited: 10, public: 20 }, prefix: :map

  # バリデーション定義
  # UUIDは保存の直前にDBが生成してくれるので、ここでは設定しない
  validates :nickname, :role, :map_privacy, presence: true

  # Devise の機能をオーバーライド
  # ゲスト以外の時だけメールアドレスを必須にする
  def email_required?
    # ゲストなら false (いらない)、それ以外なら true (いる)
    !guest?
  end

  def remember_expires_at
    time = remember_created_at || Time.now.utc

    case role
    when "guest"
      time + 180.day
    when "general"
      time + 365.day
    when "admin"
      time + 1.day
    else
      time + 2.weeks
    end
  end

  # guestユーザー作成
  def self.create_guest
    guest_password = SecureRandom.urlsafe_base64

    create!(
      nickname: "ゲスト",
      role: "guest",
      map_privacy: "private",
      email: nil,
      password: guest_password,
    )
  end

  # 認証が完了した瞬間に自動で呼ばれるメソッド(Devise)
  def after_confirmation
    # デフォルトの処理を実行
    super

    # 認証時にゲストの場合はroleとユーザー名を更新
    if role == "guest"
      updates = { role: :general }

      if nickname.blank? || nickname == "ゲスト"
        updates[:nickname] = "ユーザー"
      end

      # バリデーションを無視して強制更新
      update_columns(updates)
    end
  end

  # User モデルの :id を public_uidに
  def to_param
    public_uid
  end
end
