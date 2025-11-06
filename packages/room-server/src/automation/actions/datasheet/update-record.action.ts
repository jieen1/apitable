/**
 * APITable <https://github.com/apitable/apitable>
 * Copyright (C) 2022 APITable Ltd. <https://apitable.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import { Injectable } from '@nestjs/common';
import { IJsonSchema } from '@apitable/core';
import { transformOpFields } from '@apitable/core';
import { AutomationAction } from '../decorators/automation.action.decorator';
import { IBaseAction, IUiSchema } from '../interface/base.action';
import { IActionResponse, ISuccessResponse } from '../interface/action.response';
import { ResponseStatusCodeEnums } from '../enum/response.status.code.enums';
import { DataBusService } from 'fusion/services/databus/databus.service';
import { NodeService } from 'node/services/node.service';
import { FusionApiRecordService } from 'fusion/services/fusion.api.record.service';
import { AutomationRobotRepository } from '../../repositories/automation.robot.repository';
import { IAuthHeader } from 'shared/interfaces';
import { getRecordUrl } from 'shared/helpers/env';
import { ExecuteResult } from '@apitable/core';

export interface UpdateRecordActionInput {
  datasheetId: string;
  recordId: string;
  viewId?: string;
  fields: { [fieldId: string]: any };
  robotId?: string; // 系统字段，自动注入
}

export interface UpdateRecordOutput {
  datasheetId: string;
  datasheetName: string;
  recordId: string;
  recordUrl: string;
  fields: { [fieldId: string]: any };
}

@AutomationAction('修改记录', {
  description: '更新数据表中的记录',
  themeLogo: { light: 'space/2023/03/29/6e70cb7968cc482793459041c5eb56ca' },
})
@Injectable()
export class UpdateRecordAction implements IBaseAction {
  constructor(
    private readonly databusService: DataBusService,
    private readonly nodeService: NodeService,
    private readonly fusionApiRecordService: FusionApiRecordService,
    private readonly automationRobotRepository: AutomationRobotRepository,
  ) {}

  async endpoint(input: UpdateRecordActionInput): Promise<IActionResponse<ISuccessResponse<UpdateRecordOutput>>> {
    const { datasheetId, recordId, viewId, fields, robotId } = input;

    if (!datasheetId || !recordId) {
      return {
        success: false,
        data: {
          errors: [{ message: 'datasheetId and recordId are required' }],
        },
        code: ResponseStatusCodeEnums.ClientError,
      };
    }

    // 获取userId和构建auth对象
    const userId = await this.getUserIdFromRobot(robotId);
    if (!userId) {
      return {
        success: false,
        data: {
          errors: [{ message: 'Failed to get userId from robot' }],
        },
        code: ResponseStatusCodeEnums.ServerError,
      };
    }

    const auth: IAuthHeader = await this.buildAuthHeader(userId);

    // 验证记录是否存在
    try {
      await this.fusionApiRecordService.validateRecordExists(datasheetId, [recordId], 'Record not exists');
    } catch (error: any) {
      return {
        success: false,
        data: {
          errors: [{ message: error.message || 'Record not exists' }],
        },
        code: ResponseStatusCodeEnums.NotFound,
      };
    }

    // 获取Datasheet实例
    const datasheet = await this.databusService.getDatasheet(datasheetId, {
      loadOptions: {
        auth,
        recordIds: [recordId],
        includeCommentCount: false,
      },
    });

    if (!datasheet) {
      return {
        success: false,
        data: {
          errors: [{ message: 'Datasheet not found' }],
        },
        code: ResponseStatusCodeEnums.NotFound,
      };
    }

    // 检查view是否存在
    if (viewId) {
      const view = await datasheet.getView(viewId);
      if (!view) {
        return {
          success: false,
          data: {
            errors: [{ message: 'View not found' }],
          },
          code: ResponseStatusCodeEnums.NotFound,
        };
      }
    }

    // 执行更新记录
    const updateCellOptions = [{
      recordId,
      fields,
    }];

    const result = await datasheet.updateRecords(updateCellOptions, { auth });

    if (result.result === ExecuteResult.None) {
      // 没有变化，但记录仍然存在，返回当前记录数据
      const snapshot = datasheet.store.getState().snapshot;
      if (!snapshot) {
        return {
          success: false,
          data: {
            errors: [{ message: 'Snapshot not available' }],
          },
          code: ResponseStatusCodeEnums.ServerError,
        };
      }

      const view = await datasheet.getView({
        getViewInfo: (_state: any) => {
          const viewInfo = viewId 
            ? snapshot.meta.views.find((v: any) => v.id === viewId)
            : snapshot.meta.views[0];
          if (!viewInfo) {
            return null;
          }
          return {
            property: {
              ...viewInfo,
              rows: [{ recordId }],
            },
            fieldMap: snapshot.meta.fieldMap,
          };
        },
      });

      if (!view) {
        return {
          success: false,
          data: {
            errors: [{ message: 'View not found' }],
          },
          code: ResponseStatusCodeEnums.NotFound,
        };
      }

      const records = await view.getRecords();
      if (!records || records.length === 0) {
        return {
          success: false,
          data: {
            errors: [{ message: 'Record not found' }],
          },
          code: ResponseStatusCodeEnums.NotFound,
        };
      }

      const record = records[0]!;
      const state = datasheet.store.getState();
      const { eventFields } = transformOpFields({
        recordData: record.data,
        state,
        datasheetId,
        recordId: record.id,
      });

      const datasheetName = await this.nodeService.getNameByNodeId(datasheetId);

      const output: UpdateRecordOutput = {
        datasheetId,
        datasheetName: datasheetName || '',
        recordId: record.id,
        recordUrl: getRecordUrl(datasheetId, record.id),
        fields: eventFields,
      };

      return {
        success: true,
        data: {
          data: output as any,
        },
        code: ResponseStatusCodeEnums.Success,
      };
    }

    if (result.result !== ExecuteResult.Success) {
      return {
        success: false,
        data: {
          errors: [{ message: 'Failed to update record' }],
        },
        code: ResponseStatusCodeEnums.ServerError,
      };
    }

    // 重新加载记录以获取更新后的完整数据
    const recordMap = await this.fusionApiRecordService.getBasicRecordsByRecordIds(datasheetId, [recordId]);
    await datasheet.resetRecords(recordMap, { auth, applyChangesets: false });

    // 获取更新后的记录数据
    const snapshot = datasheet.store.getState().snapshot;
    if (!snapshot) {
      return {
        success: false,
        data: {
          errors: [{ message: 'Snapshot not available' }],
        },
        code: ResponseStatusCodeEnums.ServerError,
      };
    }

    const view = await datasheet.getView({
      getViewInfo: (_state: any) => {
        const viewInfo = viewId 
          ? snapshot.meta.views.find((v: any) => v.id === viewId)
          : snapshot.meta.views[0];
        if (!viewInfo) {
          return null;
        }
        return {
          property: {
            ...viewInfo,
            rows: [{ recordId }],
          },
          fieldMap: snapshot.meta.fieldMap,
        };
      },
    });

    if (!view) {
      return {
        success: false,
        data: {
          errors: [{ message: 'View not found' }],
        },
        code: ResponseStatusCodeEnums.NotFound,
      };
    }

    const records = await view.getRecords();
    if (!records || records.length === 0) {
      return {
        success: false,
        data: {
          errors: [{ message: 'Record not found after update' }],
        },
        code: ResponseStatusCodeEnums.NotFound,
      };
    }

    const record = records[0]!;
    const state = datasheet.store.getState();
    const { eventFields } = transformOpFields({
      recordData: record.data,
      state,
      datasheetId,
      recordId: record.id,
    });

    const datasheetName = await this.nodeService.getNameByNodeId(datasheetId);

    const output: UpdateRecordOutput = {
      datasheetId,
      datasheetName: datasheetName || '',
      recordId: record.id,
      recordUrl: getRecordUrl(datasheetId, record.id),
      fields: eventFields,
    };

    return {
      success: true,
      data: {
        data: output,
      },
      code: ResponseStatusCodeEnums.Success,
    };
  }

  getInputSchema(): IJsonSchema {
    return {
      type: 'object',
      properties: {
        datasheetId: {
          type: 'string',
          title: '数据表ID',
          description: '要更新记录的数据表ID',
        },
        recordId: {
          type: 'string',
          title: '记录ID',
          description: '要更新的记录ID',
        },
        viewId: {
          type: 'string',
          title: '视图ID',
          description: '可选，指定视图',
        },
        fields: {
          type: 'object',
          title: '字段数据',
          description: '要更新的字段数据',
          additionalProperties: true,
        },
      },
      required: ['datasheetId', 'recordId', 'fields'],
    };
  }

  getUISchema(): IUiSchema {
    return {
      'ui:order': ['datasheetId', 'recordId', 'viewId', 'fields'],
    };
  }

  getOutputSchema(): IJsonSchema {
    return {
      type: 'object',
      properties: {
        datasheetId: {
          type: 'string',
          title: 'Datasheet ID',
        },
        datasheetName: {
          type: 'string',
          title: 'Datasheet Name',
        },
        recordId: {
          type: 'string',
          title: 'Record ID',
        },
        recordUrl: {
          type: 'string',
          title: 'Record URL',
        },
        fields: {
          type: 'object',
          title: 'Fields',
          description: '记录的字段数据',
          properties: {},
          additionalProperties: true,
        },
      },
      required: ['datasheetId', 'datasheetName', 'recordId', 'recordUrl', 'fields'],
    };
  }

  private async getUserIdFromRobot(robotId?: string): Promise<string | null> {
    if (!robotId) {
      return null;
    }

    try {
      const robot = await this.automationRobotRepository.selectRobotSimpleInfoByRobotId(robotId);
      if (!robot) {
        return null;
      }
      return robot.createdBy;
    } catch (error) {
      return null;
    }
  }

  private async buildAuthHeader(userId: string): Promise<IAuthHeader> {
    return {
      userId,
      internal: true,
    };
  }
}

