import React from 'react';
import { connect } from 'react-redux';
import ImmutablePureComponent from 'react-immutable-pure-component';
import ImmutablePropTypes from 'react-immutable-proptypes';
import PropTypes from 'prop-types';
import IconButton from 'mastodon/components/icon_button';
import classNames from 'classnames';
import { me, boostModal, show_quote_button } from 'mastodon/initial_state';
import { defineMessages, injectIntl } from 'react-intl';
import { replyCompose, quoteCompose } from 'mastodon/actions/compose';
import { reblog, favourite, bookmark, unreblog, unfavourite, unbookmark } from 'mastodon/actions/interactions';
import { makeGetStatus } from 'mastodon/selectors';
import { openModal } from 'mastodon/actions/modal';

const messages = defineMessages({
  reply: { id: 'status.reply', defaultMessage: 'Reply' },
  replyAll: { id: 'status.replyAll', defaultMessage: 'Reply to thread' },
  reblog: { id: 'status.reblog', defaultMessage: 'Boost' },
  reblog_private: { id: 'status.reblog_private', defaultMessage: 'Boost with original visibility' },
  cancel_reblog_private: { id: 'status.cancel_reblog_private', defaultMessage: 'Unboost' },
  cannot_reblog: { id: 'status.cannot_reblog', defaultMessage: 'This post cannot be boosted' },
  cannot_quote: { id: 'status.cannot_quote', defaultMessage: 'This post cannot be quoted' },
  quote: { id: 'status.quote', defaultMessage: 'Quote' },
  favourite: { id: 'status.favourite', defaultMessage: 'Favourite' },
  bookmark: { id: 'status.bookmark', defaultMessage: 'Bookmark' },
  replyConfirm: { id: 'confirmations.reply.confirm', defaultMessage: 'Reply' },
  replyMessage: { id: 'confirmations.reply.message', defaultMessage: 'Replying now will overwrite the message you are currently composing. Are you sure you want to proceed?' },
});

const makeMapStateToProps = () => {
  const getStatus = makeGetStatus();

  const mapStateToProps = (state, { statusId }) => ({
    status: getStatus(state, { id: statusId }),
    askReplyConfirmation: state.getIn(['compose', 'text']).trim().length !== 0,
  });

  return mapStateToProps;
};

export default @connect(makeMapStateToProps)
@injectIntl
class Footer extends ImmutablePureComponent {

  static contextTypes = {
    router: PropTypes.object,
  };

  static propTypes = {
    statusId: PropTypes.string.isRequired,
    status: ImmutablePropTypes.map.isRequired,
    intl: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    askReplyConfirmation: PropTypes.bool,
  };

  _performReply = () => {
    const { dispatch, status } = this.props;
    dispatch(replyCompose(status, this.context.router.history));
  };

  handleReplyClick = () => {
    const { dispatch, askReplyConfirmation, intl } = this.props;

    if (askReplyConfirmation) {
      dispatch(openModal('CONFIRM', {
        message: intl.formatMessage(messages.replyMessage),
        confirm: intl.formatMessage(messages.replyConfirm),
        onConfirm: this._performReply,
      }));
    } else {
      this._performReply();
    }
  };

  handleFavouriteClick = () => {
    const { dispatch, status } = this.props;

    if (status.get('favourited')) {
      dispatch(unfavourite(status));
    } else {
      dispatch(favourite(status));
    }
  };

  _performReblog = () => {
    const { dispatch, status } = this.props;
    dispatch(reblog(status));
  }

  handleReblogClick = e => {
    const { dispatch, status } = this.props;

    if (status.get('reblogged')) {
      dispatch(unreblog(status));
    } else if ((e && e.shiftKey) || !boostModal) {
      this._performReblog();
    } else {
      dispatch(openModal('BOOST', { status, onReblog: this._performReblog }));
    }
  };

  handleBookmarkClick = () => {
    const { dispatch, status } = this.props;

    if (status.get('bookmarked')) {
      dispatch(unbookmark(status));
    } else {
      dispatch(bookmark(status));
    }
  }

  _performQuote = () => {
    const { dispatch, status } = this.props;
    dispatch(quoteCompose(status, this.context.router.history));
  };

  handleQuoteClick = (status) => {
    const { dispatch, askReplyConfirmation, intl } = this.props;

    if (askReplyConfirmation) {
      dispatch(openModal('CONFIRM', {
        message: intl.formatMessage(messages.quoteMessage),
        confirm: intl.formatMessage(messages.quoteConfirm),
        onConfirm: this._performQuote,
      }));
    } else {
      this._performQuote();
    }
  }

  render () {
    const { status, intl } = this.props;

    const publicStatus  = ['public', 'unlisted'].includes(status.get('visibility'));
    const reblogPrivate = status.getIn(['account', 'id']) === me && status.get('visibility') === 'private';

    const expires_at = status.get('expires_at')
    const expires_date = expires_at && new Date(expires_at)
    const expired = expires_date && expires_date.getTime() < intl.now()

    let replyIcon, replyTitle;

    if (status.get('in_reply_to_id', null) === null) {
      replyIcon = 'reply';
      replyTitle = intl.formatMessage(messages.reply);
    } else {
      replyIcon = 'reply-all';
      replyTitle = intl.formatMessage(messages.replyAll);
    }

    let reblogTitle = '';

    if (status.get('reblogged')) {
      reblogTitle = intl.formatMessage(messages.cancel_reblog_private);
    } else if (publicStatus) {
      reblogTitle = intl.formatMessage(messages.reblog);
    } else if (reblogPrivate) {
      reblogTitle = intl.formatMessage(messages.reblog_private);
    } else {
      reblogTitle = intl.formatMessage(messages.cannot_reblog);
    }

    return (
      <div className='picture-in-picture__footer'>
        <IconButton className='status__action-bar-button' title={replyTitle} icon={status.get('in_reply_to_account_id') === status.getIn(['account', 'id']) ? 'reply' : replyIcon} onClick={this.handleReplyClick} counter={status.get('replies_count')} obfuscateCount />
        <IconButton className={classNames('status__action-bar-button', { reblogPrivate })} disabled={!publicStatus && !reblogPrivate}  active={status.get('reblogged')} pressed={status.get('reblogged')} title={reblogTitle} icon='retweet' onClick={this.handleReblogClick} counter={status.get('reblogs_count')} />
        <IconButton className='status__action-bar-button star-icon' animate active={status.get('favourited')} pressed={status.get('favourited')} title={intl.formatMessage(messages.favourite)} icon='star' onClick={this.handleFavouriteClick} counter={status.get('favourites_count')} />
        {show_quote_button && <IconButton className='status__action-bar-button' disabled={!publicStatus || expired} title={!publicStatus ? intl.formatMessage(messages.cannot_quote) : intl.formatMessage(messages.quote)} icon='quote-right' onClick={this.handleQuoteClick} />}
        <IconButton className='status__action-bar-button bookmark-icon' active={status.get('bookmarked')} title={intl.formatMessage(messages.bookmark)} icon='bookmark' onClick={this.handleBookmarkClick} />
      </div>
    );
  }

}
