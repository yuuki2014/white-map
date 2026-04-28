module PostImagesHelper
  def image_orientation(image)
    width  = image.blob.metadata["width"].to_i
    height = image.blob.metadata["height"].to_i

    return :unknown unless width.positive? && height.positive?
    return :portrait if height > width
    return :landscape if width > height

    :square
  end

  def single_post_image_frame_class(image)
    orientation = image_orientation(image)

    base = "relative w-full max-w-lg mx-auto overflow-hidden rounded-xl"

    case orientation
    when :portrait
      "#{base} aspect-[3/4] max-h-[460px]"
    else
      "#{base} max-h-[360px]"
    end
  end

  def single_post_image_class(image)
    orientation = image_orientation(image)

    case orientation
    when :portrait
      "max-w-full max-h-full object-contain rounded-lg opacity-0 mx-auto"
    else
      "w-full h-full object-cover opacity-0"
    end
  end
end
