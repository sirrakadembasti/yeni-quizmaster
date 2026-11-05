import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { createRuntimePrismaClient } from "../utils/sqlite-runtime";
import { DEMO_SHOWCASE_ACCOUNTS, DEMO_SHOWCASE_PASSWORD } from "../utils/demo-mode";

const serverDir = path.resolve(import.meta.dirname, "..");
const sourceDbPath = path.resolve(serverDir, "data", "quiz.db");
const targetDemoDbPath = path.resolve(serverDir, "data", "demo.db");

export async function seedDemoShowcaseAccounts(prisma: PrismaClient) {
  const passwordHash = await bcrypt.hash(DEMO_SHOWCASE_PASSWORD, 10);

  // 1. demo-admin
  const adminMeta = DEMO_SHOWCASE_ACCOUNTS.find((a) => a.key === "demo-admin")!;
  const demoAdmin = await prisma.user.upsert({
    where: { email: adminMeta.email },
    update: {
      name: adminMeta.name,
      password: passwordHash,
      role: "admin",
      isActive: true,
      deactivatedAt: null,
    },
    create: {
      name: adminMeta.name,
      email: adminMeta.email,
      password: passwordHash,
      role: "admin",
      isActive: true,
    },
  });

  // 2. demo-ogretmen
  const categories = await prisma.category.findMany();
  const mathCategory =
    categories.find((c) => c.name.toLowerCase().includes("matematik")) || categories[0];

  const targetClasses = await prisma.class.findMany({
    where: { name: { in: ["9-A", "9-B", "10-A", "11-A", "12-A"] } },
    include: {
      students: {
        where: { role: "student", isActive: true },
        orderBy: { studentNo: "asc" },
      },
    },
  });

  const teacherMeta = DEMO_SHOWCASE_ACCOUNTS.find((a) => a.key === "demo-ogretmen")!;
  const demoTeacher = await prisma.user.upsert({
    where: { email: teacherMeta.email },
    update: {
      name: teacherMeta.name,
      password: passwordHash,
      role: "teacher",
      isActive: true,
      deactivatedAt: null,
      phoneNumber: "0532 100 20 30",
      address: "Merkez Kampüs Matematik Zümresi",
      ...(mathCategory
        ? {
            assignedCategories: {
              connect: [{ id: mathCategory.id }],
            },
          }
        : {}),
      managedClasses: {
        connect: targetClasses.map((c) => ({ id: c.id })),
      },
    },
    create: {
      name: teacherMeta.name,
      email: teacherMeta.email,
      password: passwordHash,
      role: "teacher",
      isActive: true,
      phoneNumber: "0532 100 20 30",
      address: "Merkez Kampüs Matematik Zümresi",
      ...(mathCategory
        ? {
            assignedCategories: {
              connect: [{ id: mathCategory.id }],
            },
          }
        : {}),
      managedClasses: {
        connect: targetClasses.map((c) => ({ id: c.id })),
      },
    },
  });

  if (mathCategory) {
    for (const cls of targetClasses) {
      await prisma.class.update({
        where: { id: cls.id },
        data: {
          assignedCategories: {
            connect: [{ id: mathCategory.id }],
          },
        },
      });

      await prisma.classTeacherCourse.upsert({
        where: {
          classId_teacherId_categoryId: {
            classId: cls.id,
            teacherId: demoTeacher.id,
            categoryId: mathCategory.id,
          },
        },
        update: {},
        create: {
          classId: cls.id,
          teacherId: demoTeacher.id,
          categoryId: mathCategory.id,
        },
      });
    }
  }

  const class9A = targetClasses.find((c) => c.name === "9-A") || targetClasses[0];
  const class10A = targetClasses.find((c) => c.name === "10-A") || targetClasses[1] || class9A;

  // 3. demo-ogrenci (assigned to 9-A)
  const studentMeta = DEMO_SHOWCASE_ACCOUNTS.find((a) => a.key === "demo-ogrenci")!;
  const maxStudentNoIn9A =
    class9A?.students.reduce((max, s) => Math.max(max, s.studentNo || 0), 0) || 100;
  const existingDemoStudent = await prisma.user.findUnique({
    where: { email: studentMeta.email },
  });
  const demoStudentNo = existingDemoStudent?.studentNo || maxStudentNoIn9A + 1;

  const demoStudent = await prisma.user.upsert({
    where: { email: studentMeta.email },
    update: {
      name: studentMeta.name,
      password: passwordHash,
      role: "student",
      isActive: true,
      deactivatedAt: null,
      classId: class9A?.id || null,
      studentNo: demoStudentNo,
      classNo: `9-A-${demoStudentNo}`,
      phoneNumber: "0555 200 30 40",
      address: "Cumhuriyet Mah. Atatürk Cad. No: 12",
    },
    create: {
      name: studentMeta.name,
      email: studentMeta.email,
      password: passwordHash,
      role: "student",
      isActive: true,
      classId: class9A?.id || null,
      studentNo: demoStudentNo,
      classNo: `9-A-${demoStudentNo}`,
      phoneNumber: "0555 200 30 40",
      address: "Cumhuriyet Mah. Atatürk Cad. No: 12",
    },
  });

  // Create/Upsert 2 showcase quizzes owned by demoTeacher so teacher & student & parent views are rich
  const showcaseQuizzes = [
    {
      id: "demo-showcase-quiz-9-math",
      title: "9. Sınıf Matematik 1. Dönem Vitrin Deneme Sınavı",
      description: "Demo öğretmen, öğrenci ve veli panellerinde analiz, karne ve soru detaylarını incelemek için hazırlanmış örnek sınav.",
      targetClass: class9A,
      questions: [
        {
          id: "demo-q-9m-1",
          text: "p ≡ 1 ve q ≡ 0 önermeleri için (p ⇒ q) ∨ p bileşik önermesinin doğruluk değeri nedir?",
          options: ["1", "0", "p'ye bağlıdır", "q'ya bağlıdır"],
          correctAnswer: "1",
          order: 1,
        },
        {
          id: "demo-q-9m-2",
          text: "A = {1, 2, 3, 4} ve B = {3, 4, 5, 6} kümeleri için s(A ∪ B) kaçtır?",
          options: ["4", "5", "6", "8"],
          correctAnswer: "6",
          order: 2,
        },
        {
          id: "demo-q-9m-3",
          text: "3x - 7 = 14 denkleminde x değeri kaçtır?",
          options: ["5", "6", "7", "8"],
          correctAnswer: "7",
          order: 3,
        },
        {
          id: "demo-q-9m-4",
          text: "Bir dik üçgende dik kenarlar 6 cm ve 8 cm ise hipotenüs kaç cm'dir?",
          options: ["9", "10", "12", "14"],
          correctAnswer: "10",
          order: 4,
        },
        {
          id: "demo-q-9m-5",
          text: "|2x - 4| = 6 denkleminin çözüm kümesi aşağıdakilerden hangisidir?",
          options: ["{-1, 5}", "{1, 5}", "{-5, 1}", "{-1, -5}"],
          correctAnswer: "{-1, 5}",
          order: 5,
        },
      ],
    },
    {
      id: "demo-showcase-quiz-10-math",
      title: "10. Sınıf Matematik Fonksiyonlar ve Polinomlar Vitrin Sınavı",
      description: "10. sınıf düzeyinde fonksiyon, polinom ve çarpanlara ayırma kazanımlarını ölçen demo sınavı.",
      targetClass: class10A,
      questions: [
        {
          id: "demo-q-10m-1",
          text: "f(x) = 2x + 5 fonksiyonu için f(3) değeri kaçtır?",
          options: ["8", "10", "11", "13"],
          correctAnswer: "11",
          order: 1,
        },
        {
          id: "demo-q-10m-2",
          text: "P(x) = x² - 4x + 7 polinomunun (x - 2) ile bölümünden kalan kaçtır?",
          options: ["1", "3", "5", "7"],
          correctAnswer: "3",
          order: 2,
        },
        {
          id: "demo-q-10m-3",
          text: "x² - 9 ifadesinin çarpanlarına ayrılmış biçimi hangisidir?",
          options: ["(x-3)(x+3)", "(x-9)(x+1)", "(x-3)²", "(x+3)²"],
          correctAnswer: "(x-3)(x+3)",
          order: 3,
        },
        {
          id: "demo-q-10m-4",
          text: "5 farklı kitap düz bir rafa kaç farklı şekilde dizilebilir?",
          options: ["24", "60", "120", "240"],
          correctAnswer: "120",
          order: 4,
        },
      ],
    },
  ];

  for (const qDef of showcaseQuizzes) {
    if (!qDef.targetClass) continue;
    await prisma.quiz.upsert({
      where: { id: qDef.id },
      update: {
        title: qDef.title,
        description: qDef.description,
        categoryId: mathCategory?.id || null,
        difficulty: "medium",
        timeLimit: 25,
        shuffleQuestions: false,
        createdBy: demoTeacher.id,
        status: "published",
        contentType: "exam",
        publishedAt: new Date("2026-10-20T09:00:00.000Z"),
        audienceSize: qDef.targetClass.students.length + 1,
        assignedClasses: {
          connect: [{ id: qDef.targetClass.id }],
        },
      },
      create: {
        id: qDef.id,
        title: qDef.title,
        description: qDef.description,
        categoryId: mathCategory?.id || null,
        difficulty: "medium",
        timeLimit: 25,
        shuffleQuestions: false,
        createdBy: demoTeacher.id,
        status: "published",
        contentType: "exam",
        publishedAt: new Date("2026-10-20T09:00:00.000Z"),
        audienceSize: qDef.targetClass.students.length + 1,
        assignedClasses: {
          connect: [{ id: qDef.targetClass.id }],
        },
      },
    });

    for (const qItem of qDef.questions) {
      await prisma.question.upsert({
        where: { id: qItem.id },
        update: {
          quizId: qDef.id,
          text: qItem.text,
          type: "multiple-choice",
          options: JSON.stringify(qItem.options),
          correctAnswer: qItem.correctAnswer,
          order: qItem.order,
        },
        create: {
          id: qItem.id,
          quizId: qDef.id,
          text: qItem.text,
          type: "multiple-choice",
          options: JSON.stringify(qItem.options),
          correctAnswer: qItem.correctAnswer,
          order: qItem.order,
        },
      });
    }

    const studentsToSeed =
      qDef.targetClass.name === "9-A"
        ? [demoStudent, ...qDef.targetClass.students.slice(0, 12)]
        : qDef.targetClass.students.slice(0, 12);

    for (let idx = 0; idx < studentsToSeed.length; idx++) {
      const student = studentsToSeed[idx];
      const answers: Record<string, string> = {};
      let correctCount = 0;
      qDef.questions.forEach((question, qIdx) => {
        const isCorrect = idx === 0 ? qIdx !== qDef.questions.length - 1 : (idx + qIdx) % 4 !== 0;
        const chosen = isCorrect
          ? question.correctAnswer
          : question.options.find((opt) => opt !== question.correctAnswer) || question.options[0];
        answers[question.id] = chosen;
        if (chosen === question.correctAnswer) correctCount++;
      });
      const score = Math.round((correctCount / qDef.questions.length) * 100);
      const resultId = `demo-res-${qDef.id}-${student.id}`;
      const existingResult = await prisma.studentResult.findFirst({
        where: { studentId: student.id, quizId: qDef.id },
      });
      const submittedAt = new Date("2026-10-21T10:30:00.000Z");

      if (existingResult) {
        await prisma.studentResult.update({
          where: { id: existingResult.id },
          data: {
            status: "completed",
            answers: JSON.stringify(answers),
            score,
            correctAnswersCount: correctCount,
            totalQuestions: qDef.questions.length,
            timeTaken: 620 + idx * 35,
            submittedAt,
            completedAt: submittedAt,
          },
        });
      } else {
        await prisma.studentResult.create({
          data: {
            id: resultId,
            studentId: student.id,
            quizId: qDef.id,
            status: "completed",
            answers: JSON.stringify(answers),
            score,
            correctAnswersCount: correctCount,
            totalQuestions: qDef.questions.length,
            timeTaken: 620 + idx * 35,
            startedAt: new Date("2026-10-21T10:15:00.000Z"),
            submittedAt,
            completedAt: submittedAt,
          },
        });
      }
    }
  }

  // Also ensure demoStudent has results on 3 existing 9-A exams so their dashboard & stats are rich
  if (class9A) {
    const class9AQuizzes = await prisma.quiz.findMany({
      where: {
        status: "published",
        contentType: "exam",
        assignedClasses: { some: { id: class9A.id } },
        NOT: { id: { startsWith: "demo-showcase-" } },
      },
      include: { questions: { orderBy: { order: "asc" } } },
      take: 5,
    });

    for (let i = 0; i < Math.min(3, class9AQuizzes.length); i++) {
      const quiz = class9AQuizzes[i];
      if (!quiz || quiz.questions.length === 0) continue;
      const answers: Record<string, string> = {};
      let correctCount = 0;
      quiz.questions.forEach((q, qIdx) => {
        const opts: string[] = (() => {
          try {
            return JSON.parse(q.options || "[]");
          } catch {
            return [];
          }
        })();
        const isCorrect = (qIdx + i) % 5 !== 0;
        const chosen = isCorrect
          ? q.correctAnswer || opts[0] || ""
          : opts.find((o) => o !== q.correctAnswer) || opts[0] || "";
        answers[q.id] = chosen;
        if (chosen === q.correctAnswer) correctCount++;
      });
      const score = Math.round((correctCount / quiz.questions.length) * 100);
      const existingResult = await prisma.studentResult.findFirst({
        where: { studentId: demoStudent.id, quizId: quiz.id },
      });
      const submittedAt = new Date("2026-10-22T14:00:00.000Z");

      if (existingResult) {
        await prisma.studentResult.update({
          where: { id: existingResult.id },
          data: {
            status: "completed",
            answers: JSON.stringify(answers),
            score,
            correctAnswersCount: correctCount,
            totalQuestions: quiz.questions.length,
            timeTaken: 780 + i * 60,
            submittedAt,
            completedAt: submittedAt,
          },
        });
      } else {
        await prisma.studentResult.create({
          data: {
            studentId: demoStudent.id,
            quizId: quiz.id,
            status: "completed",
            answers: JSON.stringify(answers),
            score,
            correctAnswersCount: correctCount,
            totalQuestions: quiz.questions.length,
            timeTaken: 780 + i * 60,
            startedAt: new Date("2026-10-22T13:40:00.000Z"),
            submittedAt,
            completedAt: submittedAt,
          },
        });
      }
    }
  }

  // 4. demo-veli (linked to demo-ogrenci in 9-A and first student in 10-A)
  const parentMeta = DEMO_SHOWCASE_ACCOUNTS.find((a) => a.key === "demo-veli")!;
  const demoParent = await prisma.user.upsert({
    where: { email: parentMeta.email },
    update: {
      name: parentMeta.name,
      password: passwordHash,
      role: "parent",
      isActive: true,
      deactivatedAt: null,
      phoneNumber: "0533 400 50 60",
      address: "Cumhuriyet Mah. Atatürk Cad. No: 12",
    },
    create: {
      name: parentMeta.name,
      email: parentMeta.email,
      password: passwordHash,
      role: "parent",
      isActive: true,
      phoneNumber: "0533 400 50 60",
      address: "Cumhuriyet Mah. Atatürk Cad. No: 12",
    },
  });

  const linkedStudents = [
    { student: demoStudent, relation: "Anne" },
    ...(class10A?.students[0] ? [{ student: class10A.students[0], relation: "Anne" }] : []),
  ];

  for (const item of linkedStudents) {
    await prisma.guardianStudent.upsert({
      where: {
        guardianId_studentId: {
          guardianId: demoParent.id,
          studentId: item.student.id,
        },
      },
      update: {
        relation: item.relation,
      },
      create: {
        guardianId: demoParent.id,
        studentId: item.student.id,
        relation: item.relation,
      },
    });
  }

  return {
    demoAdmin,
    demoTeacher,
    demoStudent,
    demoParent,
  };
}

async function main() {
  if (!fs.existsSync(sourceDbPath)) {
    throw new Error(`Kaynak veritabanı bulunamadı: ${sourceDbPath}`);
  }

  const prisma = createRuntimePrismaClient({ databaseUrl: `file:${sourceDbPath}` });
  try {
    const seeded = await seedDemoShowcaseAccounts(prisma);
    console.log("Vitrin demo hesapları kaynak veritabanında hazırlandı:", {
      admin: seeded.demoAdmin.email,
      teacher: seeded.demoTeacher.email,
      student: seeded.demoStudent.email,
      parent: seeded.demoParent.email,
    });
  } finally {
    await prisma.$disconnect();
  }

  // Create clean standalone server/data/demo.db using SQLite VACUUM INTO
  for (const suffix of ["", "-wal", "-shm"]) {
    const candidate = `${targetDemoDbPath}${suffix}`;
    if (fs.existsSync(candidate)) {
      fs.unlinkSync(candidate);
    }
  }

  const rawDb = new Database(sourceDbPath);
  try {
    rawDb.pragma("wal_checkpoint(TRUNCATE)");
    const escapedTarget = targetDemoDbPath.replace(/'/g, "''");
    rawDb.exec(`VACUUM INTO '${escapedTarget}'`);
  } finally {
    rawDb.close();
  }

  // Ensure demo.db is in WAL mode and verify showcase users inside demo.db
  const demoDb = new Database(targetDemoDbPath);
  try {
    demoDb.pragma("journal_mode = WAL");
    const count = demoDb
      .prepare(
        "SELECT COUNT(*) as total FROM User WHERE email IN ('demo-admin@quizmaster.com','demo-ogretmen@quizmaster.com','demo-ogrenci@quizmaster.com','demo-veli@quizmaster.com')",
      )
      .get() as { total: number };
    console.log(`Bağımsız demo veritabanı oluşturuldu: ${targetDemoDbPath} (Vitrin hesap sayısı: ${count.total}/4)`);
  } finally {
    demoDb.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  main().catch((error) => {
    console.error("Demo veritabanı hazırlama hatası:", error);
    process.exit(1);
  });
}
