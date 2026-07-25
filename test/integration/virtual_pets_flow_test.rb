require "test_helper"

class VirtualPetsFlowTest < ActionDispatch::IntegrationTest
  test "home shows selector when no member selected" do
    get root_path

    assert_response :success
    assert_select ".member-overlay"
  end

  test "select member persists in session and can create pet" do
    post select_team_members_path, params: { team_member_id: team_members(:alex).id }
    assert_redirected_to root_path

    follow_redirect!
    assert_select ".current-member-chip", /Alex/

    assert_difference -> { Pet.count }, 1 do
      post pets_path, params: {
        pet: {
          name: "Fresh Goal",
          mood: 7,
          description: "A new challenge",
          picture: "🎯"
        }
      }
    end

    assert_redirected_to root_path
  end
end
