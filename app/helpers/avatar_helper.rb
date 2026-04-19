module AvatarHelper
  def avatar_url(user)
    return unless user.avatar.attached?

    "#{ENV.fetch("R2_PUBLIC_ASSETS_HOST")}/#{user.avatar.blob.key}"
  end
end
