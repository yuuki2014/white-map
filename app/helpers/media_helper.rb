module MediaHelper
  def media_image_url(key)
    "#{ENV.fetch("MEDIA_BASE_URL")}/#{key}"
  end
end
