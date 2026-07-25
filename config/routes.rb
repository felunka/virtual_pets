Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  root "home#index"

  resources :team_members, only: [ :create ] do
    collection do
      post :select
      delete :clear
    end
  end

  resources :pets, only: [ :create, :update, :destroy ]
end
