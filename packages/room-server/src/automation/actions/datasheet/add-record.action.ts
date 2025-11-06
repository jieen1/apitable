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
import { DatasheetRecordSourceService } from 'database/datasheet/services/datasheet.record.source.service';
import { AutomationRobotRepository } from '../../repositories/automation.robot.repository';
import { IAuthHeader } from 'shared/interfaces';
import { SourceTypeEnum } from 'shared/enums/changeset.source.type.enum';
import { getRecordUrl } from 'shared/helpers/env';
import { ExecuteResult } from '@apitable/core';

export interface AddRecordActionInput {
  datasheetId: string;
  viewId?: string;
  fields: { [fieldId: string]: any };
  robotId?: string; // 系统字段，自动注入
}

export interface AddRecordOutput {
  datasheetId: string;
  datasheetName: string;
  recordId: string;
  recordUrl: string;
  fields: { [fieldId: string]: any };
}

@AutomationAction('新增记录', {
  description: '在指定数据表中创建新记录',
  themeLogo: { light: 'space/2023/03/29/6e70cb7968cc482793459041c5eb56ca' },
})
@Injectable()
export class AddRecordAction implements IBaseAction {
  constructor(
    private readonly databusService: DataBusService,
    private readonly nodeService: NodeService,
    private readonly datasheetRecordSourceService: DatasheetRecordSourceService,
    private readonly automationRobotRepository: AutomationRobotRepository,
  ) {}

  async endpoint(input: AddRecordActionInput): Promise<IActionResponse<ISuccessResponse<AddRecordOutput>>> {
    const { datasheetId, viewId, fields, robotId } = input;

    if (!datasheetId) {
      return {
        success: false,
        data: {
          errors: [{ message: 'datasheetId is required' }],
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

    // 获取Datasheet实例
    const datasheet = await this.databusService.getDatasheet(datasheetId, {
      loadOptions: {
        auth,
        recordIds: [],
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

    // 获取view
    let targetViewId = viewId;
    if (targetViewId) {
      const view = await datasheet.getView(targetViewId);
      if (!view) {
        return {
          success: false,
          data: {
            errors: [{ message: 'View not found' }],
          },
          code: ResponseStatusCodeEnums.NotFound,
        };
      }
    } else {
      // 使用第一个view
      const snapshot = datasheet.store.getState().snapshot;
      if (!snapshot || !snapshot.meta.views || snapshot.meta.views.length === 0) {
        return {
          success: false,
          data: {
            errors: [{ message: 'No view available' }],
          },
          code: ResponseStatusCodeEnums.NotFound,
        };
      }
      targetViewId = snapshot.meta.views[0]!.id;
    }

    // 转换字段数据格式
    const recordValues = [fields];

    // 执行新增记录
    const result = await datasheet.addRecords(
      {
        viewId: targetViewId,
        index: -1, // 添加到末尾
        recordValues,
        ignoreFieldPermission: true,
      },
      { auth },
    );

    if (result.result !== ExecuteResult.Success) {
      return {
        success: false,
        data: {
          errors: [{ message: 'Failed to add record' }],
        },
        code: ResponseStatusCodeEnums.ServerError,
      };
    }

    const recordIds = result.data as string[];
    if (!recordIds || recordIds.length === 0) {
      return {
        success: false,
        data: {
          errors: [{ message: 'No record created' }],
        },
        code: ResponseStatusCodeEnums.ServerError,
      };
    }

    const recordId = recordIds[0]!;

    // 记录来源追踪
    this.datasheetRecordSourceService.createRecordSource(userId, datasheetId, datasheetId, recordIds, SourceTypeEnum.OPEN_API);

    // 通过view获取记录数据
    const rows = [{ recordId }];
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
        const viewInfo = snapshot.meta.views.find((v: any) => v.id === targetViewId);
        if (!viewInfo) {
          return null;
        }
        return {
          property: {
            ...viewInfo,
            rows,
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
          errors: [{ message: 'Record not found after creation' }],
        },
        code: ResponseStatusCodeEnums.NotFound,
      };
    }

    const record = records[0]!;

    // 转换字段数据
    const state = datasheet.store.getState();
    const { eventFields } = transformOpFields({
      recordData: record.data,
      state,
      datasheetId,
      recordId: record.id,
    });

    // 获取数据表名称
    const datasheetName = await this.nodeService.getNameByNodeId(datasheetId);

    // 构建output
    const output: AddRecordOutput = {
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

  getInputSchema(): IJsonSchema {
    return {
      type: 'object',
      properties: {
        datasheetId: {
          type: 'string',
          title: '数据表ID',
          description: '要添加记录的数据表ID',
        },
        viewId: {
          type: 'string',
          title: '视图ID',
          description: '可选，指定要在哪个视图中添加记录',
        },
        fields: {
          type: 'object',
          title: '字段数据',
          description: '要添加的记录的字段数据',
          additionalProperties: true,
        },
      },
      required: ['datasheetId', 'fields'],
    };
  }

  getUISchema(): IUiSchema {
    return {
      'ui:order': ['datasheetId', 'viewId', 'fields'],
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
    // 对于内部自动化调用，使用internal和userId
    // DataBusService会根据internal标志处理权限
    return {
      userId,
      internal: true,
    };
  }
}

