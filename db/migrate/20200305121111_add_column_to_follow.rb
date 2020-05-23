class AddColumnToFollow < ActiveRecord::Migration[5.2]
  def change
    safety_assured do
      add_column :follows, :delivery, :boolean, null: false, default: true
    end
  end
end
