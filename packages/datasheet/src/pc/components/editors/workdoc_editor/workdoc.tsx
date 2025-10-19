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

import React, { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { Button } from '@apitable/components';
import { Input, InputRef } from 'antd';
import { Drawer } from 'antd';
import { ICellValue, Strings, t, IWorkDocValue } from '@apitable/core';
import { CloseOutlined, EditOutlined } from '@apitable/icons';
import { SlateEditor } from 'pc/components/slate_editor';
import { GENERATOR, generateId } from 'pc/components/slate_editor/elements';
import { useAppSelector } from 'pc/store/react-redux';
import { Status } from './interface';
import styles from './workdoc.module.less';

interface IWorkDocCellValue extends IWorkDocValue {
  content?: any;
}

interface IWorkdocProps {
  datasheetId: string;
  cellValue?: ICellValue;
  editing?: boolean;
  toggleEditing?: (next?: boolean) => void;
  fieldId: string;
  recordId?: string;
  onSave?: (val: any) => void;
  editable?: boolean;
}

export const Workdoc: React.FC<IWorkdocProps> = (props) => {
  const { editing = false, toggleEditing, cellValue, onSave, editable = true, datasheetId, fieldId, recordId } = props;
  
  const userInfo = useAppSelector(state => state.user.info);
  const [status, setStatus] = useState<Status>(Status.Connecting);
  const providerRef = useRef<HocuspocusProvider | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  
  const createDefaultContent = useCallback(() => {
    return [GENERATOR.paragraph({})];
  }, []);

  const [documentValue, setDocumentValue] = useState<IWorkDocCellValue[]>(() => {
    const value = cellValue as IWorkDocCellValue[];
    if (value && Array.isArray(value) && value.length > 0) {
      return value;
    }
    // 创建新文档的初始值
    return [{
      documentId: generateId(),
      title: '',
      content: createDefaultContent()
    }];
  });

  const [editorContent, setEditorContent] = useState(() => {
    const value = cellValue as IWorkDocCellValue[];
    if (value && Array.isArray(value) && value.length > 0 && value[0].content) {
      return value[0].content;
    }
    return createDefaultContent();
  });
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const titleInputRef = useRef<InputRef>(null);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    const value = cellValue as IWorkDocCellValue[];
    if (value && Array.isArray(value) && value.length > 0) {
      setDocumentValue(value);
      setEditorContent(value[0]?.content || createDefaultContent());
    }
  }, [cellValue, createDefaultContent]);

  // Hocuspocus Provider 连接管理
  useEffect(() => {
    if (!editing || !recordId || !fieldId) {
      return;
    }

    // 确保 userInfo 已加载
    if (!userInfo?.uuid) {
      console.warn('[Hocuspocus] UserInfo not loaded yet');
      return;
    }

    const documentId = documentValue?.[0]?.documentId || generateId();
    const title = documentValue?.[0]?.title || '';
    
    console.log('[Hocuspocus] Connecting...', {
      userId: userInfo.uuid,
      resourceId: datasheetId,
      fieldId,
      recordId,
      documentId,
    });

    // 创建 Y.js 文档
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // 创建 Hocuspocus Provider
    const provider = new HocuspocusProvider({
      url: `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/document`,
      name: documentId, // 文档名称/ID
      document: ydoc,
      token: documentId,
      parameters: {
        userId: userInfo.uuid,
        resourceId: datasheetId,
        fieldId,
        recordId,
        title,
        documentType: '0',
      },
      onConnect: () => {
        console.log('[Hocuspocus] Connected');
        setStatus(Status.Connected);
      },
      onDisconnect: () => {
        console.log('[Hocuspocus] Disconnected');
        setStatus(Status.Disconnected);
      },
      onStatus: ({ status: providerStatus }) => {
        console.log('[Hocuspocus] Status:', providerStatus);
        if (providerStatus === 'connecting') {
          setStatus(Status.Connecting);
        } else if (providerStatus === 'connected') {
          setStatus(Status.Connected);
        } else if (providerStatus === 'disconnected') {
          setStatus(Status.Disconnected);
        }
      },
      onAuthenticationFailed: ({ reason }) => {
        console.error('[Hocuspocus] Authentication failed:', reason);
        setStatus(Status.Error);
      },
      onSynced: () => {
        console.log('[Hocuspocus] Document synced');
      },
    });

    providerRef.current = provider;

    // 监听文档变化
    const sharedType = ydoc.getMap('document');
    const observer = () => {
      const content = sharedType.get('content');
      if (content) {
        console.log('[Hocuspocus] Document updated from remote');
        setEditorContent(content);
        setDocumentValue(prev => {
          if (prev && prev.length > 0) {
            return [{
              ...prev[0],
              content,
            }];
          }
          return prev;
        });
      }
    };
    sharedType.observe(observer);

    return () => {
      console.log('[Hocuspocus] Cleaning up...');
      sharedType.unobserve(observer);
      provider.destroy();
      ydoc.destroy();
      providerRef.current = null;
      ydocRef.current = null;
    };
  }, [editing, recordId, fieldId, datasheetId, userInfo]);

  const handleEditorChange = useCallback((value: { document: any; meta: any }) => {
    // 更新编辑器内容
    setEditorContent(value.document);

    // 更新文档内容，但保持 documentId 和 title
    if (documentValue && documentValue.length > 0) {
      const updatedDoc = [{
        ...documentValue[0],
        content: value.document
      }];
      setDocumentValue(updatedDoc);

      // 通过 Y.js/Hocuspocus 实时同步内容
      if (ydocRef.current) {
        try {
          const sharedType = ydocRef.current.getMap('document');
          sharedType.set('content', value.document);
          sharedType.set('title', documentValue[0].title);
          sharedType.set('documentId', documentValue[0].documentId);
          console.log('[Hocuspocus] Document updated locally');
        } catch (error) {
          console.error('[Hocuspocus] Failed to update document:', error);
        }
      }
    }
  }, [documentValue]);

  const handleTitleChange = useCallback((newTitle: string) => {
    if (documentValue && documentValue.length > 0) {
      setDocumentValue([{
        ...documentValue[0],
        title: newTitle
      }]);
    }
  }, [documentValue]);

  const handleTitleEdit = useCallback(() => {
    setIsEditingTitle(true);
  }, []);

  const handleTitleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleTitleChange(e.target.value);
  }, [handleTitleChange]);

  const handleTitleInputBlur = useCallback(() => {
    setIsEditingTitle(false);
  }, []);

  const handleTitleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setIsEditingTitle(false);
    }
  }, []);

  const handleClose = useCallback(() => {
    toggleEditing?.(false);
  }, [toggleEditing]);

  const handleSave = useCallback(() => {
    // 确保文档数据是最新的
    const updatedDocumentValue = documentValue && documentValue.length > 0 ? [{
      ...documentValue[0],
      content: editorContent
    }] : documentValue;

    onSave?.(updatedDocumentValue);
    toggleEditing?.(false);
  }, [documentValue, editorContent, onSave, toggleEditing]);

  const documentTitle = useMemo(() => {
    return documentValue?.[0]?.title || '未命名文档';
  }, [documentValue]);

  if (!editing) {
    return null;
  }

  return (
    <Drawer
      open={editing}
      onClose={handleClose}
      width={800}
      placement="right"
      maskClosable={true}
      destroyOnClose={false}
      className={styles.workdoc}
      title={
        <div className={styles.header}>
          <div className={styles.status}>
            {status === Status.Connecting && (
              <span className={styles.connecting}>{t(Strings.workdoc_ws_connecting)}</span>
            )}
            {status === Status.Connected && (
              <span className={styles.connected}>{t(Strings.workdoc_ws_connected)}</span>
            )}
            {status === Status.Disconnected && (
              <span className={styles.disconnected}>{t(Strings.workdoc_ws_disconnected)}</span>
            )}
            {status === Status.Error && (
              <span className={styles.error}>{t(Strings.workdoc_ws_disconnected)}</span>
            )}
          </div>
          <div className={styles.titleSection}>
            {isEditingTitle ? (
              <Input
                ref={titleInputRef}
                value={documentTitle}
                onChange={handleTitleInputChange}
                onBlur={handleTitleInputBlur}
                onPressEnter={handleTitleInputKeyDown}
                className={styles.titleInput}
                maxLength={100}
              />
            ) : (
              <span className={styles.title} onClick={handleTitleEdit}>
                {documentTitle}
                {editable && <EditOutlined className={styles.editIcon} />}
              </span>
            )}
          </div>
          <Button
            type="button"
            prefixIcon={<CloseOutlined />}
            onClick={handleClose}
            className={styles.closeBtn}
          />
        </div>
      }
      footer={
        <div className={styles.footer}>
          <Button onClick={handleClose}>
            取消
          </Button>
          <Button
            color="primary"
            onClick={handleSave}
            disabled={!editable}
          >
            保存
          </Button>
        </div>
      }
    >
      <div className={styles.editorContainer}>
        <SlateEditor
          value={editorContent}
          onChange={handleEditorChange}
          placeholder="开始编辑文档内容..."
          mode="full"
          height="calc(100vh - 200px)"
          autoFocus={editing}
          readOnly={!editable}
          sectionSpacing='middle'
          useMention
          headerToolbarEnabled
        />
      </div>
    </Drawer>
  );
};
