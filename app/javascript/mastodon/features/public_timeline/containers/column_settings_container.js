import { connect } from 'react-redux';
import ColumnSettings from '../components/column_settings';
import { changeSetting } from '../../../actions/settings';
import { changeColumnParams } from '../../../actions/columns';

const mapStateToProps = (state, { columnId }) => {
  const uuid = columnId;
  const columns = state.getIn(['settings', 'columns']);
  const index = columns.findIndex(c => c.get('uuid') === uuid);

  return {
    settings: (uuid && index >= 0) ? columns.get(index).get('params') : state.getIn(['settings', 'public']),
  };
};

const mapDispatchToProps = (dispatch, { columnId }) => {
  return {
    onChange (key, checked) {
      if (key && key.length === 2 && key[1] === 'showBots' && columnId) {
        // Note: for advanced UI， let multiple columns of the same timelineId change at the same time
        // It's hacky but it works with minimal changes to the code
        //dispatch(changeColumnParams(columnId, key, checked));  // Moved to community/public timeline's index.js
        // Pinned column => shared setting => unpinned column & pinned column state => dispatch changeColumnParams for pinned columns
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
