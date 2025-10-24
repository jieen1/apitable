'use client';

import { MentionPlugin } from '@udecode/plate-mention/react';

export const mentionPlugin = MentionPlugin.configure({
  options: { 
    triggerPreviousCharPattern: /^$|^[\s"']$/,
    insertSpaceAfterMention: true,
   },
   handlers: {
    onClick: (e) => {
      // 确保只有在有效的ID存在时才触发导航
      const target = e.event.target as HTMLElement;
      const options = e.getOptions() as any;
      
      if (target.id && options.setActiveItem) {
        options.setActiveItem('notes/edit/' + target.id);
      }
    }
   }
});
