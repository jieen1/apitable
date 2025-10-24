'use client';

import { createPlatePlugin } from '@udecode/plate/react';
import { FindReplaceToolbar } from './find-replace-toolbar';

export const FindReplaceToolbarPlugin = createPlatePlugin({
  key: 'find-replace-toolbar',
  render: {
    // 在编辑器外部渲染搜索工具栏
    afterEditable: () => <FindReplaceToolbar />,
  },
}); 