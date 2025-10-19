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

import { EntityRepository, Repository } from 'typeorm';
import { WorkdocDocumentEntity } from '../entities/workdoc.document.entity';

@EntityRepository(WorkdocDocumentEntity)
export class WorkdocDocumentRepository extends Repository<WorkdocDocumentEntity> {
  /**
   * Find document by documentId
   */
  async findByDocumentId(documentId: string): Promise<WorkdocDocumentEntity | undefined> {
    return await this.findOne({ where: { documentId, isDeleted: false } });
  }

  /**
   * Find document by datasheet, field, and record
   */
  async findByLocation(dstId: string, fieldId: string, recordId: string): Promise<WorkdocDocumentEntity | undefined> {
    return await this.findOne({
      where: {
        dstId,
        fieldId,
        recordId,
        isDeleted: false,
      },
    });
  }

  /**
   * Save or update document
   */
  async saveDocument(data: {
    documentId: string;
    dstId: string;
    fieldId: string;
    recordId: string;
    title?: string;
    content?: Buffer;
    updatedBy?: string;
  }): Promise<WorkdocDocumentEntity> {
    const existing = await this.findByDocumentId(data.documentId);

    if (existing) {
      // Update existing document
      await this.update(
        { documentId: data.documentId },
        {
          title: data.title,
          content: data.content,
          updatedBy: data.updatedBy,
        },
      );
      return (await this.findByDocumentId(data.documentId))!;
    } else {
      // Create new document
      const entity = this.create({
        documentId: data.documentId,
        dstId: data.dstId,
        fieldId: data.fieldId,
        recordId: data.recordId,
        title: data.title,
        content: data.content,
        createdBy: data.updatedBy,
        updatedBy: data.updatedBy,
      });
      return await this.save(entity);
    }
  }

  /**
   * Get document content as Uint8Array
   */
  async getDocumentContent(documentId: string): Promise<Uint8Array | null> {
    const doc = await this.findByDocumentId(documentId);
    if (!doc || !doc.content) {
      return null;
    }
    return new Uint8Array(doc.content);
  }

  /**
   * Save document content from Uint8Array
   */
  async saveDocumentContent(documentId: string, content: Uint8Array, updatedBy?: string): Promise<void> {
    const buffer = Buffer.from(content);
    await this.update({ documentId }, { content: buffer, updatedBy });
  }
}

