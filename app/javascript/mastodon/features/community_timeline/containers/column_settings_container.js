import { connect } from 'react-redux';
import ColumnSettings from '../components/column_settings';
import { changeSetting } from '../../../actions/settings';
import { changeColumnParams } from '../../../actions/columns';

const mapStateToProps = (state, { columnId }) => {
  const uuid = columnId;
  const columns = state.getIn(['settings', 'columns']);
  const index = columns.findIndex(c => c.get('uuid') === uuid);

  if (uuid && index >= 0){
    console.log('community params');
    console.log(columns.get(index).get('params'));
  } else {
    console.log('community setting');
    console.log(state.getIn(['settings', 'community']));
  }
  return {
    settings: (uuid && index >= 0) ? columns.get(index).get('params') : state.getIn(['settings', 'community']),
  };
};

const mapDispatchToProps = (dispatch, { columnId }) => {
  return {
    onChange (key, checked) {
      if (key && key.length === 2 && key[1] === 'showBots' && columnId) {
        console.log('new key');
        console.log(key);
        //dispatch(changeColumnParams(columnId, key, checked)); // Note: for advanced UI multiple columns of the same timeline will change at the same time
        dispatch(changeSetting(['community', ...key], checked)); // It's hacky but it works with minimal changes to the code/
      } else if (columnId) {
        dispatch(changeColumnParams(columnId, key, checked));
      } else {
        dispatch(changeSetting(['community', ...key], checked));
      }
      console.log('column setting container');
      console.log(key);
      console.log(key, checked);
      console.log(key.constructor.name);
    },
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(ColumnSettings);
