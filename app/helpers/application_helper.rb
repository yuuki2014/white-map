module ApplicationHelper
  def tab_class(path)
    base = "flex-1 flex flex-col items-center justify-center gap-1 text-gray-400 active:scale-95 transition hover:bg-gray-100 rounded-xl user-select: none"

    if current_page?(path)
      "#{base} text-gray-900 font-medium"
    else
      "#{base} text-gray-400"
    end
  end

  # フッター表示用
  def show_footer?
    allowed_paths = [
      root_path,
      mypage_path
    ]

    if current_user
      allowed_paths << user_path(current_user)
    end

    allowed_paths.include?(request.path)
  end

  def mypage_card(show_elements)
    tag.div(class: "bg-white rounded-xl shadow-md p-4 mb-4") do
      items = show_elements.map do |element|
        tag.div(class: "flex justify-between items-center border-b border-gray-200 py-2 last:border-b-0 text-gray-700") do
          element
        end
      end

      safe_join(items)
    end
  end
end
