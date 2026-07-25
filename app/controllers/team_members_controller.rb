class TeamMembersController < ApplicationController
	def create
		member = TeamMember.new(team_member_params)

		if member.save
			set_current_team_member!(member)
			redirect_to root_path, notice: "Welcome, #{member.name}!"
		else
			redirect_to root_path, alert: member.errors.full_messages.to_sentence
		end
	end

	def select
		member = TeamMember.find_by(id: params[:team_member_id])

		if member
			set_current_team_member!(member)
			redirect_to root_path, notice: "You are now #{member.name}."
		else
			redirect_to root_path, alert: "Please choose a valid team member."
		end
	end

	def clear
		reset_session
		redirect_to root_path, notice: "Team member selection cleared."
	end

	private

	def team_member_params
		params.expect(team_member: [ :name ])
	end
end
