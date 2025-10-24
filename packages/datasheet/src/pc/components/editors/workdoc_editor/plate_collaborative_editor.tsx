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

import React, { useEffect, useState } from 'react';
import { YjsPlugin } from '@platejs/yjs/react';
import { useCreateEditor } from '../plate-editor/use-create-editor';
import { RemoteCursorOverlay } from '@/components/ui/remote-cursor-overlay';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Editor, EditorContainer } from '@/components/plate-ui/editor';
import { Plate } from '@udecode/plate/react';
import { useMounted } from '@/hooks/use-mounted';

interface IPlateEditorProps {
  documentId: string;
  userId: string;
  userName?: string;
  userColor?: string;
  resourceId: string;
  fieldId: string;
  recordId: string;
  title: string;
  readOnly?: boolean;
  placeholder?: string;
  onConnectionChange?: (status: 'connecting' | 'connected' | 'disconnected') => void;
}

/**
 * Tiptap 协作编辑器组件
 * 使用官方推荐的 Tiptap + Hocuspocus 实现实时协作
 */
export const PlateCollaborativeEditor: React.FC<IPlateEditorProps> = ({
  documentId,
  userId,
  userName = 'Anonymous',
  userColor = '#' + Math.floor(Math.random() * 16777215).toString(16),
  resourceId,
  fieldId,
  recordId,
  title,
  readOnly = false,
  placeholder = '开始编辑文档...',
  onConnectionChange,
}) => {

  // 创建 Tiptap 编辑器（仅在 provider 和 ydoc 准备好后）
  const editor = useCreateEditor(
    {
      readOnly: !readOnly,
      options: {
        skipInitialization: true,
      },
      plugins: [
        YjsPlugin.configure({
          render: {
            afterEditable: RemoteCursorOverlay,
          },
          options: {
            cursors: {
              data: {
                name: userName,
                color: userColor,
              },
            },
            providers: [
              {
                type: 'hocuspocus',
                options: {
                  name: documentId,
                },
                wsOptions: {
                  url: `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/document`,
                  maxAttempts: 5,
                  token: documentId,
                  parameters: {
                    userId,
                    resourceId,
                    fieldId,
                    recordId,
                    title,
                    documentId,
                    documentType: '0',
                  }
                },
              },
            ],
          },
        }),
      ],
    },
    [userName, userColor, placeholder, readOnly]
  );

  const mounted = useMounted();
  useEffect(() => {
    if (!mounted) return;
 
    editor.getApi(YjsPlugin).yjs.init({
      id: documentId,
      value: '',
    });
 
    return () => {
      editor.getApi(YjsPlugin).yjs.destroy();
    };
  }, [editor, mounted]);

  return (
    <DndProvider backend={HTML5Backend}>
    <Plate editor={editor} >
      <div className="relative">
        <EditorContainer variant="default">
          <Editor variant="default" readOnly={readOnly} className='min-h-200'/>
        </EditorContainer>
      </div>
    </Plate>
  </DndProvider>
  );
};

