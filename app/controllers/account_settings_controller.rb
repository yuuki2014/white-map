class AccountSettingsController < ApplicationController
  before_action :authenticate_user!, only: %i[ show ]
  before_action :reject_guest_user, only: %i[ show ]

  def show
    @user = current_user
  end

  private

  def reject_guest_user
    redirect_to mypage_path, alert: "この機能は会員しか使えません" if current_user.guest?
  end
end
