class AddExcludeReblogToDomainSubscribe < ActiveRecord::Migration[5.2]
  def change
    safety_assured do
      add_column :domain_subscribes, :exclude_reblog, :boolean, default: true
    end
  end
end
