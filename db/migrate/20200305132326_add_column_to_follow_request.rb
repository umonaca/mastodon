class AddColumnToFollowRequest < ActiveRecord::Migration[5.2]
  def change
    safety_assured do
      add_column :follow_requests, :delivery, :boolean, null: false, default: true
    end
  end
end
