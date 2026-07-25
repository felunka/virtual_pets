class HomeController < ApplicationController
  def index
    @team_members = TeamMember.includes(:pets).alphabetical
  end
end
