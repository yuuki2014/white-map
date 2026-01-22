Rails.application.routes.draw do
  get "stimulus/error"
  namespace :guest do
    post "sessions/create"
  end

  # devise_for :users
  devise_for :users, controllers: {
    registrations: "users/registrations",
    sessions: "users/sessions"
  }
  # resources :users, param: :public_uid, only: [ :show ]
  get "users/:public_uid", to: "users#show", as: "user"
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
      get "confirm_destroy", to: "trips#confirm_destroy"
      patch :status
      get :edit_status
      get :edit_title
      patch :update_title
    end
    resource :bottom_sheets, only: %i[ show ]
  end

  post "decisions", to: "decisions#create", as: :decisions
  get "location_denied", to: "tutorials#location_denied", as: :location_denied
  root "trips#new"

  get "privacy_policy", to: "pages#privacy_policy"
  get "terms", to: "pages#terms"

  namespace :api do
    namespace :v1 do
      resources :trips, only: %i[ create update ] do
        member do
          get :end_check
        end

        resources :footprints, only: [ :create ] do
          collection do
            post :bulk_create
          end
        end
      end
    end
  end
end
