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

import { IActionType, IJsonSchema } from '@apitable/core';
import { Md5 } from 'ts-md5';
import { IBaseAction, IUiSchema } from '../interface/base.action';

export const customActionMap = new Map<string, IBaseAction>();
export const customActionTypeMetas = new Map<string, IActionTypeMeta>();
export const customActionTypeMap = new Map<string, IActionType>();
// 保存类引用，用于依赖注入
export const customActionClassMap = new Map<string, new (...args: any[]) => IBaseAction>();

interface IAutomationActionOption {
  themeLogo?: { light: string, dark?: string };
  description?: string;
}

interface IActionTypeMeta {
  actionTypeId: string,
  name: string,
  description: string,
  endpoint: string,
  inputJsonSchema: { schema: IJsonSchema, uiSchema: IUiSchema },
  outputJsonSchema: IJsonSchema,
  service: {
    serviceId: string,
    name: string,
    themeLogo: { light: string, dark?: string },
    slug: string
  }
}

// caat = custom automation action type
export const customActionNamePrefix = 'caat';

export function AutomationAction(name: string, option?: IAutomationActionOption): ClassDecorator {
  return (target) => {
    const nameHash = Md5.hashStr(name);
    const connectorActionTypeId = `${customActionNamePrefix}${nameHash}`;
    if (!customActionMap.has(nameHash)) {
      customActionTypeMap.set(connectorActionTypeId, {
        id: connectorActionTypeId,
        inputJSONSchema: { schema: target.prototype.getInputSchema(), uiSchema: target.prototype.getUISchema() },
        outputJSONSchema: target.prototype.getOutputSchema(),
        endpoint: 'endpoint',
        baseUrl: `action://${nameHash}`
      });
      customActionTypeMetas.set(connectorActionTypeId, {
        actionTypeId: connectorActionTypeId,
        name: name,
        description: option?.description ? option.description : '',
        endpoint: 'endpoint',
        inputJsonSchema: { schema: target.prototype.getInputSchema(), uiSchema: target.prototype.getUISchema() },
        outputJsonSchema: target.prototype.getOutputSchema(),
        service: {
          serviceId: `asv${nameHash}`,
          name: name,
          themeLogo: option?.themeLogo ? option.themeLogo : { light: 'space/2023/03/29/6e70cb7968cc482793459041c5eb56ca' },
          slug: nameHash
        }
      });
      // 保存类引用，用于依赖注入
      customActionClassMap.set(nameHash, target as any);
      // 为了向后兼容，仍然创建实例（如果不需要依赖注入的话）
      try {
      const instance = new target.prototype.constructor();
      customActionMap.set(nameHash, instance);
      } catch (error) {
        // 如果构造函数需要参数，则无法直接实例化，需要从容器获取
        // 这种情况下，customActionMap中不会有实例，需要在AutomationService中从容器获取
      }
    }
    return target;
  };
}