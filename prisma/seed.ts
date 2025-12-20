import { PrismaClient, WorkspaceRole } from '@prisma/client';
import { getConfig } from '../src/lib/config';
import { logger } from '../src/lib/logger';

const prisma = new PrismaClient();

async function main() {
  const config = getConfig();

  const workspace = await prisma.workspace.upsert({
    where: { slug: 'demo-workspace' },
    update: {},
    create: {
      name: 'Demo Workspace',
      slug: 'demo-workspace'
    }
  });

  const user = await prisma.user.upsert({
    where: { email: 'owner@example.com' },
    update: {},
    create: {
      email: 'owner@example.com',
      name: 'Demo Owner'
    }
  });

  await prisma.workspaceMember.upsert({
    where: {
      workspace_user_unique: {
        workspaceId: workspace.id,
        userId: user.id
      }
    },
    update: {
      role: WorkspaceRole.OWNER,
      joinedAt: new Date()
    },
    create: {
      workspaceId: workspace.id,
      userId: user.id,
      role: WorkspaceRole.OWNER,
      invitedAt: new Date(),
      joinedAt: new Date()
    }
  });

  logger.info({ workspace: workspace.slug, user: user.email, env: config.nodeEnv }, 'database seeded');
}

main()
  .catch((error) => {
    logger.error(error, 'failed to seed database');
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
