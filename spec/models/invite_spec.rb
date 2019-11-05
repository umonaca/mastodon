require 'rails_helper'

RSpec.describe Invite, type: :model do
  describe '#valid_for_use?' do

    let(:alice)   { Fabricate(:user, invite_quota: 65534).account }

    xit 'returns true when there are no limitations' do
      invite = Fabricate(:invite, max_uses: nil, expires_at: nil)
      expect(invite.valid_for_use?).to be true
    end

    it 'returns true when not expired' do
      invite = Fabricate(:invite, max_uses: 100, expires_at: 1.hour.from_now, user: alice.user)
      expect(invite.valid_for_use?).to be true
    end

    it 'returns false when expired' do
      invite = Fabricate(:invite, max_uses: 100, expires_at: 1.hour.ago, user: alice.user)
      expect(invite.valid_for_use?).to be false
    end

    it 'returns true when uses still available' do
      invite = Fabricate(:invite, max_uses: 250, uses: 249, expires_at: nil, user: alice.user)
      expect(invite.valid_for_use?).to be true
    end

    it 'returns false when maximum uses reached' do
      invite = Fabricate(:invite, max_uses: 250, uses: 250, expires_at: nil, user: alice.user)
      expect(invite.valid_for_use?).to be false
    end

    it 'returns false when invite creator has been disabled' do
      invite = Fabricate(:invite, max_uses: 100, expires_at: nil, user: alice.user)
      SuspendAccountService.new.call(invite.user.account)
      expect(invite.valid_for_use?).to be false
    end
  end
end
