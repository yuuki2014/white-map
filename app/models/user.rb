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

  # 「ゲスト以外」のときだけ、パスワードを必須にする
  def password_required?
    # ゲストなら false (いらない)、それ以外なら true (いる)
    !guest?
  end
end
