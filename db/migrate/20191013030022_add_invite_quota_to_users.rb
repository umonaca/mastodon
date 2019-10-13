class AddInviteQuotaToUsers < ActiveRecord::Migration[5.2]
  def change
    add_column :users, :invite_quota, :integer, default: 0, null: false
  end
end
