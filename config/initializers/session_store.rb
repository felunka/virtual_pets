Rails.application.config.session_store :cookie_store,
  key: "_virtual_pets_session",
  expire_after: 20.years,
  secure: Rails.env.production?,
  httponly: true,
  same_site: :lax
