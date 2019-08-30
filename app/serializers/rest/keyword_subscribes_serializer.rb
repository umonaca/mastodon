 # frozen_string_literal: true

class REST::KeywordSubscribeSerializer < ActiveModel::Serializer
  attributes :id, :name, :keyword, :exclude_keyword, :ignorecase, :regexp, :ignore_block, :disabled, :exclude_home

  def id
    object.id.to_s
  end
end
