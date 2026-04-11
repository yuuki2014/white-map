require "test_helper"

class EmailVerificationsControllerTest < ActionDispatch::IntegrationTest
  test "should get new" do
    get email_verifications_new_url
    assert_response :success
  end

  test "should get create" do
    get email_verifications_create_url
    assert_response :success
  end
end
