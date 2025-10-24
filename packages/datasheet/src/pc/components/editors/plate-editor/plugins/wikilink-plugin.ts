'use client';

import { PluginConfig } from "@udecode/plate";
import { TriggerComboboxPluginOptions, withTriggerCombobox } from "@udecode/plate-combobox";
import { TMentionElement } from "@udecode/plate-mention";
import { createPlatePlugin } from "@udecode/plate/react";

export const WikiLinkInputPlugin = createPlatePlugin<'wikiLink_input'>(
  {
    key: 'wikiLink_input',
    node: { isElement: true, isInline: true, isVoid: true },
  }
);

export type WikiLinkConfig = PluginConfig<'wikiLink', {
  insertSpaceAfterMention?: boolean;
} & TriggerComboboxPluginOptions, {}, {
  insert: {
    wikiLink: (options: {
      search: string;
      value: any;
      key?: any;
      blockId?: string;
    }) => void;
  };
}>;

export const WikiLinkPlugin = createPlatePlugin<'wikiLink'>({
  key: 'wikiLink',
  node: { isElement: true, isInline: true, isMarkableVoid: true, isVoid: true },
  options: {
    trigger: '[',
    triggerPreviousCharPattern: /^\s?$/,
    createComboboxInput: (trigger: any) => ({
      children: [{ text: '' }],
      trigger,
      type: WikiLinkInputPlugin.key,
    }),
  },
  plugins: [WikiLinkInputPlugin],
}).extendEditorTransforms<WikiLinkConfig['transforms']>(({ editor, type }) => ({
  insert: {
    wikiLink: ({ key, value, blockId }) => {
      editor.tf.insertNodes<TMentionElement & { blockId?: string }>({
        key,
        blockId,
        children: [{ text: '' }],
        type,
        value,
      });
    },
  },
}))
  .overrideEditor(withTriggerCombobox as any);


export const wikiLinkPlugin = WikiLinkPlugin.configure({
  options: {
    triggerPreviousCharPattern: /^$|^[\s"']$/,
    insertSpaceAfterMention: true,
  },
  handlers: {
    onClick: (e: any) => {
      // 确保只有在有效的ID存在时才触发导航
      const target = e.event.target as HTMLElement;
      const element = e.node as any;
      
      if (target.id && e.options?.setActiveItem) {
        // 如果存在blockId，则添加到URL中
        const blockIdParam = element.blockId ? `/${element.blockId}` : '';
        e.options.setActiveItem('notes/edit/' + target.id + blockIdParam);
      }
    }
  },
}); 