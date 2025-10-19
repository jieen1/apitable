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

import { Hocuspocus, onAuthenticatePayload } from '@hocuspocus/server';
import { Database } from '@hocuspocus/extension-database';
import { Injectable } from '@nestjs/common';
import { getIPAddress } from 'shared/helpers/system.helper';
import { WorkdocDocumentRepository } from 'database/workdoc/repositories/workdoc.document.repository';

@Injectable()
export abstract class HocuspocusBaseService {

  init(port: number): Hocuspocus {
    return new Hocuspocus({
      port,
    });
  }
}

@Injectable()
export class HocuspocusService extends HocuspocusBaseService {

  constructor(
    private readonly workdocDocumentRepository: WorkdocDocumentRepository,
  ) {
    super();
  }

  override init(port: number): Hocuspocus {
    const self = this;
    return new Hocuspocus({
      name: getIPAddress(),
      port,
      
      async onListen(data) {
        console.log(`Hocuspocus server[${data.configuration.name}] is listening on port "${data.port}"!`);
      },

      // 认证
      async onAuthenticate(data: onAuthenticatePayload) {
        const { requestParameters, token } = data;
        const userId = requestParameters.get('userId');
        const resourceId = requestParameters.get('resourceId');
        const fieldId = requestParameters.get('fieldId');
        const recordId = requestParameters.get('recordId');

        console.log('[Hocuspocus] Authentication:', { userId, resourceId, fieldId, recordId, token });

        // 基础验证
        if (!userId || !resourceId || !fieldId) {
          throw new Error('Missing required parameters');
        }

        // TODO: 这里可以添加权限验证逻辑
        // 例如：检查用户是否有权限访问该文档

        return {
          user: {
            id: userId,
            name: userId,
          },
        };
      },

      // 连接建立
      async onConnect(data) {
        const { documentName, requestParameters } = data;
        console.log('[Hocuspocus] Client connected:', {
          documentName,
          userId: requestParameters.get('userId'),
          resourceId: requestParameters.get('resourceId'),
        });
      },

      // 连接断开
      async onDisconnect(data) {
        const { documentName } = data;
        console.log('[Hocuspocus] Client disconnected:', { documentName });
      },

      // 文档变更
      async onChange(data) {
        const { documentName } = data;
        console.log('[Hocuspocus] Document changed:', { documentName });
      },

      // 扩展
      extensions: [
        // 数据库扩展 - 用于持久化文档
        new Database({
          // 从数据库加载文档
          fetch: async ({ documentName }) => {
            console.log('[Hocuspocus] Fetching document:', documentName);
            
            try {
              // documentName 就是 documentId
              const content = await self.workdocDocumentRepository.getDocumentContent(documentName);
              
              if (content) {
                console.log('[Hocuspocus] Document loaded from database, size:', content.byteLength);
                return content;
              }
              
              console.log('[Hocuspocus] Document not found in database, will create new');
              return null;
            } catch (error) {
              console.error('[Hocuspocus] Error fetching document:', error);
              return null;
            }
          },

          // 保存文档到数据库
          store: async ({ documentName, state, requestParameters }) => {
            console.log('[Hocuspocus] Storing document:', documentName, 'size:', state.byteLength);
            
            try {
              const userId = requestParameters?.get('userId');
              const resourceId = requestParameters?.get('resourceId');
              const fieldId = requestParameters?.get('fieldId');
              const recordId = requestParameters?.get('recordId');
              const title = requestParameters?.get('title') || '';
              
              // 检查文档是否已存在
              const existing = await self.workdocDocumentRepository.findByDocumentId(documentName);
              
              if (existing) {
                // 更新现有文档
                await self.workdocDocumentRepository.saveDocumentContent(
                  documentName,
                  state,
                  userId || undefined
                );
                console.log('[Hocuspocus] Document content updated');
              } else if (resourceId && fieldId && recordId) {
                // 创建新文档
                await self.workdocDocumentRepository.saveDocument({
                  documentId: documentName,
                  dstId: resourceId,
                  fieldId,
                  recordId,
                  title,
                  content: Buffer.from(state),
                  updatedBy: userId || undefined,
                });
                console.log('[Hocuspocus] New document created');
              } else {
                console.warn('[Hocuspocus] Missing location parameters, cannot save document');
              }
            } catch (error) {
              console.error('[Hocuspocus] Error storing document:', error);
            }
          },
        }),
      ],
    });
  }
}