# == Schema Information
#
# Table name: follow_tags
#
#  id         :bigint(8)        not null, primary key
#  account_id :bigint(8)
#  tag_id     :bigint(8)
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  list_id    :bigint(8)
#

class FollowTag < ApplicationRecord
  belongs_to :account, inverse_of: :follow_tags, required: true
  belongs_to :tag, inverse_of: :follow_tags, required: true
  belongs_to :list, optional: true

  delegate :name, to: :tag, allow_nil: true

  validates_associated :tag, on: :create
  validates :name, presence: true, on: :create
  validates :account_id, uniqueness: { scope: [:tag_id, :list_id] }

  def name=(str)
    self.tag = Tag.find_or_create_by_names(str.strip)&.first
  end
end
