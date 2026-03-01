class TripsController < ApplicationController
  def new
  end

  def show
    @trip = Trip.includes(:footprints).find_by(public_uid: params[:id])

    if @trip.present?
      if @trip.user_id == current_user&.id || @trip.visibility_unlisted? || @trip.visibility_public?
        @first_footprint = @trip.footprints.first
        @visited_geohashes =  @trip.footprints.distinct.pluck(:geohash)
        @posts = @trip.posts.where(visibility: "public")

        render
      else
        flash[:alert] = "地図が見つかりませんでした"
        redirect_to trips_path
      end
    else
      flash[:alert] = "地図が見つかりませんでした"
      redirect_to root_path
    end
  end

  def index
    if user_signed_in?
      @trips = current_user.trips.order(started_at: :desc)
      @geohash_counts = Footprint.where(trip_id: @trips.select(:id)).group(:trip_id).distinct.count(:geohash)
    else
      flash[:alert] = "この機能はゲストか会員しか使えません"
      redirect_to root_path
    end
  end

  def edit_title
    @trip = current_user&.trips&.find_by(public_uid: params[:id])

    if @trip.nil?
      respond_modal("shared/flash_message", flash_message: { alert: "権限がありません" })
      return
    end

    respond_modal
  end

  def update_title
    @trip = current_user&.trips&.find_by(public_uid: params[:id])

    if @trip.nil?
      respond_modal("shared/flash_message", flash_message: { alert: "権限がありません" })
      return
    end

    if @trip.update(title: trip_param_title[:title])
      respond_modal(flash_message: { notice: "タイトルを更新しました" })
    else
      respond_modal("shared/flash_and_error", locals: { object: @trip }, flash_message: { alert: "タイトルの更新に失敗しました" })
    end
  end

  def edit_status
    @trip = current_user&.trips&.find_by(public_uid: params[:id])

    if @trip.nil?
      respond_modal("shared/flash_message", flash_message: { alert: "権限がありません" })
      return
    end

    respond_modal
  end

  def update_status
    @trip = current_user.trips.find_by(public_uid: params[:id])

    # x に投稿ボタンを押して、公開設定が「自分だけ」以外の時はreturnする
    return if params.dig(:trip, :x) && !@trip.visibility_private?

    if @trip.nil?
      respond_modal("shared/flash_message", flash_message: { alert: "不正な Trip Id が検出されました" })
      return
    end

    if @trip.update(trip_param_status)
      respond_modal(flash_message: { notice: "公開設定を更新しました" })
    else
      respond_modal("shared/flash_message", flash_message: { alert: "公開設定の更新に失敗しました" })
    end
  rescue ArgumentError => e
    Rails.logger.warn "不正なEnum値によるエラー: #{e.message}"

    respond_modal("shared/flash_message", flash_message: { alert: "公開設定に不正な値が指定されました" })
  end

  def confirm_destroy
    @trip = current_user&.trips&.find_by(public_uid: params[:id])

    unless @trip
      respond_modal("shared/flash_message", flash_message: { alert: "削除できません" })
      return
    end

    respond_modal
  end

  def destroy
    @trip = current_user.trips.find_by(public_uid: params[:id])

    if @trip.nil?
      respond_modal("shared/flash_message", flash_message: { alert: "この地図は削除できません" })
      return
    end

    if @trip.destroy
      redirect_to trips_path, notice: "地図を削除しました"
    else
      respond_modal("shared/flash_and_error", locals: { object: @trip }, flash_message: { alert: "地図の削除に失敗しました" })
    end
  end

  private

  def trip_param_status
    params.require(:trip).permit(:status)
  end

  def trip_param_title
    params.require(:trip).permit(:title)
  end
end
