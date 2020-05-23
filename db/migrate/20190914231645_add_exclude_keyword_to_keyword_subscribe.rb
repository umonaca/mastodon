class AddExcludeKeywordToKeywordSubscribe < ActiveRecord::Migration[5.2]
  def change
    safety_assured do
      add_column :keyword_subscribes, :exclude_keyword, :string, default: '', null: false
    end
  end
end
