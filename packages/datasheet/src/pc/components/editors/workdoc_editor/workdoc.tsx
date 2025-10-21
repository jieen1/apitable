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
  
  // 调试：监控 props 变化
  useEffect(() => {
    console.log('[WorkDoc] Props changed:', {
      editing,
      cellValue,
      fieldId,
      recordId,
    });
  }, [editing, cellValue, fieldId, recordId]);
  
  const userInfo = useAppSelector(state => state.user.info);
  const [status, setStatus] = useState<Status>(Status.Connecting);
  const providerRef = useRef<HocuspocusProvider | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const isLocalUpdateRef = useRef<boolean>(false); // 标记是否为本地更新
  const isSyncedRef = useRef<boolean>(false); // 标记是否已完成初始同步
  const currentDocIdRef = useRef<string>(''); // 当前连接的文档ID，用于防止文档切换时的内容混乱
  const [editorKey, setEditorKey] = useState<string>(''); // 编辑器唯一key，用于强制重新创建
  
  const createDefaultContent = useCallback(() => {
    return [GENERATOR.paragraph({})];
  }, []);

  const [documentMeta, setDocumentMeta] = useState<IWorkDocCellValue>(() => {
    const value = cellValue as IWorkDocCellValue[];
    console.log('[WorkDoc] Initializing documentMeta from cellValue:', value);
    if (value && Array.isArray(value) && value.length > 0) {
      console.log('[WorkDoc] Using existing document:', value[0]);
      return value[0];
    }
    const newMeta = {
      documentId: generateId(),
      title: '',
    };
    console.log('[WorkDoc] Creating new document:', newMeta);
    return newMeta;
  });

  // 当 cellValue 变化时同步（切换到其他单元格或 cellValue 延迟到达）
  useEffect(() => {
    const value = cellValue as IWorkDocCellValue[];
    console.log('[WorkDoc] cellValue changed effect triggered:', value, 'current documentMeta:', documentMeta);
    
    if (value && Array.isArray(value) && value.length > 0) {
      const newDocumentMeta = value[0];
      console.log('[WorkDoc] New documentMeta from cellValue:', newDocumentMeta);
      
      if (newDocumentMeta.documentId !== documentMeta.documentId) {
        console.log('[WorkDoc] Document ID changed! Old:', documentMeta.documentId, 'New:', newDocumentMeta.documentId);
        console.log('[WorkDoc] This will trigger reconnection with correct document ID');
        setEditorContent(createDefaultContent());
        isSyncedRef.current = false; // 重置同步状态
      }
      setDocumentMeta(newDocumentMeta);
    } else {
      console.log('[WorkDoc] cellValue is empty or invalid, keeping current documentMeta');
    }
  }, [cellValue, documentMeta.documentId, createDefaultContent]);

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

  // 调试：监控 editorContent 的变化
  useEffect(() => {
    console.log('[WorkDoc] editorContent changed:', editorContent, 'for document:', documentMeta.documentId);
  }, [editorContent, documentMeta.documentId]);

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

    isSyncedRef.current = false;
    isLocalUpdateRef.current = false;
    currentDocIdRef.current = documentId; // 记录当前连接的文档ID

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
          if (content && Array.isArray(content) && content.length > 0) {
            console.log('[Hocuspocus] Loading initial document content from server', content);
            setEditorContent(content as any);
          } else {
            console.log('[Hocuspocus] Document synced but no content on server, using empty document');
          }
        }
        
        // 在加载内容后才标记为已同步，允许后续的编辑同步
        isSyncedRef.current = true;
        
        // 在同步完成且内容加载后才设置编辑器key，确保编辑器创建时已有正确的内容
        const newEditorKey = `${documentId}_${Date.now()}`;
        console.log('[Hocuspocus] Setting new editor key after sync:', newEditorKey);
        setEditorKey(newEditorKey);
      },
    });

    providerRef.current = provider;

    // 监听文档变化
    const sharedType = ydoc.getMap('document');
    const observer = () => {
      // 如果是本地更新触发的，跳过处理，避免循环更新
      if (isLocalUpdateRef.current) {
        console.log('[Hocuspocus] Skipping observer for local update');
        isLocalUpdateRef.current = false;
        return;
      }
      
      const content = sharedType.get('content');
      if (content) {
        console.log('[Hocuspocus] Document content updated from remote', content);
        setEditorContent(content as any);
      }
    };
    sharedType.observe(observer);

    return () => {
      console.log('[Hocuspocus] Cleaning up provider and resetting state for document:', currentDocIdRef.current);
      sharedType.unobserve(observer);
      provider.destroy();
      ydoc.destroy();
      providerRef.current = null;
      ydocRef.current = null;
      isSyncedRef.current = false; // 重置同步状态
      isLocalUpdateRef.current = false; // 重置本地更新标记
      currentDocIdRef.current = ''; // 清除文档ID
      
    };
  }, [editing, recordId, fieldId, datasheetId, userInfo, documentMeta.documentId, documentMeta.title]);

  const handleEditorChange = useCallback((value: { document: any; meta: any }) => {
    // 始终更新本地状态，保持 UI 响应性
    setEditorContent(value.document);

    // 验证当前文档ID是否匹配，防止快速切换时的内容混乱
    if (currentDocIdRef.current !== documentMeta.documentId) {
      console.log('[Hocuspocus] Skipping sync - document ID mismatch', {
        current: currentDocIdRef.current,
        expected: documentMeta.documentId,
      });
      return;
    }

    if (!isSyncedRef.current) {
      console.log('[Hocuspocus] Skipping sync before initial document loaded');
      return;
    }

    // 通过 Y.js/Hocuspocus 实时同步内容到后端
    if (ydocRef.current) {
      try {
        // 标记为本地更新，避免 observer 重复处理
        isLocalUpdateRef.current = true;
        
        const sharedType = ydocRef.current.getMap('document');
        sharedType.set('content', value.document);
        console.log('[Hocuspocus] Document content updated locally', value.document);
      } catch (error) {
        console.error('[Hocuspocus] Failed to update document:', error);
        isLocalUpdateRef.current = false; // 发生错误时重置标记
      }
    }
  }, [documentMeta.documentId]);

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
          key={editorKey || documentMeta.documentId}
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
