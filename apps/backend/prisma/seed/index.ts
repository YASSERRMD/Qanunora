import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Qanunora database...');

  // ── Ministries ──────────────────────────────────────────────
  const ministryOfJustice = await prisma.ministry.upsert({
    where: { code: 'MOJ' },
    update: {},
    create: {
      name: 'Ministry of Justice',
      nameAr: 'وزارة العدل',
      code: 'MOJ',
      description: 'Responsible for the administration of justice and legal affairs',
    },
  });

  const ministryOfFinance = await prisma.ministry.upsert({
    where: { code: 'MOF' },
    update: {},
    create: {
      name: 'Ministry of Finance',
      nameAr: 'وزارة المالية',
      code: 'MOF',
      description: 'Responsible for financial regulation and fiscal policy',
    },
  });

  const ministryOfHealth = await prisma.ministry.upsert({
    where: { code: 'MOH' },
    update: {},
    create: {
      name: 'Ministry of Health',
      nameAr: 'وزارة الصحة',
      code: 'MOH',
      description: 'Responsible for public health legislation and regulation',
    },
  });

  console.log('Ministries seeded:', [ministryOfJustice.code, ministryOfFinance.code, ministryOfHealth.code]);

  // ── Users ────────────────────────────────────────────────────
  const SALT_ROUNDS = 10;

  const users = [
    {
      email: 'admin@qanunora.gov',
      password: 'Admin@123456',
      firstName: 'System',
      lastName: 'Administrator',
      role: UserRole.SUPER_ADMIN,
      ministryId: ministryOfJustice.id,
    },
    {
      email: 'legislative.admin@qanunora.gov',
      password: 'Admin@123456',
      firstName: 'Legislative',
      lastName: 'Admin',
      role: UserRole.LEGISLATIVE_ADMIN,
      ministryId: ministryOfJustice.id,
    },
    {
      email: 'legal.officer@moj.gov',
      password: 'Admin@123456',
      firstName: 'Ahmed',
      lastName: 'Al-Rashidi',
      role: UserRole.MINISTRY_LEGAL_OFFICER,
      ministryId: ministryOfJustice.id,
    },
    {
      email: 'drafter@moj.gov',
      password: 'Admin@123456',
      firstName: 'Sara',
      lastName: 'Al-Mansouri',
      role: UserRole.DRAFTING_OFFICER,
      ministryId: ministryOfJustice.id,
    },
    {
      email: 'reviewer@qanunora.gov',
      password: 'Admin@123456',
      firstName: 'Khalid',
      lastName: 'Al-Farsi',
      role: UserRole.REVIEWER,
      ministryId: ministryOfFinance.id,
    },
    {
      email: 'committee@qanunora.gov',
      password: 'Admin@123456',
      firstName: 'Fatima',
      lastName: 'Al-Zaabi',
      role: UserRole.COMMITTEE_MEMBER,
      ministryId: ministryOfJustice.id,
    },
    {
      email: 'auditor@qanunora.gov',
      password: 'Admin@123456',
      firstName: 'Omar',
      lastName: 'Al-Hamdan',
      role: UserRole.AUDITOR,
      ministryId: ministryOfJustice.id,
    },
    {
      email: 'viewer@qanunora.gov',
      password: 'Admin@123456',
      firstName: 'Noor',
      lastName: 'Al-Sayed',
      role: UserRole.VIEWER,
      ministryId: ministryOfHealth.id,
    },
  ];

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, SALT_ROUNDS);
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        passwordHash,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        ministryId: u.ministryId,
        isActive: true,
      },
    });
  }
  console.log(`Seeded ${users.length} users`);

  // ── Committees ───────────────────────────────────────────────
  const committees = [
    { name: 'Legal Affairs Committee', nameAr: 'لجنة الشؤون القانونية', description: 'Reviews draft laws and constitutional matters' },
    { name: 'Finance and Budget Committee', nameAr: 'لجنة المالية والميزانية', description: 'Reviews financial legislation and budget laws' },
    { name: 'Public Health Committee', nameAr: 'لجنة الصحة العامة', description: 'Reviews health-related legislation' },
    { name: 'Regulatory Review Committee', nameAr: 'لجنة مراجعة اللوائح', description: 'Reviews regulatory and administrative legislation' },
  ];

  for (const c of committees) {
    await prisma.committee.upsert({
      where: { name: c.name },
      update: {},
      create: {
        name: c.name,
        nameAr: c.nameAr,
        description: c.description,
        isActive: true,
      },
    });
  }
  console.log(`Seeded ${committees.length} committees`);

  // ── Stakeholders ─────────────────────────────────────────────
  const stakeholders = [
    {
      name: 'Chamber of Commerce',
      nameAr: 'غرفة التجارة',
      type: 'PRIVATE_SECTOR' as const,
      contactEmail: 'info@chamber.org',
      description: 'Represents private sector business interests',
    },
    {
      name: 'Bar Association',
      nameAr: 'نقابة المحامين',
      type: 'NGO' as const,
      contactEmail: 'info@barassoc.org',
      description: 'Represents legal professionals',
    },
    {
      name: 'National University',
      nameAr: 'الجامعة الوطنية',
      type: 'ACADEMIC' as const,
      contactEmail: 'legal@university.edu',
      description: 'Academic research and legal expertise',
    },
  ];

  for (const s of stakeholders) {
    await prisma.stakeholder.upsert({
      where: { name: s.name },
      update: {},
      create: s,
    });
  }
  console.log(`Seeded ${stakeholders.length} stakeholders`);

  // ── System Settings ──────────────────────────────────────────
  const settings = [
    { key: 'platform.name', value: { value: 'Qanunora' }, description: 'Platform display name', isPublic: true },
    { key: 'platform.version', value: { value: '1.0.0' }, description: 'Platform version', isPublic: true },
    { key: 'legislative.defaultConfidentiality', value: { value: 'INTERNAL' }, description: 'Default confidentiality level for new items', isPublic: false },
    { key: 'ai.disclaimer', value: { value: 'AI-assisted analysis, not legal advice' }, description: 'Standard AI analysis disclaimer', isPublic: true },
    { key: 'consultation.defaultDurationDays', value: { value: 30 }, description: 'Default public consultation duration in days', isPublic: false },
    { key: 'notifications.emailEnabled', value: { value: false }, description: 'Whether email notifications are enabled', isPublic: false },
  ];

  for (const setting of settings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
  }
  console.log(`Seeded ${settings.length} system settings`);

  console.log('\nSeed completed successfully!');
  console.log('\nDefault admin credentials:');
  console.log('  Email: admin@qanunora.gov');
  console.log('  Password: Admin@123456');
  console.log('\nIMPORTANT: Change default passwords before production deployment!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
