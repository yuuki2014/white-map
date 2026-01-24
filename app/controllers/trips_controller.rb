class TripsController < ApplicationController
  def new
  end

  def show
    @trip = Trip.includes(:footprints).find_by(id: params[:id])

    if @trip.present?
      if @trip.user_id == current_user&.id || @trip.visibility_unlisted? || @trip.visibility_public?
        @first_footprint = @trip.footprints.first
        @visited_geohashes =  @trip.footprints.flat_map do |footprint|
                        [ footprint.geohash ] + GeoHash.neighbors(footprint.geohash)
                      end.uniq

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
      @trips = current_user.trips
      @geohash_counts = Footprint.where(trip_id: @trips.select(:id)).group(:trip_id).distinct.count(:geohash)
    else
      flash[:alert] = "この機能はゲストか会員しか使えません"
      redirect_to root_path
    end
  end

  def edit_title
    @trip = current_user&.trips&.find_by(id: params[:id])

    if @trip.nil?
      flash.now[:alert] = "権限がありません"
      return respond_to do |format|
        format.html { redirect_to root_path }
        format.turbo_stream { render "shared/flash_message" }
      end
    end

    respond_to do |format|
      format.html { redirect_to root_path }
      format.turbo_stream
    end
  end

  def update_title
    @trip = current_user&.trips&.find_by(id: params[:id])

    if @trip.nil?
      flash.now[:alert] = "権限がありません"
      return respond_to do |format|
        format.html { head :not_acceptable }
        format.turbo_stream { render "shared/flash_message" }
      end
    end

    if @trip.update(title: trip_param_title[:title])
      respond_to do |format|
        format.html { head :not_acceptable }
        format.turbo_stream do
          flash.now[:notice] = "タイトルを更新しました"
          render
        end
      end
    else
      respond_to do |format|
        format.html { head :not_acceptable }
        format.turbo_stream do
          flash.now[:alert] = "タイトルの更新に失敗しました"
          render "shared/flash_and_error"
        end
      end
    end
  end

  def edit_status
    @trip = current_user&.trips&.find_by(id: params[:id])

    if @trip.nil?
      flash.now[:alert] = "権限がありません"
      return respond_to do |format|
        format.html { redirect_to root_path }
        format.turbo_stream { render "shared/flash_message" }
      end
    end

    respond_to do |format|
      format.html { redirect_to root_path }
      format.turbo_stream
    end
  end

  def status
    @trip = current_user.trips.find_by(id: params[:id])

    # x に投稿ボタンからここにきて、公開設定が自分だけ以外の時はreturnで変更なし
    return if params.dig(:trip, :x) && !@trip.visibility_private?

    if @trip.nil?
      flash.now[:alert] = "不正な Trip Id が検出されました。"
      return respond_to do |format|
        format.html { redirect_to root_path }
        format.turbo_stream { render "shared/flash_message" }
      end
    end

    if @trip.update(trip_param_status)
      flash.now[:notice] = "公開設定を更新しました。"
      respond_to do |format|
        format.html { redirect_to root_path }
        format.turbo_stream
      end
    else
      flash.now[:alert] = "公開設定の更新に失敗しました。"
      respond_to do |format|
        format.html { redirect_to root_path }
        format.turbo_stream { render "shared/flash_message" }
      end
    end
  rescue ArgumentError => e
    Rails.logger.warn "不正なEnum値によるエラー: #{e.message}"

    flash.now[:alert] = "公開設定に不正な値が指定されました。"
    respond_to do |format|
      format.html { redirect_to root_path }
      format.turbo_stream { render "shared/flash_message" }
    end
  end

  def confirm_destroy
    @trip = current_user&.trips&.find_by(id: params[:id])

    unless @trip
      flash.now[:alert] = "削除できません"
      respond_to do |format|
        format.html { redirect_to root_path }
        format.turbo_stream { render "shared/flash_message" }
      end
    end

    respond_to do |format|
      format.html { redirect_to root_path }
      format.turbo_stream
    end
  end

  def destroy
    @trip = current_user.trips.find_by(id: params[:id])

    if @trip.nil?
      flash.now[:alert] = "この地図は削除できません"
      respond_to do |format|
        format.html { redirect_to root_path }
        format.turbo_stream { render "shared/flash_message" }
      end
    end

    if @trip.destroy
      redirect_to trips_path, notice: "地図を削除しました"
    else
      flash.now[:alert] = "地図の削除に失敗しました"
      respond_to do |format|
        format.html { redirect_to root_path }
        format.turbo_stream { render "shared/flash_message" }
      end
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
