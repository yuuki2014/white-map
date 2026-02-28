class Api::V1::TripsController < ApplicationController
  before_action :authenticate_user!

  def create
    last_trip = current_user&.trips&.last # 最後の探索を取得

    if last_trip.nil? || last_trip.ended_at.present?
      # 最後の探索が完了していた場合。通常の探索を開始
      @trip = execute_create_trip

      if @trip
        respond_modal(:create, flash_message: { notice: "探索を開始しました" })
      else
        respond_modal("shared/flash_and_error", flash_message: { alert: "地図の作成に失敗しました" })
      end
    else
      # 前回の探索が完了していなかった場合。モーダルを表示
      @trip_id = last_trip.public_uid

      respond_modal(:last_trip_check)
    end
  end

  def update
    @trip = current_user.trips.find_by(public_uid: params[:id])

    if execute_finish_trip(@trip)
      if current_user.general?
        respond_modal
      elsif current_user.guest?
        respond_modal(:guest_update)
      end
    else
      respond_modal("shared/flash_message", flash_message: { alert: "保存に失敗しました" })
    end
  # もしもデータが見つからなかった場合
  rescue ActiveRecord::RecordNotFound
    respond_modal("shared/flash_message", flash_message: { alert: "データがみつかりません" })
  end

  def end_check
    @trip_id = params[:id]

    respond_modal
  end

  def resume
    @trip = current_user&.trips&.find_by(public_uid: params[:id])
    @visited_geohashes =  @trip&.footprints.distinct.pluck(:geohash)
    @posts = @trip&.posts

    if @trip
      respond_modal(:create, flash_message: { notice: "探索の続きを開始しました" })
    else
      respond_modal("shared/flash_and_error", flash_message: { alert: "処理に失敗しました" })
    end
  end

  def finish_and_create
    old_trip = current_user.trips.find_by(public_uid: params[:id])

    ActiveRecord::Base.transaction do
      # 過去の探索を終了させる
      unless execute_finish_trip(old_trip)
        raise ActiveRecord::Rollback, "Failed to finish old trip"
      end

      # 新しい探索を開始する
      @trip = execute_create_trip
      unless @trip
        raise ActiveRecord::Rollback, "Faild to create new trip"
      end
    end

    if @trip
      respond_modal(:create, flash_message: { notice: "前回の探索を記録し、新しい探索を開始しました" })
    else
      respond_modal("shared/flash_and_error", flash_message: { alert: "処理に失敗しました" })
    end
  rescue ActiveRecord::RecordNotFound
    respond_modal("shared/flash_message", flash_message: { alert: "データが見つかりません" })
  end

  private

  def execute_create_trip
    trip = current_user&.trips&.build
    return nil unless trip

    trip.save && trip
  end

  def execute_finish_trip(trip)
    footprints = trip.footprints.order(recorded_at: :asc)
    return false if footprints.empty?

    started_at = footprints.first.recorded_at # 開始時刻
    ended_at   = footprints.last.recorded_at  # 終了時刻
    activity_time = ended_at - started_at     # 活動時間
    total_distance = 0 # 総合距離

    trip.update(
      started_at: started_at,
      ended_at: ended_at,
      activity_time: activity_time,
      total_distance: total_distance)
  end
end
