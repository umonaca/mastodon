import React from 'react';
import ImmutablePureComponent from 'react-immutable-pure-component';
import ImmutablePropTypes from 'react-immutable-proptypes';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { makeGetAccount } from 'mastodon/selectors';
import Avatar from 'mastodon/components/avatar';
import DisplayName from 'mastodon/components/display_name';
import Permalink from 'mastodon/components/permalink';
import RelativeTimestamp from 'mastodon/components/relative_timestamp';
import IconButton from 'mastodon/components/icon_button';
import { FormattedMessage, injectIntl, defineMessages } from 'react-intl';
import { autoPlayGif, me, unfollowModal, unsubscribeModal, show_followed_by, follow_button_to_list_adder } from 'mastodon/initial_state';
import { shortNumberFormat } from 'mastodon/utils/numbers';
import {
  followAccount,
  unfollowAccount,
  subscribeAccount,
  unsubscribeAccount,
  blockAccount,
  unblockAccount,
  unmuteAccount,
} from 'mastodon/actions/accounts';
import { openModal } from 'mastodon/actions/modal';
import { initMuteModal } from 'mastodon/actions/mutes';

const messages = defineMessages({
  follow: { id: 'account.follow', defaultMessage: 'Follow' },
  unfollow: { id: 'account.unfollow', defaultMessage: 'Unfollow' },
  unsubscribe: { id: 'account.unsubscribe', defaultMessage: 'Unsubscribe' },
  subscribe: { id: 'account.subscribe', defaultMessage: 'Subscribe' },
  requested: { id: 'account.requested', defaultMessage: 'Awaiting approval' },
  unblock: { id: 'account.unblock', defaultMessage: 'Unblock @{name}' },
  unmute: { id: 'account.unmute', defaultMessage: 'Unmute @{name}' },
  unfollowConfirm: { id: 'confirmations.unfollow.confirm', defaultMessage: 'Unfollow' },
  unsubscribeConfirm: { id: 'confirmations.unsubscribe.confirm', defaultMessage: 'Unsubscribe' },
});

const makeMapStateToProps = () => {
  const getAccount = makeGetAccount();

  const mapStateToProps = (state, { id }) => ({
    account: getAccount(state, id),
  });

  return mapStateToProps;
};

const mapDispatchToProps = (dispatch, { intl }) => ({

  onFollow (account) {
    if (account.getIn(['relationship', 'following']) || account.getIn(['relationship', 'requested'])) {
      if (unfollowModal) {
        dispatch(openModal('CONFIRM', {
          message: <FormattedMessage id='confirmations.unfollow.message' defaultMessage='Are you sure you want to unfollow {name}?' values={{ name: <strong>@{account.get('acct')}</strong> }} />,
          confirm: intl.formatMessage(messages.unfollowConfirm),
          onConfirm: () => dispatch(unfollowAccount(account.get('id'))),
        }));
      } else {
        dispatch(unfollowAccount(account.get('id')));
      }
    } else {
      dispatch(followAccount(account.get('id')));
    }
  },

  onSubscribe (account) {
    if (account.getIn(['relationship', 'subscribing', '-1'], new Map).size > 0) {
      if (unsubscribeModal) {
        dispatch(openModal('CONFIRM', {
          message: <FormattedMessage id='confirmations.unsubscribe.message' defaultMessage='Are you sure you want to unsubscribe {name}?' values={{ name: <strong>@{account.get('acct')}</strong> }} />,
          confirm: intl.formatMessage(messages.unsubscribeConfirm),
          onConfirm: () => dispatch(unsubscribeAccount(account.get('id'))),
        }));
      } else {
        dispatch(unsubscribeAccount(account.get('id')));
      }
    } else {
      dispatch(subscribeAccount(account.get('id')));
    }
  },

  onAddToList (account){
    dispatch(openModal('LIST_ADDER', {
      accountId: account.get('id'),
    }));
  },

  onBlock (account) {
    if (account.getIn(['relationship', 'blocking'])) {
      dispatch(unblockAccount(account.get('id')));
    } else {
      dispatch(blockAccount(account.get('id')));
    }
  },

  onMute (account) {
    if (account.getIn(['relationship', 'muting'])) {
      dispatch(unmuteAccount(account.get('id')));
    } else {
      dispatch(initMuteModal(account));
    }
  },

});

export default @injectIntl
@connect(makeMapStateToProps, mapDispatchToProps)
class AccountCard extends ImmutablePureComponent {

  static propTypes = {
    account: ImmutablePropTypes.map.isRequired,
    intl: PropTypes.object.isRequired,
    onFollow: PropTypes.func.isRequired,
    onSubscribe: PropTypes.func.isRequired,
    onAddToList: PropTypes.func.isRequired,
    onBlock: PropTypes.func.isRequired,
    onMute: PropTypes.func.isRequired,
  };

  _updateEmojis () {
    const node = this.node;

    if (!node || autoPlayGif) {
      return;
    }

    const emojis = node.querySelectorAll('.custom-emoji');

    for (var i = 0; i < emojis.length; i++) {
      let emoji = emojis[i];
      if (emoji.classList.contains('status-emoji')) {
        continue;
      }
      emoji.classList.add('status-emoji');

      emoji.addEventListener('mouseenter', this.handleEmojiMouseEnter, false);
      emoji.addEventListener('mouseleave', this.handleEmojiMouseLeave, false);
    }
  }

  componentDidMount () {
    this._updateEmojis();
  }

  componentDidUpdate () {
    this._updateEmojis();
  }

  handleEmojiMouseEnter = ({ target }) => {
    target.src = target.getAttribute('data-original');
  }

  handleEmojiMouseLeave = ({ target }) => {
    target.src = target.getAttribute('data-static');
  }

  handleFollow = (e) => {
    if ((e && e.shiftKey) || !follow_button_to_list_adder) {
      this.props.onFollow(this.props.account);
    } else {
      this.props.onAddToList(this.props.account);
    }
  }

  handleSubscribe = (e) => {
    if ((e && e.shiftKey) || !follow_button_to_list_adder) {
      this.props.onSubscribe(this.props.account);
    } else {
      this.props.onAddToList(this.props.account);
    }
  }

  handleBlock = () => {
    this.props.onBlock(this.props.account);
  }

  handleMute = () => {
    this.props.onMute(this.props.account);
  }

  setRef = (c) => {
    this.node = c;
  }

  render () {
    const { account, intl } = this.props;

    let buttons;

    if (account.get('id') !== me && account.get('relationship', null) !== null) {
      const following        = account.getIn(['relationship', 'following']);
      const delivery         = account.getIn(['relationship', 'delivery_following']);
      const followed_by      = account.getIn(['relationship', 'followed_by']) && show_followed_by;
      const subscribing      = account.getIn(['relationship', 'subscribing'], new Map).size > 0;
      const subscribing_home = account.getIn(['relationship', 'subscribing', '-1'], new Map).size > 0;
      const requested        = account.getIn(['relationship', 'requested']);
      const blocking         = account.getIn(['relationship', 'blocking']);
      const muting           = account.getIn(['relationship', 'muting']);

      if (requested) {
        buttons = <IconButton disabled icon='hourglass' title={intl.formatMessage(messages.requested)} />;
      } else if (blocking) {
        buttons = <IconButton active icon='unlock' title={intl.formatMessage(messages.unblock, { name: account.get('username') })} onClick={this.handleBlock} />;
      } else if (muting) {
        buttons = <IconButton active icon='volume-up' title={intl.formatMessage(messages.unmute, { name: account.get('username') })} onClick={this.handleMute} />;
      } else {
        let following_buttons, subscribing_buttons;
        if(!account.get('moved') || subscribing) {
          subscribing_buttons = <IconButton icon='rss-square' title={intl.formatMessage(subscribing ? messages.unsubscribe : messages.subscribe)} onClick={this.handleSubscribe} active={subscribing} no_delivery={subscribing && !subscribing_home} />;
        }
        if(!account.get('moved') || following) {
          following_buttons = <IconButton icon={following ? 'user-times' : 'user-plus'} title={intl.formatMessage(following ? messages.unfollow : messages.follow)} onClick={this.handleFollow} active={following} passive={followed_by} no_delivery={following && !delivery} />;
        }
        buttons = <span>{subscribing_buttons}{following_buttons}</span>;
      }
    }

    return (
      <div className='directory__card'>
        <div className='directory__card__img'>
          <img src={autoPlayGif ? account.get('header') : account.get('header_static')} alt='' />
        </div>

        <div className='directory__card__bar'>
          <Permalink className='directory__card__bar__name' href={account.get('url')} to={`/accounts/${account.get('id')}`}>
            <Avatar account={account} size={48} />
            <DisplayName account={account} />
          </Permalink>

          <div className='directory__card__bar__relationship account__relationship'>
            {buttons}
          </div>
        </div>

        <div className='directory__card__extra' ref={this.setRef}>
          <div className='account__header__content' dangerouslySetInnerHTML={{ __html: account.get('note_emojified') }} />
        </div>

        <div className='directory__card__extra'>
          <div className='accounts-table__count'>{shortNumberFormat(account.get('statuses_count'))} <small><FormattedMessage id='account.posts' defaultMessage='Toots' /></small></div>
          <div className='accounts-table__count'>{shortNumberFormat(account.get('followers_count'))} <small><FormattedMessage id='account.followers' defaultMessage='Followers' /></small></div>
          <div className='accounts-table__count'>{account.get('last_status_at') === null ? <FormattedMessage id='account.never_active' defaultMessage='Never' /> : <RelativeTimestamp timestamp={account.get('last_status_at')} />} <small><FormattedMessage id='account.last_status' defaultMessage='Last active' /></small></div>
        </div>
      </div>
    );
  }

}
