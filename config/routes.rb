Rails.application.routes.draw do
  get "stimulus/error"
  namespace :guest do
    post "sessions/create"
  end

  # devise_for :users
  devise_for :users, controllers: {
    registrations: "users/registrations",
    sessions: "users/sessions",
    passwords: "users/passwords"
  }
  resources :users, only: %i[ show ] do
    collection do
    end
  end

  resource :email_verification, only: %i[ new create ]

  resource :account_setting, only: %i[ show ]

  resource :email_change_verification, only: %i[ new create ]
  resource :email_change, only: %i[ edit ]

  resource :profile, controller: "users", only: %i[ edit update ]
  # get "users/:public_uid", to: "users#show", as: "user"
  get "mypage", to: "users#mypage", as: "mypage"
  resource :tutorial, only: [ :show, :update ]

  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  # Render dynamic PWA files from app/views/pwa/*
  get "service-worker" => "rails/pwa#service_worker", as: :pwa_service_worker
  get "manifest" => "rails/pwa#manifest", as: :pwa_manifest

  # Defines the root path route ("/")
  # root "posts#index"
  resources :trips, only: %i[ index show destroy ] do
    member do
      resource :bottom_sheets, only: %i[ show ]
      get "confirm_destroy", to: "trips#confirm_destroy"
      get "post_bottom_sheet", to: "bottom_sheets#show_post_bottom_sheet"
      patch :update_status
      get :edit_status
      get :edit_title
      patch :update_title
    end
    get "select_position", to: "posts#select_position"
    resources :posts, only: %i[ new create ]
  end

  resources :posts, only: %i[ index show destroy ] do
    member do
      get :preview
      get :image_viewer
      get :confirm_destroy
    end
  end

  get "select_position", to: "posts#select_position"

  post "decisions", to: "decisions#create", as: :decisions
  get "location_denied", to: "tutorials#location_denied", as: :location_denied
  root "trips#new"

  get "about", to: "pages#about"
  get "privacy_policy", to: "pages#privacy_policy"
  get "terms", to: "pages#terms"
  get "licenses", to: "pages#licenses"

  resource :contact, only: %i[ show create ]

  resource :my_map, only: :show

  namespace :api do
    namespace :v1 do
      resource :my_map, only: :show
      resources :trips, only: %i[ create update ] do
        member do
          get :end_check
          get :resume
          patch :finish_and_create
        end

        resources :footprints, only: [ :create ] do
          collection do
            post :bulk_create
          end
        end
      end
    end
  end

  # good_jobのダッシュボード
  authenticate :user, ->(user) { user.admin? } do
    mount GoodJob::Engine => "good_job"
  end

  # レターオープナー
  if Rails.env.development?
    mount LetterOpenerWeb::Engine, at: "/letter_opener"
  end
end
