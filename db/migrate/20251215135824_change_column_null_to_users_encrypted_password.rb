class ChangeColumnNullToUsersEncryptedPassword < ActiveRecord::Migration[7.2]
  def change
    change_column_null :users, :encrypted_password, false, ""
  end
end
