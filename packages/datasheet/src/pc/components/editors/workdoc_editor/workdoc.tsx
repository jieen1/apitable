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
import { Input, InputRef } from 'antd';
import { Drawer } from 'antd';
import { ICellValue, Strings, t, IWorkDocValue } from '@apitable/core';
import { EditOutlined } from '@apitable/icons';
import { SlateEditor } from 'pc/components/slate_editor';
import { GENERATOR, generateId } from 'pc/components/slate_editor/elements';
import { useAppSelector } from 'pc/store/react-redux';
import { Status } from './interface';
import styles from './workdoc.module.less';

interface IWorkDocCellValue extends IWorkDocValue {
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

  const [documentMeta, setDocumentMeta] = useState<IWorkDocCellValue>(() => {
    const value = cellValue as IWorkDocCellValue[];
    if (value && Array.isArray(value) && value.length > 0) {
      return value[0];
    }
    return {
      documentId: generateId(),
      title: '',
    };
  });

  // 当 cellValue 变化时同步（切换到其他单元格）
  useEffect(() => {
    const value = cellValue as IWorkDocCellValue[];
    if (value && Array.isArray(value) && value.length > 0) {
      setDocumentMeta(value[0]);
    }
  }, [cellValue]);

  useEffect(() => {
    if (editing && (!cellValue || (cellValue as IWorkDocCellValue[]).length === 0)) {
      console.log('[WorkDoc] New document created, saving metadata immediately:', documentMeta);
      const saveValue: IWorkDocValue[] = [documentMeta];
      onSave?.(saveValue);
    }
  }, [editing]); // 只依赖 editing，在打开编辑器时执行一次

  const [localTitle, setLocalTitle] = useState('');
  
  const [editorContent, setEditorContent] = useState(() => createDefaultContent());
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const titleInputRef = useRef<InputRef>(null);

  // 当开始编辑标题时，初始化本地标题值
  useEffect(() => {
    if (isEditingTitle) {
      setLocalTitle(documentMeta.title || '');
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditingTitle, documentMeta.title]);

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

    const { documentId, title } = documentMeta;

    console.log('[Hocuspocus] Connecting to document:', documentId, {
      title,
      fieldId,
      recordId,
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
        documentId, // 明确传递documentId参数
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
        // 同步完成后，从Y.js加载初始内容
        if (ydocRef.current) {
          const sharedType = ydocRef.current.getMap('document');
          const content = sharedType.get('content');
          if (content) {
            console.log('[Hocuspocus] Loading initial document content', content);
            setEditorContent(content as any);
          }
        }
      },
    });

    providerRef.current = provider;

    // 监听文档变化
    const sharedType = ydoc.getMap('document');
    const observer = () => {
      const content = sharedType.get('content');
      if (content) {
        console.log('[Hocuspocus] Document content updated from remote', content);
        setEditorContent(content as any);
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
  }, [editing, recordId, fieldId, datasheetId, userInfo, documentMeta]);

  const handleEditorChange = useCallback((value: { document: any; meta: any }) => {
    // 更新编辑器内容
    setEditorContent(value.document);

    // 通过 Y.js/Hocuspocus 实时同步内容到后端
    if (ydocRef.current) {
      try {
        const sharedType = ydocRef.current.getMap('document');
        sharedType.set('content', value.document);
        console.log('[Hocuspocus] Document content updated locally', value.document);
      } catch (error) {
        console.error('[Hocuspocus] Failed to update document:', error);
      }
    }
  }, []);

  // 保存文档元数据到 datasheet
  const saveDocumentMeta = useCallback((title: string) => {
    const saveValue: IWorkDocValue[] = [{
      documentId: documentMeta.documentId,
      title: title || documentMeta.title || '',
    }];

    console.log('[WorkDoc] Saving document metadata:', saveValue);
    onSave?.(saveValue);
  }, [documentMeta, onSave]);

  // 标题编辑相关
  const handleTitleEdit = useCallback(() => {
    setIsEditingTitle(true);
  }, []);

  const handleTitleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalTitle(e.target.value);
  }, []);

  const handleTitleSave = useCallback(() => {
    setIsEditingTitle(false);
    // 只有标题发生变化时才保存
    if (localTitle !== documentMeta.title) {
      saveDocumentMeta(localTitle);
    }
  }, [localTitle, documentMeta.title, saveDocumentMeta]);

  const handleTitleInputBlur = useCallback(() => {
    handleTitleSave();
  }, [handleTitleSave]);

  const handleTitleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      // ESC 取消编辑，恢复原标题
      setIsEditingTitle(false);
    }
  }, [handleTitleSave]);

  const handleClose = useCallback(() => {
    toggleEditing?.(false);
  }, [toggleEditing]);

  // 当前显示的标题
  const documentTitle = useMemo(() => {
    if (isEditingTitle) {
      return localTitle;
    }
    return documentMeta.title || '未命名文档';
  }, [isEditingTitle, localTitle, documentMeta.title]);

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
        </div>
      }
      footer={null}
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
