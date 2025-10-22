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
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Highlight from '@tiptap/extension-highlight';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { TiptapToolbar } from './tiptap_toolbar';
import styles from './tiptap_editor.module.less';

interface ITiptapEditorProps {
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
export const TiptapCollaborativeEditor: React.FC<ITiptapEditorProps> = ({
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
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);

  // 创建 Y.js 文档和 Hocuspocus Provider
  useEffect(() => {
    // 创建 Y.js 文档
    const doc = new Y.Doc();
    setYdoc(doc);

    // 创建 Hocuspocus Provider
    const prov = new HocuspocusProvider({
      url: `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/document`,
      name: documentId,
      document: doc,
      token: documentId,
      parameters: {
        userId,
        resourceId,
        fieldId,
        recordId,
        title,
        documentId,
        documentType: '0',
      },
      onStatus: ({ status }) => {
        console.log('[Hocuspocus] Status:', status);
        onConnectionChange?.(status as any);
      },
      onSynced: () => {
        console.log('[Hocuspocus] Document synced');
      },
    });

    setProvider(prov);

    return () => {
      prov.destroy();
      doc.destroy();
      setProvider(null);
      setYdoc(null);
    };
  }, [documentId, userId, resourceId, fieldId, recordId, title, onConnectionChange]);

  // 创建 Tiptap 编辑器（仅在 provider 和 ydoc 准备好后）
  const editor = useEditor(
    {
      editable: !readOnly,
      extensions: provider && ydoc ? [
        StarterKit.configure({
          // 禁用默认的 history，因为协作模式有自己的历史
          history: false,
        }),
        // 协作编辑扩展
        Collaboration.configure({
          document: ydoc,
        }),
        // 协作光标扩展
        CollaborationCaret.configure({
          provider: provider,
          user: {
            name: userName,
            color: userColor,
          },
        }),
        // 其他编辑器功能
        Placeholder.configure({
          placeholder,
        }),
        Underline,
        TextAlign.configure({
          types: ['heading', 'paragraph'],
        }),
        Link.configure({
          openOnClick: false,
        }),
        Image,
        Highlight,
        TextStyle,
        Color,
      ] : [],
    },
    [provider, ydoc, userName, userColor, placeholder, readOnly]
  );

  // 更新只读状态
  useEffect(() => {
    if (editor) {
      editor.setEditable(!readOnly);
    }
  }, [editor, readOnly]);

  // 清理
  useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  if (!editor) {
    return <div className={styles.tiptapEditor}>加载中...</div>;
  }

  return (
    <div className={styles.tiptapEditor}>
      {!readOnly && <TiptapToolbar editor={editor} />}
      <EditorContent editor={editor} className={styles.editorContent} />
    </div>
  );
};

