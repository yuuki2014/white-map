class ContactsController < ApplicationController
  before_action :user_login?

  MAX_SUBJECT_LENGTH = 100
  MAX_BODY_LENGTH = 2000
  HOURLY_LIMIT = 5

  def show
    respond_modal
  end

  def create
    subject = params[:subject].to_s.strip
    body = params[:body].to_s.strip

    if subject.blank? || body.blank?
      return respond_modal("shared/flash_message", flash_message: { alert: "件名と本文を入力してください" })
    end

    if subject.length > MAX_SUBJECT_LENGTH || body.length > MAX_BODY_LENGTH
      return respond_modal("shared/flash_message", flash_message: { alert: "入力内容が長すぎます" })
    end

    unless within_rate_limit?
      return respond_modal("shared/flash_message", flash_message: { alert: "短時間に送信できる上限に達しました。時間をおいて再度お試しください。" })
    end

    ContactMailer.notify_admin(
      user: current_user,
      subject: subject,
      body: body,
      user_agent: request.user_agent,
      ip: request.remote_ip
    ).deliver_later

    respond_modal("shared/flash_message", flash_message: { notice: "お問い合わせを送信しました" })
  rescue => e
    Rails.logger.error("Contact send failed: #{e.class} #{e.message}")
    respond_modal("shared/flash_message", flash_message: { alert: "送信に失敗しました。時間をおいて再度お試しください。" })
  end

  private

  def within_rate_limit?
    cache_key = "contact:#{current_user.id}:#{Time.current.strftime('%Y%m%d%H')}"
    count = Rails.cache.read(cache_key).to_i
    return false if count >= HOURLY_LIMIT

    Rails.cache.write(cache_key, count + 1, expires_in: 1.hour)
    true
  end

  def user_login?
    return if user_signed_in?

    flash[:alert] = "この機能はゲストか会員しか使えません"
    redirect_to about_path
  end
end
