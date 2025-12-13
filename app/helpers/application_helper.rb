module ApplicationHelper
  def tab_class(path)
    base = "flex-1 flex flex-col items-center justify-center gap-1 text-gray-400 active:scale-95 transition hover:bg-gray-100 rounded-xl user-select: none"

    if current_page?(path)
      "#{base} text-gray-900 font-medium"
    else
      "#{base} text-gray-400"
    end
  end
end
