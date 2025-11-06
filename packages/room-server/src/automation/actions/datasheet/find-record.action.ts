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
import { FusionApiTransformer } from 'fusion/transformer/fusion.api.transformer';
import { FusionApiFilter } from 'fusion/filter/fusion.api.filter';
import { AutomationRobotRepository } from '../../repositories/automation.robot.repository';
import { IAuthHeader } from 'shared/interfaces';
import { getRecordUrl } from 'shared/helpers/env';
import { CommandService } from 'database/command/services/command.service';
import { UserService } from 'user/services/user.service';

export interface FindRecordActionInput {
  datasheetId: string;
  viewId?: string;
  recordIds?: string[];
  filterByFormula?: string;
  sort?: Array<{ field: string; order: 'asc' | 'desc' }>;
  maxRecords?: number;
  robotId?: string; // 系统字段，自动注入
}

export interface FindRecordOutputItem {
  datasheetId: string;
  datasheetName: string;
  recordId: string;
  recordUrl: string;
  fields: { [fieldId: string]: any };
}

export interface FindRecordOutput {
  records: FindRecordOutputItem[];
  count: number;
}

@AutomationAction('查找记录', {
  description: '根据条件查询数据表中的记录',
  themeLogo: { light: 'space/2023/03/29/6e70cb7968cc482793459041c5eb56ca' },
})
@Injectable()
export class FindRecordAction implements IBaseAction {
  constructor(
    private readonly databusService: DataBusService,
    private readonly nodeService: NodeService,
    private readonly fusionApiRecordService: FusionApiRecordService,
    private readonly transform: FusionApiTransformer,
    private readonly filter: FusionApiFilter,
    private readonly automationRobotRepository: AutomationRobotRepository,
    private readonly userService: UserService,
    private readonly commandService: CommandService,
  ) {}

  async endpoint(input: FindRecordActionInput): Promise<IActionResponse<ISuccessResponse<FindRecordOutput>>> {
    const { datasheetId, viewId, recordIds, filterByFormula, sort, maxRecords, robotId } = input;

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
        recordIds: recordIds || [],
        includeCommentCount: false,
      },
      createStore: async (dst) => {
        // 需要fullFillStore来支持公式字段的过滤
        const userInfo = await this.userService.getUserInfoBySpaceId(auth, dst.datasheet.spaceId);
        return this.commandService.fullFillStore(dst, userInfo);
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

    const targetViewId = viewId || snapshot.meta.views[0]?.id;
    if (!targetViewId) {
      return {
        success: false,
        data: {
          errors: [{ message: 'No view available' }],
        },
        code: ResponseStatusCodeEnums.NotFound,
      };
    }

    // 构建sort规则
    const sortRules = sort?.map((s) => ({
      fieldId: s.field,
      desc: s.order === 'desc',
    })) || [];

    // 获取view
    const view = await datasheet.getView({
      getViewInfo: (state: any) => {
        const viewInfo = this.transform.getViewInfo({
          recordIds,
          viewId: targetViewId,
          sortRules,
          snapshot,
          state,
        });

        // 应用公式过滤
        let rows = viewInfo.rows || [];
        if (filterByFormula) {
          rows = this.filter.getVisibleRows(filterByFormula, viewInfo, state);
        }

        // 获取字段映射
        const fieldMap = this.filter.fieldMapFilter(snapshot.meta.fieldMap, 'id', undefined);

        return {
          property: {
            ...viewInfo.property,
            rows,
          },
          fieldMap,
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

    // 获取记录
    const records = await view.getRecords();

    // 应用maxRecords限制
    const limitedRecords = maxRecords && maxRecords > 0 
      ? records.slice(0, maxRecords)
      : records;

    // 转换每条记录的字段数据
    const state = datasheet.store.getState();
    const datasheetName = await this.nodeService.getNameByNodeId(datasheetId);

    const outputs = await Promise.all(
      limitedRecords.map(async (record) => {
        const { eventFields } = transformOpFields({
          recordData: record.data,
          state,
          datasheetId,
          recordId: record.id,
        });

        return {
          datasheetId,
          datasheetName: datasheetName || '',
          recordId: record.id,
          recordUrl: getRecordUrl(datasheetId, record.id),
          fields: eventFields,
        };
      })
    );

    const output: FindRecordOutput = {
      records: outputs,
      count: outputs.length,
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
          description: '要查询的数据表ID',
        },
        viewId: {
          type: 'string',
          title: '视图ID',
          description: '可选，指定要查询的视图',
        },
        recordIds: {
          type: 'array',
          title: '记录ID列表',
          description: '可选，指定要查询的记录ID列表',
          items: {
            type: 'string',
          },
        },
        filterByFormula: {
          type: 'string',
          title: '公式过滤',
          description: '可选，使用公式过滤记录',
        },
        sort: {
          type: 'array',
          title: '排序规则',
          description: '可选，排序规则',
          items: {
            type: 'object',
            properties: {
              field: {
                type: 'string',
                title: '字段ID',
              },
              order: {
                type: 'string',
                title: '排序方向',
                enum: ['asc', 'desc'],
              },
            },
            required: ['field', 'order'],
          },
        },
        maxRecords: {
          type: 'number',
          title: '最大记录数',
          description: '可选，限制返回的最大记录数',
        },
      },
      required: ['datasheetId'],
    };
  }

  getUISchema(): IUiSchema {
    return {
      'ui:order': ['datasheetId', 'viewId', 'recordIds', 'filterByFormula', 'sort', 'maxRecords'],
    };
  }

  getOutputSchema(): IJsonSchema {
    return {
      type: 'object',
      properties: {
        records: {
          type: 'array',
          title: 'Records',
          items: {
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
          },
        },
        count: {
          type: 'number',
          title: 'Count',
          description: '记录总数',
        },
      },
      required: ['records', 'count'],
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

