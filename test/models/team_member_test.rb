require "test_helper"

class TeamMemberTest < ActiveSupport::TestCase
  test "is valid with a unique name" do
    member = TeamMember.new(name: "Robin")

    assert member.valid?
  end

  test "requires unique name ignoring case" do
    member = TeamMember.new(name: "alex")

    assert_not member.valid?
    assert_includes member.errors[:name], "has already been taken"
  end
end
