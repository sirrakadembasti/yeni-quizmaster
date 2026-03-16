import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Clear existing data
  await prisma.notification.deleteMany();
  await prisma.studentResult.deleteMany();
  await prisma.question.deleteMany();
  await prisma.quiz.deleteMany();
  await prisma.user.deleteMany();
  await prisma.class.deleteMany();
  await prisma.category.deleteMany();

  // 2. Create Categories
  const categories = [
    { name: 'Frontend', description: 'React, Vue, Tailwind CSS ve dahası.' },
    { name: 'Backend', description: 'Node.js, Python, Veritabanları.' },
    { name: 'Yapay Zeka', description: 'Makine Öğrenmesi ve Gemini AI.' },
    { name: 'Genel Kültür', description: 'Genel bilgi yarışmaları.' }
  ];

  for (const cat of categories) {
    await prisma.category.create({ data: cat });
  }

  // 3. Create NEW Secure Demo Accounts
  const hashedPassword = await bcrypt.hash('QuizMaster2026!', 10);

  const admin = await prisma.user.create({
    data: {
      name: 'Sistem Yöneticisi',
      email: 'admin@quizmaster.com',
      password: hashedPassword,
      role: 'admin'
    }
  });

  const teacher = await prisma.user.create({
    data: {
      name: 'Ahmet Öğretmen',
      email: 'teacher@quizmaster.com',
      password: hashedPassword,
      role: 'teacher'
    }
  });

  const student = await prisma.user.create({
    data: {
      name: 'Mehmet Öğrenci',
      email: 'student@quizmaster.com',
      password: hashedPassword,
      role: 'student'
    }
  });

  // 4. Create a Default Class
  await prisma.class.create({
    data: {
      name: '10-A Yazılım Geliştirme',
      description: 'Temel programlama sınıfı.',
      teachers: { connect: { id: teacher.id } },
      students: { connect: { id: student.id } }
    }
  });

  console.log('Seeding completed successfully!');
  console.log('------------------------------');
  console.log('DEMO ACCOUNTS (Password: QuizMaster2026!)');
  console.log('Admin: admin@quizmaster.com');
  console.log('Teacher: teacher@quizmaster.com');
  console.log('Student: student@quizmaster.com');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
