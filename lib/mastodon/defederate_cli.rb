# frozen_string_literal: true

require_relative '../../config/boot'
require_relative '../../config/environment'
require_relative 'cli_helper'

module Mastodon
  class DefederateCLI < Thor
    include CLIHelper

    def self.exit_on_failure?
        true
    end

    option :all_users, type: :boolean
    option :all_domains, type: :boolean
    option :domain, banner: "example.com"
    option :set_local_only, type: :boolean
    option :preserve_follows, type: :boolean
    option :dry_run, type: :boolean
    option :verbose, type: :boolean, aliases: [:v]
    option :debug, type: :boolean
    desc 'actor {<username>|--all_users} {--domain=example.com|--all-domains}
    [--set-local-only] [--preserve-follows] [--dry-run] [-v] [--debug]', 'Defederate user from Fediverse'
    long_desc <<-LONG_DESC
      Defederate the user(s) from the Fediverse. 
      Sends a Delete Actor ActivityPub activity to the remote server, so that the remote
      server may delete everything related to the account. It is not required by ActivityPub
      spec to delete; however, it should work for most Mastodon instances.

      Pleroma: Only some instances running newer versions would work. See pleroma issue #297. 

      Works for the following pleroma sites: blob.cat, shitposter.club. Does not work for the following pleroma sites: neckbeard.xyz, freespeechextremist.com

      The effect is not permanent: the "deleted" local account may be rediscovered later. However,
      with --set-local-only option, the status will be hidden to the Fediverse.
      If you want to isolate the server from the Fediverse, you may want to setup domain blocks or
      WHITE_LIST_MODE after the sidekiq jobs has completed.

      With --all-domains option, the command sends Delete Actor to all known inboxes (servers).

      With --preserve-follows, the command leaves following relationships broken between the user(s)  
      and the domain(s), if these relationships are detected. (Not recommended)

      With --set-local-only option, the command sets all statuses of the account to local-only.
      Requires the local-only patch to work.
    LONG_DESC
    def actor(username = nil)
      @dry_run_s = options[:dry_run] ? ' (DRY RUN)' : ''
      @extra_jobs = 0

      say('This operation WILL NOT be reversible, unless you are running with --dry-run. It can also take a long time.')
      say('While the data won\'t be erased locally, the account state will be inconsistent with remote servers.')
      say('A running Sidekiq process is required. Do not shut it down until queues clear.')
      say('The follow relationships will be broken between the local account and the remote server, because signature(s) removed on remote server(s).')
      say('They will be removed if detected, unless --preserve-follows is specified.')

      inboxes   = Account.inboxes

      if inboxes.empty?
        say('It seems like your server has not federated with anything')
        say('Nothing changed.')
        return
      end

      scope = account_scope(username)

      inboxes = inbox_urls

      message = "Sending Delete Actor activity of #{options[:all_users] ? 'all users' : username }
        to #{options[:all_domains] ? 'all known inboxes' : inboxes.to_s}"
      say(message, :yellow)

      if options[:verbose]
        say("Usernames of affected local accounts:", :yellow)
        say("#{scope.pluck(:username).to_s}\n\n")
        say("Urls of affected remote inboxes:", :yellow)
        say("#{inboxes.to_s}\n\n")
      end

      exit(1) unless yes?("Do you want to proceed?#{@dry_run_s} y/N", :yellow)

      unless options[:preserve_follows]
        scope.find_each do |account|
          if options[:all_domains]
            remove_follows!(account: account)
            remove_existing_followers!(account: account)
          else
            remove_follows!(account: account, domain: options[:domain])
            remove_existing_followers!(account: account, domain: options[:domain])
          end
        end
      end

      processed = 0

      scope.find_each do |account|
        payload = ActiveModelSerializers::SerializableResource.new(
          account,
          serializer: ActivityPub::DeleteActorSerializer,
          adapter: ActivityPub::Adapter
        ).as_json

        json = Oj.dump(ActivityPub::LinkedDataSignature.new(payload).sign!(account))

        unless options[:dry_run]
          ActivityPub::DeliveryWorker.push_bulk(inboxes) do |inbox_url|
            [json, account.id, inbox_url]
          end
        end

        processed += 1
      end

      say("Queued #{inboxes.size * processed + @extra_jobs} items into Sidekiq for #{processed} accounts#{@dry_run_s}", :green)
      say('Wait until Sidekiq processes all items. See the sidekiq dashboard for progress', :green)

      if options[:set_local_only]
        if  !Status.column_names.include? 'local_only'
          say('This mastodon instance does not have the local-only patch. --set-local-only option ignored', :yellow)
        else
          begin
            Status.where(account: scope).reorder(nil).in_batches.update_all(local_only: true) unless dry_run?
            say("All statuses of the account(s) you pick has been set to local-only.#{@dry_run_s}", :green)
          rescue => e
            say("Error processing local_only. #{e}")
          end
        end
      end
    end

    option :all_domains, type: :boolean
    option :domain, banner: "example.com"
    option :set_local_only, type: :boolean
    option :verbose, type: :boolean, aliases: [:v]
    option :dry_run, type: :boolean
    desc 'toot <status_id> {--domain=example.com|--all-domains} 
    [--set-local-only] [-v] [--dry-run]', 'Defederate status from Fediverse'
    long_desc <<-LONG_DESC
      Defederate a status from the Fediverse.
      Sends a Delete or Undo ActivityPub activity to the remote server(s), so that they delete 
      the status or unreblog (see RemoveStatusService).

      There is no guarantee that the remote server will delete the status, but it should work
      in most cases. There are some known compatibility issues between Pleroma and Mastodon.
      Sometimes they just don't delete the status no matter what you do.

      The effect is not permanent: the "deleted" status may be rediscovered later. However,
      with --set-local-only option, the status will be hidden to the Fediverse. Requires the 
      local-only patch to work.

      With --all-domains option, the command sends Delete activity to all known inboxes.
    LONG_DESC
    def toot(status_id)
      @dry_run_s = options[:dry_run] ? ' (DRY RUN)' : ''

      say('This operation WILL NOT be reversible, unless you are running with --dry-run.')
      say('While the data won\'t be erased locally, the state will be inconsistent with remote server(s).')
      say('A running Sidekiq process is required.')

      @inboxes   = Account.inboxes

      if @inboxes.empty?
        say('It seems like your server has not federated with anything')
        say('Nothing changed.')
        return
      end

      @inboxes = inbox_urls

      @status = Status.find_by(id: status_id)
      unless @status.present?
        say('Invalid status id', :red)
        exit(1)
      end
      @account = @status.account

      message = "Sending #{@status.reblog? ? "Undo (unreblog)" : "Delete Note (status)"} activity of status #{status_id}
        to #{options[:all_domains] ? 'all known inboxes' : @inboxes.to_s}"
      say(message, :yellow)
      say("Details of status:", :yellow)
      if @status.reblog?
        say("Reblog of:", :yellow)
        say("uri: #{@status&.target&.uri}")
        say("text: #{@status&.target&.text}")
      else
        say("uri: #{@status.uri}")
        say("text: #{@status.text}")
      end

      if options[:verbose]
        say("Urls of affected remote inboxes:", :yellow)
        say("#{@inboxes.to_s}\n\n")
      end

      exit(1) unless yes?("Do you want to proceed?#{@dry_run_s} y/N", :yellow)

      unless dry_run?
        remove_status!
      end

      if options[:set_local_only]
        if  !Status.column_names.include? 'local_only'
          say('This mastodon instance does not have the local-only patch. --set-local-only option ignored', :yellow)
        else
          begin
            @status.update(local_only: true) unless dry_run?
            say("The status has been set to local-only.#{@dry_run_s}", :green)
          rescue => e
            say("Error processing local_only. #{e}")
          end
        end
      end

      say("Queued items into Sidekiq#{@dry_run_s}", :green)
      say('Wait until Sidekiq processes all items. It could be almost instant', :green)
    end

    private

    def account_scope(username = nil)
      if options[:all_users]
        Account.local.without_suspended
      elsif username.present?
        Account.where(username: username, domain: nil)
      else
        say('No account is given', :red)
        exit(1)
      end
    end

    def inbox_urls
      if options[:all_domains]
        Account.inboxes
      elsif options[:domain]
        urls = Account.reorder(nil).where(protocol: :activitypub, domain: options[:domain]) \
          .pluck(Arel.sql("distinct coalesce(nullif(accounts.shared_inbox_url, ''), accounts.inbox_url)"))
        if urls.empty?
          urls = ["https://#{options[:domain]}/inbox"]
        else
          urls
        end
      else
        say('No domain is given', :red)
        exit(1)
      end
    end

    def remove_follows!(account:, domain: nil)
      return if !domain.present? && !options[:all_domains]

      scope = 
        if options[:all_domains]
            account.active_relationships.where(target_account: Account.remote).includes(:target_account).reorder(nil)
        else
            account.active_relationships.where(target_account: Account.where(domain: domain)).includes(:target_account).reorder(nil)
        end

      unless scope.exists?
        say("No active following relationship detected between #{account.username} and the given domain(s).") if options[:debug]
        return
      end

      remove_relationship!(scope: scope, type: :active)
    end

    def remove_existing_followers!(account:, domain: nil)
      return if !domain.present? && !options[:all_domains]

      scope = 
        if options[:all_domains]
          account.passive_relationships.where(account: Account.remote).includes(:account).reorder(nil)
        else
          account.passive_relationships.where(account: Account.where(domain: domain)).includes(:account).reorder(nil)
        end

      unless scope.exists?
        say("No passive following relationship detected between #{account.username} and the given domain(s).") if options[:debug]
        return
      end

      remove_relationship!(scope: scope, type: :passive)
    end

    def remove_relationship!(scope: ,type: )
      processed = 0
      jobs = 0

      scope.find_each do |follow|
        begin
          if type == :active
            say("Processing #{follow&.account&.username} with #{follow&.target_account&.acct} #{@dry_run_s}", :yellow)
          else
            say("Processing #{follow&.target_account&.username} with #{follow&.account&.acct} #{@dry_run_s}", :yellow)
          end

          unless dry_run?
            # Since Delete Actor is sent later there is no need to send a Reject activity
            follow.destroy
            if type == :active
              UnmergeWorker.perform_async(follow&.target_account_id, follow&.account.id)
              jobs += 1
            end
          end
        rescue => e
          say("Error processing follow id #{follow.id}: #{e}")
        ensure
          processed += 1
        end
      end

      say("Removed #{processed} #{type} following relationships#{@dry_run_s}", :yellow)
      if jobs > 0
        say("Queued #{jobs} additional sidekiq items.", :yellow)
        @extra_jobs += jobs
      end
    end

    def remove_status!
      ActivityPub::DeliveryWorker.push_bulk(@inboxes) do |inbox_url|
        [signed_activity_json, @account.id, inbox_url]
      end
  
      relay! if relayable?
    end

    def signed_activity_json
      @signed_activity_json ||= Oj.dump(serialize_payload(@status, @status.reblog? ? ActivityPub::UndoAnnounceSerializer : ActivityPub::DeleteSerializer, signer: @account))
    end

    def serialize_payload(record, serializer, options = {})
      signer    = options.delete(:signer)
      payload   = ActiveModelSerializers::SerializableResource.new(record, options.merge(serializer: serializer, adapter: ActivityPub::Adapter)).as_json
      ActivityPub::LinkedDataSignature.new(payload).sign!(signer)
    end

    def relayable?
      @status.public_visibility?
    end

    def relay!
      ActivityPub::DeliveryWorker.push_bulk(Relay.enabled.pluck(:inbox_url)) do |inbox_url|
        [signed_activity_json, @account.id, inbox_url]
      end
    end
  end
end
