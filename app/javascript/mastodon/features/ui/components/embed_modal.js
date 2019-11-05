import React from 'react';
import PropTypes from 'prop-types';
import ImmutablePureComponent from 'react-immutable-pure-component';
import { FormattedMessage, injectIntl } from 'react-intl';


export default @injectIntl
class EmbedModal extends ImmutablePureComponent {

  static propTypes = {
    url: PropTypes.string.isRequired,
    onClose: PropTypes.func.isRequired,
    intl: PropTypes.object.isRequired,
  }

  state = {
    loading: false,
    oembed: null,
  };

  componentDidMount () {


    this.setState({ loading: true });

  }

  setIframeRef = c =>  {
    this.iframe = c;
  }

  handleTextareaClick = (e) => {
    e.target.select();
  }

  render () {


    return (
      <div className='modal-root__modal report-modal embed-modal'>
        <div className='report-modal__target'>
          <IconButton className='media-modal__close' title={intl.formatMessage(messages.close)} icon='times' onClick={onClose} size={16} />
          <FormattedMessage id='status.embed' defaultMessage='Embed' />
        </div>

        <div className='report-modal__container embed-modal__container' style={{ display: 'block' }}>
          <p className='hint'>
            <span>Sorry, embedding is disallowed by the server admin.</span>
          </p>

        </div>
      </div>
    );
  }

}
