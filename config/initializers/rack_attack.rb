class Rack::Attack
  # IPごとのリクエスト制限
  throttle("req/ip", limit: 1000, period: 5.minutes) do |req|
    req.ip
  end

  # ログイン制限
  throttle("logins/ip", limit: 10, period: 1.minute) do |req|
    if req.path == "/users/sign_in" && req.post?
      req.ip
    end
  end

  # 怪しいパス遮断
  blocklist("block suspicious paths") do |req|
    req.path.include?("wp-admin") ||
    req.path.include?(".env") ||
    req.path.include?("phpmyadmin") ||
    req.path.include?("wp-login") ||
    req.path.include?("/.git") ||
    req.path.include?("/config") ||
    req.path.include?("/vendor")
  end

  # 制限がかかった時に返す設定
  self.throttled_responder = lambda do |request|
    if request.path == "/users/sign_in"
      body = <<~HTML
        <turbo-stream action="prepend" target="flash">
          <template>
            <div data-controller="flash"
              class="flash-message alert pointer-events-auto px-4 py-2 rounded-xl min-w-[180px] text-center text-white text-sm font-medium shadow-lg select-none opacity-0 -translate-y-2 transition-all duration-300 bg-red-500">
              ログイン試行回数が多すぎます。少し待ってからもう一度お試しください。
            </div>
          </template>
        </turbo-stream>
      HTML
      [429,{ "Content-Type" => "text/vnd.turbo-stream.html; charset=utf-8" },[body]]
    else
      body = File.read(Rails.root.join("public/429.html"))
      [429, { "Content-Type" => "text/html; charset=utf-8" }, [body]]
    end
  end
end
