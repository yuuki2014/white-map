class Api::V1::TripsController < ApplicationController
  def create
    @trip = current_user&.trips&.build

    unless @trip
      flash.now[:alert] = "この機能はゲストか会員しか使えません"
      return respond_to do |format|
        format.html { redirect_to root_path }
        format.turbo_stream { render "shared/flash_message" }
      end
    end

    if @trip.save
      flash.now[:notice] = "探索を開始しました"
      respond_to do |format|
        format.html { redirect_to root_path }
        format.turbo_stream
      end
    else
      flash.now[:alert] = "地図の作成に失敗しました"
      respond_to do |format|
        format.html { redirect_to root_path }
        format.turbo_stream { render "shared/flash_message" }
      end
    end
  end

  def update
    @trip = current_user.trips.find(params[:id])

    @footprints = @trip.footprints.order(recorded_at: :asc)

    started_at = @footprints.first.recorded_at # 開始時刻
    ended_at   = @footprints.last.recorded_at  # 終了時刻
    activity_time = ended_at - started_at     # 活動時間
    total_distance = 0 # 総合距離

    if @trip.update(
      started_at: started_at,
      ended_at: ended_at,
      activity_time: activity_time,
      total_distance: total_distance)

      if current_user.general?
        respond_to do |format|
          format.html { redirect_to root_path }
          format.turbo_stream
        end
      elsif current_user.guest?
        respond_to do |format|
          format.html { redirect_to root_path }
          format.turbo_stream { render :guest_update }
        end
      end
    else
      flash.now[:alert] = "保存に失敗しました"
      Rails.logger.error @trip.errors.full_messages
      respond_to do |format|
        format.html { redirect_to root_path }
        format.turbo_stream { render "shared/flash_message" }
      end
    end
  # もしもデータが見つからなかった場合
  rescue ActiveRecord::RecordNotFound
    flash.now[:alert] = "データが見つかりません"
    respond_to do |format|
      format.turbo_stream { render "shared/flash_message" }
    end
  end

  def end_check
    @trip_id = params[:id]

    respond_to do |format|
      format.html { redirect_to root_path }
      format.turbo_stream
    end
  end
end
