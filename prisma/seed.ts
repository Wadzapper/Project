import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding ...');

  // Clean up existing data (optional, be careful in production)
  // Order matters due to foreign key constraints
  await prisma.skillTreeNode.deleteMany({});
  await prisma.skillTree.deleteMany({});
  await prisma.skill.deleteMany({});
  await prisma.user.deleteMany({}); // This will also delete accounts and sessions due to cascading

  // Create a sample user
  const hashedPassword = await bcrypt.hash('password123', 10);
  const user1 = await prisma.user.create({
    data: {
      email: 'user1@example.com',
      name: 'Test User One',
      passwordHash: hashedPassword,
      emailVerified: new Date(), // Mark as verified for simplicity
    },
  });
  console.log(`Created user: ${user1.name} (ID: ${user1.id})`);

  // Create some skills for this user
  const skill1 = await prisma.skill.create({
    data: {
      userId: user1.id,
      name: 'Learn Next.js',
      description: 'Master the fundamentals of Next.js App Router.',
      currentLevel: 2,
      currentXp: 150,
      targetXpForNextLevel: 200,
    },
  });

  const skill2 = await prisma.skill.create({
    data: {
      userId: user1.id,
      name: 'Prisma Basics',
      description: 'Understand Prisma schema, client, and migrations.',
      currentLevel: 1,
      currentXp: 50,
      targetXpForNextLevel: 100,
    },
  });

  const skill3 = await prisma.skill.create({
    data: {
      userId: user1.id,
      name: 'Tailwind CSS Styling',
      description: 'Learn utility-first CSS with Tailwind.',
    },
  });
  console.log(`Created skills for ${user1.name}`);

  // Create a skill tree for this user
  const webDevTree = await prisma.skillTree.create({
    data: {
      userId: user1.id,
      name: 'Web Development Path',
      description: 'A skill tree for frontend and backend development.',
    },
  });
  console.log(`Created skill tree: ${webDevTree.name}`);

  // Create nodes for the skill tree
  const node1_nextjs = await prisma.skillTreeNode.create({
    data: {
      skillTreeId: webDevTree.id,
      skillId: skill1.id,
      positionX: 100,
      positionY: 50,
    },
  });

  const node2_prisma = await prisma.skillTreeNode.create({
    data: {
      skillTreeId: webDevTree.id,
      skillId: skill2.id,
      parentNodeId: node1_nextjs.id, // Prisma depends on Next.js knowledge in this tree
      positionX: 250,
      positionY: 150,
    },
  });

  const node3_tailwind = await prisma.skillTreeNode.create({
    data: {
      skillTreeId: webDevTree.id,
      skillId: skill3.id,
      parentNodeId: node1_nextjs.id, // Tailwind also related to Next.js
      positionX: 250,
      positionY: 0, // Different Y for branching view
    },
  });
  console.log(`Created nodes for skill tree: ${webDevTree.name}`);

  // --- Example of another user and their data (optional) ---
  const user2 = await prisma.user.create({
    data: {
      email: 'user2@example.com',
      name: 'Test User Two',
      passwordHash: await bcrypt.hash('securepass', 10),
      emailVerified: new Date(),
    },
  });
  console.log(`Created user: ${user2.name} (ID: ${user2.id})`);

  const skill_user2_1 = await prisma.skill.create({
    data: {
      userId: user2.id,
      name: 'Public Speaking',
      description: 'Improve confidence and delivery in presentations.',
    }
  });
   console.log(`Created skills for ${user2.name}`);


  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
