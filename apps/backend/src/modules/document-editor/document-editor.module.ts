import { Module } from '@nestjs/common';
import { DocumentEditorService } from './document-editor.service';
import { DocumentEditorController } from './document-editor.controller';

@Module({
  controllers: [DocumentEditorController],
  providers: [DocumentEditorService],
  exports: [DocumentEditorService],
})
export class DocumentEditorModule {}
