import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './modules/database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import configuration from './config/configuration';
import { LegislativeModule } from './modules/legislative/legislative.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { VersionsModule } from './modules/versions/versions.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { CommitteesModule } from './modules/committees/committees.module';
import { AmendmentsModule } from './modules/amendments/amendments.module';
import { LegalStructureModule } from './modules/legal-structure/legal-structure.module';
import { ConsultationsModule } from './modules/consultations/consultations.module';
import { StakeholdersModule } from './modules/stakeholders/stakeholders.module';
import { AiProvidersModule } from './modules/ai-providers/ai-providers.module';
import { AiSummarizationModule } from './modules/ai-summarization/ai-summarization.module';
import { AiImpactModule } from './modules/ai-impact/ai-impact.module';
import { RegulatoryMappingModule } from './modules/regulatory-mapping/regulatory-mapping.module';
import { JurisdictionComparisonModule } from './modules/jurisdiction-comparison/jurisdiction-comparison.module';
import { TraceabilityModule } from './modules/traceability/traceability.module';
import { ChangeDetectionModule } from './modules/change-detection/change-detection.module';
import { ConsultationAnalyticsModule } from './modules/consultation-analytics/consultation-analytics.module';
import { KnowledgeGraphModule } from './modules/knowledge-graph/knowledge-graph.module';
import { SemanticSearchModule } from './modules/semantic-search/semantic-search.module';
import { RagAssistantModule } from './modules/rag-assistant/rag-assistant.module';
import { AuditReadinessModule } from './modules/audit-readiness/audit-readiness.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [configuration],
    }),
    DatabaseModule,
    AuthModule,
    LegislativeModule,
    DocumentsModule,
    VersionsModule,
    WorkflowModule,
    CommitteesModule,
    AmendmentsModule,
    LegalStructureModule,
    ConsultationsModule,
    StakeholdersModule,
    AiProvidersModule,
    AiSummarizationModule,
    AiImpactModule,
    RegulatoryMappingModule,
    JurisdictionComparisonModule,
    TraceabilityModule,
    ChangeDetectionModule,
    ConsultationAnalyticsModule,
    KnowledgeGraphModule,
    SemanticSearchModule,
    RagAssistantModule,
    AuditReadinessModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
