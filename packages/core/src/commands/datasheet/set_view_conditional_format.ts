import { ICollaCommandDef,  } from '../../command_manager';
import { ExecuteResult } from '../../command_manager/types';
import { DatasheetActions } from '../../commands_actions/datasheet';
import { ResourceType } from 'types';
import { getActiveDatasheetId, getDatasheet, getSnapshot } from '../../modules/database/store/selectors/resource/datasheet';
import { IConditionalFormatRule } from 'modules/database/store/interfaces/resource/datasheet';
import { IReduxState } from 'exports/store/interfaces';

export interface ISetViewConditionalFormatOptions {
  viewId: string;
  rules?: IConditionalFormatRule[];
}

export const setViewConditionalFormat: ICollaCommandDef<ISetViewConditionalFormatOptions> = {
  undoable: true,
  execute: (context, options) => {
    const state = context.state as IReduxState;
    const datasheetId = getActiveDatasheetId(state)!;
    const datasheet = getDatasheet(state, datasheetId);
    if (!state || !datasheet) {
      return null;
    }
    const snapshot = getSnapshot(state, datasheetId)!;
    const actions: any[] = [];
    const action = DatasheetActions.setConditionalFormatRules2Action(snapshot, { viewId: options.viewId, rules: options.rules });
    action && actions.push(action);
    if (!actions.length) {
      return null;
    }
    return {
      result: ExecuteResult.Success,
      resourceId: datasheetId,
      resourceType: ResourceType.Datasheet,
      actions,
    };
  },
};


