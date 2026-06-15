import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
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
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReportingModule } from './modules/reporting/reporting.module';
import { AdminModule } from './modules/admin/admin.module';
import { TenancyModule } from './modules/tenancy/tenancy.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { MeetingsModule } from './modules/meetings/meetings.module';
import { DecisionRegisterModule } from './modules/decision-register/decision-register.module';
import { LegalOpinionsModule } from './modules/legal-opinions/legal-opinions.module';
import { CabinetSubmissionsModule } from './modules/cabinet-submissions/cabinet-submissions.module';
import { ParliamentarySessionsModule } from './modules/parliamentary-sessions/parliamentary-sessions.module';
import { VotingModule } from './modules/voting/voting.module';
import { PublicPortalModule } from './modules/public-portal/public-portal.module';
import { ModerationModule } from './modules/moderation/moderation.module';
import { AiTranslationModule } from './modules/ai-translation/ai-translation.module';
import { GlossaryModule } from './modules/glossary/glossary.module';
import { DocumentEditorModule } from './modules/document-editor/document-editor.module';
import { RedliningModule } from './modules/redlining/redlining.module';
import { CollaborationModule } from './modules/collaboration/collaboration.module';
import { SearchFacetsModule } from './modules/search-facets/search-facets.module';
import { WorkspaceModule } from './modules/workspace/workspace.module';
import { AdvancedAuditModule } from './modules/advanced-audit/advanced-audit.module';
import { DataRetentionModule } from './modules/data-retention/data-retention.module';
import { ClassificationModule } from './modules/classification/classification.module';
import { SecurityControlsModule } from './modules/security-controls/security-controls.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [configuration],
    }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'medium', ttl: 10000, limit: 50 },
      { name: 'long', ttl: 60000, limit: 200 },
    ]),
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
    NotificationsModule,
    ReportingModule,
    AdminModule,
    TenancyModule,
    OrganizationModule,
    DashboardModule,
    CalendarModule,
    MeetingsModule,
    DecisionRegisterModule,
    LegalOpinionsModule,
    CabinetSubmissionsModule,
    ParliamentarySessionsModule,
    VotingModule,
    PublicPortalModule,
    ModerationModule,
    AiTranslationModule,
    GlossaryModule,
    DocumentEditorModule,
    RedliningModule,
    CollaborationModule,
    SearchFacetsModule,
    WorkspaceModule,
    AdvancedAuditModule,
    DataRetentionModule,
    ClassificationModule,
    SecurityControlsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
