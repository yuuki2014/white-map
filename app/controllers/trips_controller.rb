class TripsController < ApplicationController
  def new
  end

  def show
    if user_signed_in?
      @trip = current_user.trips.includes(:footprints).find_by(id: params[:id])

      if @trip.present?
        @first_footprint = @trip.footprints.first

        @visited_geohashes =  @trip.footprints.flat_map do |footprint|
                        [ footprint.geohash ] + GeoHash.neighbors(footprint.geohash)
                      end.uniq

        render
      else
        flash[:alert] = "その地図にはアクセス出来ません"
        redirect_to trips_path
      end
    else
      redirect_to root_path
    end
  end

  def index
    if user_signed_in?
      @trips = current_user.trips
      @geohash_counts = Footprint.where(trip_id: @trips.select(:id)).group(:trip_id).distinct.count(:geohash)
    else
      redirect_to root_path
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
    @trip = current_user.trips.find_by(id: params[:id])

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
end
