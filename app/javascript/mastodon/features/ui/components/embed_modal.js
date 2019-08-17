import React from 'react';
import PropTypes from 'prop-types';
import ImmutablePureComponent from 'react-immutable-pure-component';
import { FormattedMessage, injectIntl } from 'react-intl';
import api from '../../../api';

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
    const { url } = this.props;

    this.setState({ loading: true });

  }

  setIframeRef = c =>  {
    this.iframe = c;
  }

  handleTextareaClick = (e) => {
    e.target.select();
  }

  render () {
    const { oembed } = this.state;

    return (
      <div className='modal-root__modal embed-modal'>
        <h4><FormattedMessage id='status.embed' defaultMessage='Embed' /></h4>

        <div className='embed-modal__container'>
          <p className='hint'>
            <span>Sorry, embedding is disallowed by the server admin.</span>
          </p>

        </div>
      </div>
    );
  }

}
