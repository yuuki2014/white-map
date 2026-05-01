class Explore::PostsController < ApplicationController
  def index
    ok_posts = Post.listed_publicly

    @posts = ok_posts.includes(:trip, user: { avatar_attachment: :blob }).with_attached_images.order(visited_at: :desc)

    MediaAccessGrantService.call(posts: @posts, cookies: cookies)
  end
end
