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
import fetch from 'node-fetch';
import { ResponseStatusCodeEnums } from '../enum/response.status.code.enums';
import { IActionResponse, IErrorResponse } from '../interface/action.response';

interface IDingtalkMessageRequest {
  type: 'text' | 'markdown';
  content: string;
  webhookUrl: string;
}

export async function sendDingtalkMsg(request: IDingtalkMessageRequest): Promise<IActionResponse<string>> {
  const { type, content, webhookUrl } = request;
  let body: any = {};
  switch (type) {
    case 'text':
      body = {
        text: {
          content: content,
        },
        msgtype: 'text',
      };
      break;
    case 'markdown':
      body = {
        msgtype: 'markdown',
        markdown: {
          text: content,
        },
      };
      break;
  }
  try {
    const response = await fetch(webhookUrl.trim(), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body,
    });
    const responseBody = response.clone();
    const result = await responseBody.json();
    if (result.errcode == "0") {
      return {
        success: true,
        code: ResponseStatusCodeEnums.Success,
        data: {
          data: result,
        },
      };
    }
    return {
      success: false,
      data: {
        errors: [
          {
            message: result.errmsg,
          },
        ],
      },
      code: ResponseStatusCodeEnums.ServerError,
    };
  } catch (error: any) {
    // network error
    const res: IErrorResponse = {
      errors: [
        {
          message: error.message,
        },
      ],
    };
    return {
      success: false,
      data: res,
      code: ResponseStatusCodeEnums.ServerError,
    };
  }
}
