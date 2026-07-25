class ApplicationController < ActionController::Base
  # Only allow modern browsers supporting webp images, web push, badges, import maps, CSS nesting, and CSS :has.
  allow_browser versions: :modern

  # Changes to the importmap will invalidate the etag for HTML responses
  stale_when_importmap_changes

  before_action :load_current_team_member

  helper_method :current_team_member, :team_member_selected?

  private

  def load_current_team_member
    @current_team_member = TeamMember.find_by(id: session[:team_member_id])
  end

  def current_team_member
    @current_team_member
  end

  def team_member_selected?
    current_team_member.present?
  end

  def set_current_team_member!(team_member)
    reset_session
    session[:team_member_id] = team_member.id
  end

  def require_current_team_member!
    return if current_team_member

    redirect_to root_path, alert: "Please select or create your team member first."
  end
end
