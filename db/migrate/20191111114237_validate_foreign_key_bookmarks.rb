class ValidateForeignKeyBookmarks < ActiveRecord::Migration[5.2]
  def change
    validate_foreign_key :bookmarks, :accounts
    validate_foreign_key :bookmarks, :statuses
  end
end
