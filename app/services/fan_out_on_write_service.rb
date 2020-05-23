# frozen_string_literal: true

class FanOutOnWriteService < BaseService
  # Push a status into home and mentions feeds
  # @param [Status] status
  def call(status)
    raise Mastodon::RaceConditionError if status.visibility.nil?

    render_anonymous_payload(status)

    if status.direct_visibility?
      deliver_to_own_conversation(status)
    elsif status.limited_visibility?
      deliver_to_mentioned_followers(status)
    else
      deliver_to_self(status) if status.account.local?
      deliver_to_followers(status)
      deliver_to_lists(status)
    end

    return if status.account.silenced? || !status.public_visibility?

    deliver_to_domain_subscribers(status)

    return if status.reblog?

    deliver_to_hashtags(status)
    deliver_to_hashtag_followers(status)
    deliver_to_subscribers(status)
    deliver_to_keyword_subscribers(status)

    return if status.reply? && status.in_reply_to_account_id != status.account_id

    deliver_to_public(status)
    deliver_to_media(status) if status.media_attachments.any?
  end

  private

  def deliver_to_self(status)
    Rails.logger.debug "Delivering status #{status.id} to author"
    FeedManager.instance.push_to_home(status.account, status)
  end

  def deliver_to_followers(status)
    Rails.logger.debug "Delivering status #{status.id} to followers"

    status.account.followers_for_local_distribution.select(:id).reorder(nil).find_in_batches do |followers|
      FeedInsertWorker.push_bulk(followers) do |follower|
        [status.id, follower.id, :home]
      end
    end
  end

  def deliver_to_subscribers(status)
    Rails.logger.debug "Delivering status #{status.id} to subscribers"

    status.account.subscribers_for_local_distribution.select(:id).reorder(nil).find_in_batches do |subscribings|
      FeedInsertWorker.push_bulk(subscribings) do |subscribing|
        [status.id, subscribing.id, :home]
      end
    end
  end

  def deliver_to_domain_subscribers(status)
    Rails.logger.debug "Delivering status #{status.id} to domain subscribers"

    deliver_to_domain_subscribers_home(status)
    deliver_to_domain_subscribers_list(status)
  end

  def deliver_to_domain_subscribers_home(status)
    DomainSubscribe.domain_to_home(status.account.domain).with_reblog(status.reblog?).select(:id, :account_id).find_in_batches do |subscribes|
      FeedInsertWorker.push_bulk(subscribes) do |subscribe|
        [status.id, subscribe.account_id, :home]
      end
    end
  end

  def deliver_to_domain_subscribers_list(status)
    DomainSubscribe.domain_to_list(status.account.domain).with_reblog(status.reblog?).select(:id, :list_id).find_in_batches do |subscribes|
      FeedInsertWorker.push_bulk(subscribes) do |subscribe|
        [status.id, subscribe.list_id, :list]
      end
    end
  end

  def deliver_to_keyword_subscribers(status)
    Rails.logger.debug "Delivering status #{status.id} to keyword subscribers"

    deliver_to_keyword_subscribers_home(status)
    deliver_to_keyword_subscribers_list(status)
  end

  def deliver_to_keyword_subscribers_home(status)
    match_accounts = []

    KeywordSubscribe.active.without_local_followed_home(status.account).order(:account_id).each do |keyword_subscribe|
      next if match_accounts[-1] == keyword_subscribe.account_id
      match_accounts << keyword_subscribe.account_id if keyword_subscribe.match?(status.index_text)
    end

    FeedInsertWorker.push_bulk(match_accounts) do |match_account|
      [status.id, match_account, :home]
    end
  end

  def deliver_to_keyword_subscribers_list(status)
    match_lists = []

    KeywordSubscribe.active.without_local_followed_list(status.account).order(:list_id).each do |keyword_subscribe|
      next if match_lists[-1] == keyword_subscribe.list_id
      match_lists << keyword_subscribe.list_id if keyword_subscribe.match?(status.index_text)
    end

    FeedInsertWorker.push_bulk(match_lists) do |match_list|
      [status.id, match_list, :list]
    end
  end

  def deliver_to_lists(status)
    Rails.logger.debug "Delivering status #{status.id} to lists"

    status.account.lists_for_local_distribution.select(:id).reorder(nil).find_in_batches do |lists|
      FeedInsertWorker.push_bulk(lists) do |list|
        [status.id, list.id, :list]
      end
    end
  end

  def deliver_to_mentioned_followers(status)
    Rails.logger.debug "Delivering status #{status.id} to limited followers"

    FeedInsertWorker.push_bulk(status.mentions.includes(:account).map(&:account).select { |mentioned_account| mentioned_account.local? && mentioned_account.following?(status.account) }) do |follower|
      [status.id, follower.id, :home]
    end
  end

  def render_anonymous_payload(status)
    @payload = InlineRenderer.render(status, nil, :status)
    @payload = Oj.dump(event: :update, payload: @payload)
  end

  def deliver_to_hashtags(status)
    Rails.logger.debug "Delivering status #{status.id} to hashtags"

    status.tags.pluck(:name).each do |hashtag|
      Redis.current.publish("timeline:hashtag:#{hashtag.mb_chars.downcase}", @payload)
      Redis.current.publish("timeline:hashtag:#{hashtag.mb_chars.downcase}:local", @payload) if status.local?
    end
  end

  def deliver_to_hashtag_followers(status)
    Rails.logger.debug "Delivering status #{status.id} to hashtag followers"

    FeedInsertWorker.push_bulk(FollowTag.where(tag: status.tags).pluck(:account_id).uniq) do |follower|
      [status.id, follower, :home]
    end
  end

  def deliver_to_public(status)
    Rails.logger.debug "Delivering status #{status.id} to public timeline"

    Redis.current.publish('timeline:public', @payload)
    if status.local?
      Redis.current.publish('timeline:public:local', @payload)
    else
      Redis.current.publish('timeline:public:remote', @payload)
      Redis.current.publish("timeline:public:domain:#{status.account.domain.mb_chars.downcase}", @payload)
    end
  end

  def deliver_to_media(status)
    Rails.logger.debug "Delivering status #{status.id} to media timeline"

    Redis.current.publish('timeline:public:media', @payload)
    if status.local?
      Redis.current.publish('timeline:public:local:media', @payload)
    else
      Redis.current.publish('timeline:public:remote:media', @payload)
      Redis.current.publish("timeline:public:domain:media:#{status.account.domain.mb_chars.downcase}", @payload)
    end
  end

  def deliver_to_own_conversation(status)
    AccountConversation.add_status(status.account, status)
  end
end
