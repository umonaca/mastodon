import { connect } from 'react-redux';
import ColumnSettings from '../../community_timeline/components/column_settings';
import { changeSetting } from '../../../actions/settings';
import { changeColumnParams } from '../../../actions/columns';

const mapStateToProps = (state, { columnId }) => {
  const uuid = columnId;
  const columns = state.getIn(['settings', 'columns']);
  const index = columns.findIndex(c => c.get('uuid') === uuid);

  if (uuid && index >= 0){
    console.log('public params');
    console.log(columns.get(index).get('params'));
  } else {
    console.log('public setting');
    console.log(state.getIn(['settings', 'public']));
    console.log('public-community');
    console.log(state.getIn(['settings', 'community']));
  }

  return {
    settings: (uuid && index >= 0) ? columns.get(index).get('params') : state.getIn(['settings', 'public']),
  };
};

const mapDispatchToProps = (dispatch, { columnId }) => {
  return {
    onChange (key, checked) {
      if (key && key.length === 2 && key[1] === 'showBots' && columnId) {
        console.log('Got here!');
        //dispatch(changeColumnParams(columnId, key, checked)); // Note: for advanced UI multiple columns of the same timeline will change at the same time
        dispatch(changeSetting(['public', ...key], checked)); // It's hacky but it works with minimal changes to the code
      } else if (columnId) {
        dispatch(changeColumnParams(columnId, key, checked));
      } else {
        dispatch(changeSetting(['public', ...key], checked));
      }
    },
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(ColumnSettings);
