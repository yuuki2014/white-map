module ApplicationHelper
  def tab_class(path)
    base = "flex-1 flex flex-col items-center justify-center gap-1 text-gray-400 active:scale-95 transition hover:bg-gray-100 rounded-xl user-select: none"

    is_active = current_page?(path)

    # mypageからリダイレクトされて開いているユーザー詳細ページもアクティブに
    if user_signed_in?
      if path == user_path(current_user)
        if controller_name == "users" && action_name == "show"
          is_active = true
        end
      end
    end

    if is_active
      "#{base} text-gray-900 font-medium"
    else
      "#{base} text-gray-400"
    end
  end

  # フッター表示用
  def show_footer?
    allowed_paths = [
      root_path,
      trips_path,
      mypage_path
    ]

    if user_signed_in?
      allowed_paths << user_path(current_user)
    end

    allowed_paths.include?(request.path)
  end

  def show_recording_button?
    allowed_paths = [
      root_path
    ]

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

  def format_duration(seconds)
    hours = (seconds / 3600) || 0
    minutes = ((seconds % 3600) / 60) || 0
    sec = ((seconds % 3600) % 60) || 0

    "#{hours}時間#{minutes}分#{sec}秒"
  end
end
