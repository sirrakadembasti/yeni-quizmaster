-- Extend the annual freeze to every business write, including Prisma implicit joins.
-- Finalization permits are exact old/new values for a single entity, bound to the
-- verified snapshot and its live owner. The worker creates and consumes them in
-- the SAME transaction; no public API creates permits and no global bypass exists.
-- SQLite schema-owner arbitrary SQL (including forging privileged permits or
-- dropping triggers) is outside the supported application's authority boundary.
-- Secrets are never stored in permit payloads; operational User columns stay usable.
CREATE TABLE ArchiveFinalizationPermit (
  snapshotId TEXT NOT NULL REFERENCES ArchiveSnapshot(id) ON DELETE RESTRICT,
  owner TEXT NOT NULL,
  entityType TEXT NOT NULL CHECK(entityType IN ('user','quiz','result','academicYear','snapshot')),
  entityId TEXT NOT NULL,
  oldValues TEXT NOT NULL CHECK(json_valid(oldValues)),
  newValues TEXT NOT NULL CHECK(json_valid(newValues)),
  PRIMARY KEY(snapshotId,entityType,entityId)
);
CREATE INDEX ArchiveFinalizationPermit_entity ON ArchiveFinalizationPermit(entityType,entityId);
-- Operational status retries cannot reopen an already captured snapshot's input.
DROP TRIGGER archive_snapshot_row_insert;
CREATE TRIGGER archive_snapshot_row_insert BEFORE INSERT ON ArchiveSnapshotRow
WHEN NOT EXISTS(SELECT 1 FROM ArchiveSnapshot WHERE id=NEW.snapshotId AND capturedAt IS NULL AND status IN ('queued','capturing'))
BEGIN SELECT RAISE(ABORT,'ARCHIVE_READ_ONLY'); END;
CREATE TRIGGER archive_permit_admission BEFORE INSERT ON "ArchiveFinalizationPermit"
WHEN NOT EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.id=NEW.snapshotId AND s.leaseOwner=NEW.owner AND s.leaseOwner IS NOT NULL AND s.leaseExpiresAt>CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) AND s.status='verified' AND s.capturedAt IS NOT NULL AND s.artifactPath IS NOT NULL AND length(s.zipSha256)=64 AND s.sizeBytes>0 AND (y.status='active' OR (NEW.entityType='snapshot' AND s.mode='annual' AND y.status='closed' AND y.snapshotId=s.id)) AND ((NEW.entityType IN ('quiz','result') AND EXISTS(SELECT 1 FROM ArchiveSnapshotRow r WHERE r.snapshotId=s.id AND r.entityType=NEW.entityType AND r.entityId=NEW.entityId)) OR (NEW.entityType='user' AND s.mode='annual' AND EXISTS(SELECT 1 FROM ArchiveSnapshotRow r WHERE r.snapshotId=s.id AND r.entityType='user' AND r.entityId=NEW.entityId AND json_extract(r.dataJson,'$.role')='student')) OR (NEW.entityType='academicYear' AND s.mode='annual' AND NEW.entityId=s.academicYearId) OR (NEW.entityType='snapshot' AND NEW.entityId=s.id)))
BEGIN SELECT RAISE(ABORT,'ARCHIVE_FINALIZATION_NOT_ALLOWED'); END;
CREATE TRIGGER archive_permit_immutable BEFORE UPDATE ON ArchiveFinalizationPermit BEGIN SELECT RAISE(ABORT,'ARCHIVE_FINALIZATION_NOT_ALLOWED'); END;
CREATE TRIGGER archive_consume_user_permit AFTER UPDATE ON "User" BEGIN DELETE FROM ArchiveFinalizationPermit WHERE entityType='user' AND entityId=OLD.id; END;
CREATE TRIGGER archive_consume_quiz_permit AFTER UPDATE ON "Quiz" BEGIN DELETE FROM ArchiveFinalizationPermit WHERE entityType='quiz' AND entityId=OLD.id; END;
CREATE TRIGGER archive_consume_result_permit AFTER UPDATE ON "StudentResult" BEGIN DELETE FROM ArchiveFinalizationPermit WHERE entityType='result' AND entityId=OLD.id; END;
CREATE TRIGGER archive_consume_academicYear_permit AFTER UPDATE ON "AcademicYear" BEGIN DELETE FROM ArchiveFinalizationPermit WHERE entityType='academicYear' AND entityId=OLD.id; END;
CREATE TRIGGER archive_consume_snapshot_permit AFTER UPDATE ON "ArchiveSnapshot" BEGIN DELETE FROM ArchiveFinalizationPermit WHERE entityType='snapshot' AND entityId=OLD.id; END;
CREATE TRIGGER annual_user_update BEFORE UPDATE ON "User"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active') AND NOT(NEW."id" IS OLD."id" AND NEW."name" IS OLD."name" AND NEW."email" IS OLD."email" AND NEW."role" IS OLD."role" AND NEW."phoneNumber" IS OLD."phoneNumber" AND NEW."address" IS OLD."address" AND NEW."studentNo" IS OLD."studentNo" AND NEW."classNo" IS OLD."classNo" AND NEW."isActive" IS OLD."isActive" AND NEW."deactivatedAt" IS OLD."deactivatedAt" AND NEW."graduationYear" IS OLD."graduationYear" AND NEW."graduationDate" IS OLD."graduationDate" AND NEW."parentName" IS OLD."parentName" AND NEW."parentRelation" IS OLD."parentRelation" AND NEW."parentPhone" IS OLD."parentPhone" AND NEW."parentEmail" IS OLD."parentEmail" AND NEW."parentAddress" IS OLD."parentAddress" AND NEW."createdAt" IS OLD."createdAt" AND NEW."classId" IS OLD."classId") AND NOT(EXISTS(SELECT 1 FROM ArchiveFinalizationPermit p JOIN ArchiveSnapshot s ON s.id=p.snapshotId JOIN AcademicYear y ON y.id=s.academicYearId WHERE p.entityType='user' AND p.entityId=OLD.id AND p.owner=s.leaseOwner AND s.status='verified' AND s.capturedAt IS NOT NULL AND s.artifactPath IS NOT NULL AND length(s.zipSha256)=64 AND s.sizeBytes>0 AND s.leaseExpiresAt>CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) AND (y.status='active') AND p.oldValues=json_object('classId',OLD."classId",'classNo',OLD."classNo",'studentNo',OLD."studentNo",'isActive',OLD."isActive",'deactivatedAt',OLD."deactivatedAt",'graduationYear',OLD."graduationYear",'graduationDate',OLD."graduationDate") AND p.newValues=json_object('classId',NEW."classId",'classNo',NEW."classNo",'studentNo',NEW."studentNo",'isActive',NEW."isActive",'deactivatedAt',NEW."deactivatedAt",'graduationYear',NEW."graduationYear",'graduationDate',NEW."graduationDate")) AND NEW."id" IS OLD."id" AND NEW."name" IS OLD."name" AND NEW."email" IS OLD."email" AND NEW."role" IS OLD."role" AND NEW."phoneNumber" IS OLD."phoneNumber" AND NEW."address" IS OLD."address" AND NEW."parentName" IS OLD."parentName" AND NEW."parentRelation" IS OLD."parentRelation" AND NEW."parentPhone" IS OLD."parentPhone" AND NEW."parentEmail" IS OLD."parentEmail" AND NEW."parentAddress" IS OLD."parentAddress" AND NEW."createdAt" IS OLD."createdAt" AND NEW."password" IS OLD."password" AND NEW."sessionVersion" IS OLD."sessionVersion" AND NEW."resetToken" IS OLD."resetToken" AND NEW."resetTokenExpiry" IS OLD."resetTokenExpiry" AND NEW."emailVerified" IS OLD."emailVerified" AND NEW."emailVerificationToken" IS OLD."emailVerificationToken" AND NEW."notificationMuted" IS OLD."notificationMuted")
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
CREATE TRIGGER annual_user_delete BEFORE DELETE ON "User"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active')
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
CREATE TRIGGER annual_class_update BEFORE UPDATE ON "Class"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active')
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
CREATE TRIGGER annual_class_delete BEFORE DELETE ON "Class"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active')
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
CREATE TRIGGER annual_category_update BEFORE UPDATE ON "Category"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active')
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
CREATE TRIGGER annual_category_delete BEFORE DELETE ON "Category"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active')
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
CREATE TRIGGER annual_classteachercourse_update BEFORE UPDATE ON "ClassTeacherCourse"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active')
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
CREATE TRIGGER annual_classteachercourse_delete BEFORE DELETE ON "ClassTeacherCourse"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active')
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
CREATE TRIGGER annual_guardianstudent_update BEFORE UPDATE ON "GuardianStudent"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active')
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
CREATE TRIGGER annual_guardianstudent_delete BEFORE DELETE ON "GuardianStudent"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active')
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
CREATE TRIGGER annual_announcement_update BEFORE UPDATE ON "Announcement"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active')
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
CREATE TRIGGER annual_announcement_delete BEFORE DELETE ON "Announcement"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active')
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
CREATE TRIGGER annual_questionbank_update BEFORE UPDATE ON "QuestionBank"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active')
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
CREATE TRIGGER annual_questionbank_delete BEFORE DELETE ON "QuestionBank"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active')
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
CREATE TRIGGER annual_quiz_update BEFORE UPDATE ON "Quiz"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active') AND NOT(EXISTS(SELECT 1 FROM ArchiveFinalizationPermit p JOIN ArchiveSnapshot s ON s.id=p.snapshotId JOIN AcademicYear y ON y.id=s.academicYearId WHERE p.entityType='quiz' AND p.entityId=OLD.id AND p.owner=s.leaseOwner AND s.status='verified' AND s.capturedAt IS NOT NULL AND s.artifactPath IS NOT NULL AND length(s.zipSha256)=64 AND s.sizeBytes>0 AND s.leaseExpiresAt>CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) AND (y.status='active') AND p.oldValues=json_object('status',OLD."status",'academicYear',OLD."academicYear") AND p.newValues=json_object('status',NEW."status",'academicYear',NEW."academicYear")) AND NEW."id" IS OLD."id" AND NEW."title" IS OLD."title" AND NEW."description" IS OLD."description" AND NEW."difficulty" IS OLD."difficulty" AND NEW."timeLimit" IS OLD."timeLimit" AND NEW."shuffleQuestions" IS OLD."shuffleQuestions" AND NEW."contentType" IS OLD."contentType" AND NEW."publishedAt" IS OLD."publishedAt" AND NEW."audienceSize" IS OLD."audienceSize" AND NEW."createdAt" IS OLD."createdAt" AND NEW."categoryId" IS OLD."categoryId" AND NEW."createdBy" IS OLD."createdBy")
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
CREATE TRIGGER annual_quiz_delete BEFORE DELETE ON "Quiz"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active')
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
CREATE TRIGGER annual_question_insert BEFORE INSERT ON "Question"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active')
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
CREATE TRIGGER annual_question_update BEFORE UPDATE ON "Question"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active')
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
CREATE TRIGGER annual_question_delete BEFORE DELETE ON "Question"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active')
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
CREATE TRIGGER annual_studentresult_insert BEFORE INSERT ON "StudentResult"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active')
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
CREATE TRIGGER annual_studentresult_update BEFORE UPDATE ON "StudentResult"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active') AND NOT(EXISTS(SELECT 1 FROM ArchiveFinalizationPermit p JOIN ArchiveSnapshot s ON s.id=p.snapshotId JOIN AcademicYear y ON y.id=s.academicYearId WHERE p.entityType='result' AND p.entityId=OLD.id AND p.owner=s.leaseOwner AND s.status='verified' AND s.capturedAt IS NOT NULL AND s.artifactPath IS NOT NULL AND length(s.zipSha256)=64 AND s.sizeBytes>0 AND s.leaseExpiresAt>CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) AND (y.status='active') AND p.oldValues=json_object('academicYear',OLD."academicYear") AND p.newValues=json_object('academicYear',NEW."academicYear")) AND NEW."id" IS OLD."id" AND NEW."studentId" IS OLD."studentId" AND NEW."quizId" IS OLD."quizId" AND NEW."status" IS OLD."status" AND NEW."answers" IS OLD."answers" AND NEW."score" IS OLD."score" AND NEW."correctAnswersCount" IS OLD."correctAnswersCount" AND NEW."totalQuestions" IS OLD."totalQuestions" AND NEW."timeTaken" IS OLD."timeTaken" AND NEW."startedAt" IS OLD."startedAt" AND NEW."submittedAt" IS OLD."submittedAt" AND NEW."completedAt" IS OLD."completedAt")
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
CREATE TRIGGER annual_studentresult_delete BEFORE DELETE ON "StudentResult"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active')
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
CREATE TRIGGER annual_surveysubmission_insert BEFORE INSERT ON "SurveySubmission"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active')
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
CREATE TRIGGER annual_surveysubmission_update BEFORE UPDATE ON "SurveySubmission"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active')
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
CREATE TRIGGER annual_surveysubmission_delete BEFORE DELETE ON "SurveySubmission"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active')
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
CREATE TRIGGER annual_surveyanswer_insert BEFORE INSERT ON "SurveyAnswer"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active')
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
CREATE TRIGGER annual_surveyanswer_update BEFORE UPDATE ON "SurveyAnswer"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active')
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
CREATE TRIGGER annual_surveyanswer_delete BEFORE DELETE ON "SurveyAnswer"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active')
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
CREATE TRIGGER annual_join_classteachers_insert BEFORE INSERT ON "_ClassTeachers"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active')
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
CREATE TRIGGER annual_join_classteachers_update BEFORE UPDATE ON "_ClassTeachers"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active')
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
CREATE TRIGGER annual_join_classteachers_delete BEFORE DELETE ON "_ClassTeachers"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active')
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
CREATE TRIGGER annual_join_teachercategories_insert BEFORE INSERT ON "_TeacherCategories"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active')
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
CREATE TRIGGER annual_join_teachercategories_update BEFORE UPDATE ON "_TeacherCategories"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active')
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
CREATE TRIGGER annual_join_teachercategories_delete BEFORE DELETE ON "_TeacherCategories"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active')
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
CREATE TRIGGER annual_join_classcategories_insert BEFORE INSERT ON "_ClassCategories"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active')
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
CREATE TRIGGER annual_join_classcategories_update BEFORE UPDATE ON "_ClassCategories"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active')
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
CREATE TRIGGER annual_join_classcategories_delete BEFORE DELETE ON "_ClassCategories"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active')
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
CREATE TRIGGER annual_join_classquizzes_insert BEFORE INSERT ON "_ClassQuizzes"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active')
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
CREATE TRIGGER annual_join_classquizzes_update BEFORE UPDATE ON "_ClassQuizzes"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active')
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
CREATE TRIGGER annual_join_classquizzes_delete BEFORE DELETE ON "_ClassQuizzes"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active')
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
DROP TRIGGER archive_quiz_update;
DROP TRIGGER archive_quiz_transition;
DROP TRIGGER archive_result_update;
DROP TRIGGER archive_result_stamp;
CREATE TRIGGER archive_quiz_update BEFORE UPDATE ON "Quiz"
WHEN OLD.status='archived' OR (EXISTS(SELECT 1 FROM ArchiveSnapshotRow WHERE entityType='quiz' AND entityId=OLD.id) AND NOT(OLD.status<>'archived' AND NEW.status='archived' AND NEW.academicYear=(SELECT s.label FROM ArchiveFinalizationPermit p JOIN ArchiveSnapshot s ON s.id=p.snapshotId WHERE p.entityType='quiz' AND p.entityId=OLD.id) AND EXISTS(SELECT 1 FROM ArchiveFinalizationPermit p JOIN ArchiveSnapshot s ON s.id=p.snapshotId JOIN AcademicYear y ON y.id=s.academicYearId WHERE p.entityType='quiz' AND p.entityId=OLD.id AND p.owner=s.leaseOwner AND s.status='verified' AND s.capturedAt IS NOT NULL AND s.artifactPath IS NOT NULL AND length(s.zipSha256)=64 AND s.sizeBytes>0 AND s.leaseExpiresAt>CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) AND (y.status='active') AND p.oldValues=json_object('status',OLD."status",'academicYear',OLD."academicYear") AND p.newValues=json_object('status',NEW."status",'academicYear',NEW."academicYear")) AND NEW."id" IS OLD."id" AND NEW."title" IS OLD."title" AND NEW."description" IS OLD."description" AND NEW."difficulty" IS OLD."difficulty" AND NEW."timeLimit" IS OLD."timeLimit" AND NEW."shuffleQuestions" IS OLD."shuffleQuestions" AND NEW."contentType" IS OLD."contentType" AND NEW."publishedAt" IS OLD."publishedAt" AND NEW."audienceSize" IS OLD."audienceSize" AND NEW."createdAt" IS OLD."createdAt" AND NEW."categoryId" IS OLD."categoryId" AND NEW."createdBy" IS OLD."createdBy"))
BEGIN SELECT RAISE(ABORT,'ARCHIVE_READ_ONLY'); END;
CREATE TRIGGER archive_quiz_transition BEFORE UPDATE ON "Quiz"
WHEN NEW.status='archived' AND EXISTS(SELECT 1 FROM ArchiveSnapshotRow WHERE entityType='quiz' AND entityId=OLD.id) AND NOT(EXISTS(SELECT 1 FROM ArchiveFinalizationPermit p JOIN ArchiveSnapshot s ON s.id=p.snapshotId JOIN AcademicYear y ON y.id=s.academicYearId WHERE p.entityType='quiz' AND p.entityId=OLD.id AND p.owner=s.leaseOwner AND s.status='verified' AND s.capturedAt IS NOT NULL AND s.artifactPath IS NOT NULL AND length(s.zipSha256)=64 AND s.sizeBytes>0 AND s.leaseExpiresAt>CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) AND (y.status='active') AND p.oldValues=json_object('status',OLD."status",'academicYear',OLD."academicYear") AND p.newValues=json_object('status',NEW."status",'academicYear',NEW."academicYear")) AND NEW."id" IS OLD."id" AND NEW."title" IS OLD."title" AND NEW."description" IS OLD."description" AND NEW."difficulty" IS OLD."difficulty" AND NEW."timeLimit" IS OLD."timeLimit" AND NEW."shuffleQuestions" IS OLD."shuffleQuestions" AND NEW."contentType" IS OLD."contentType" AND NEW."publishedAt" IS OLD."publishedAt" AND NEW."audienceSize" IS OLD."audienceSize" AND NEW."createdAt" IS OLD."createdAt" AND NEW."categoryId" IS OLD."categoryId" AND NEW."createdBy" IS OLD."createdBy")
BEGIN SELECT RAISE(ABORT,'ARCHIVE_READ_ONLY'); END;
CREATE TRIGGER archive_result_update BEFORE UPDATE ON "StudentResult"
WHEN (OLD.academicYear IS NOT NULL OR EXISTS(SELECT 1 FROM Quiz WHERE id=OLD.quizId AND status='archived') OR EXISTS(SELECT 1 FROM ArchiveSnapshotRow WHERE (entityType='result' AND entityId=OLD.id) OR (entityType='quiz' AND entityId=OLD.quizId))) AND NOT(OLD.academicYear IS NULL AND NEW.academicYear=(SELECT s.label FROM ArchiveFinalizationPermit p JOIN ArchiveSnapshot s ON s.id=p.snapshotId WHERE p.entityType='result' AND p.entityId=OLD.id) AND EXISTS(SELECT 1 FROM ArchiveFinalizationPermit p JOIN ArchiveSnapshot s ON s.id=p.snapshotId JOIN AcademicYear y ON y.id=s.academicYearId WHERE p.entityType='result' AND p.entityId=OLD.id AND p.owner=s.leaseOwner AND s.status='verified' AND s.capturedAt IS NOT NULL AND s.artifactPath IS NOT NULL AND length(s.zipSha256)=64 AND s.sizeBytes>0 AND s.leaseExpiresAt>CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) AND (y.status='active') AND p.oldValues=json_object('academicYear',OLD."academicYear") AND p.newValues=json_object('academicYear',NEW."academicYear")) AND NEW."id" IS OLD."id" AND NEW."studentId" IS OLD."studentId" AND NEW."quizId" IS OLD."quizId" AND NEW."status" IS OLD."status" AND NEW."answers" IS OLD."answers" AND NEW."score" IS OLD."score" AND NEW."correctAnswersCount" IS OLD."correctAnswersCount" AND NEW."totalQuestions" IS OLD."totalQuestions" AND NEW."timeTaken" IS OLD."timeTaken" AND NEW."startedAt" IS OLD."startedAt" AND NEW."submittedAt" IS OLD."submittedAt" AND NEW."completedAt" IS OLD."completedAt")
BEGIN SELECT RAISE(ABORT,'ARCHIVE_READ_ONLY'); END;
CREATE TRIGGER archive_result_stamp BEFORE UPDATE ON "StudentResult"
WHEN OLD.academicYear IS NULL AND NEW.academicYear IS NOT NULL AND (EXISTS(SELECT 1 FROM Quiz WHERE id=OLD.quizId AND status='archived') OR EXISTS(SELECT 1 FROM ArchiveSnapshotRow WHERE (entityType='result' AND entityId=OLD.id) OR (entityType='quiz' AND entityId=OLD.quizId))) AND NOT(EXISTS(SELECT 1 FROM ArchiveFinalizationPermit p JOIN ArchiveSnapshot s ON s.id=p.snapshotId JOIN AcademicYear y ON y.id=s.academicYearId WHERE p.entityType='result' AND p.entityId=OLD.id AND p.owner=s.leaseOwner AND s.status='verified' AND s.capturedAt IS NOT NULL AND s.artifactPath IS NOT NULL AND length(s.zipSha256)=64 AND s.sizeBytes>0 AND s.leaseExpiresAt>CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) AND (y.status='active') AND p.oldValues=json_object('academicYear',OLD."academicYear") AND p.newValues=json_object('academicYear',NEW."academicYear")) AND NEW."id" IS OLD."id" AND NEW."studentId" IS OLD."studentId" AND NEW."quizId" IS OLD."quizId" AND NEW."status" IS OLD."status" AND NEW."answers" IS OLD."answers" AND NEW."score" IS OLD."score" AND NEW."correctAnswersCount" IS OLD."correctAnswersCount" AND NEW."totalQuestions" IS OLD."totalQuestions" AND NEW."timeTaken" IS OLD."timeTaken" AND NEW."startedAt" IS OLD."startedAt" AND NEW."submittedAt" IS OLD."submittedAt" AND NEW."completedAt" IS OLD."completedAt")
BEGIN SELECT RAISE(ABORT,'ARCHIVE_READ_ONLY'); END;
CREATE TRIGGER annual_year_update BEFORE UPDATE ON "AcademicYear"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active') AND NOT(OLD.status='active' AND NEW.status='closed' AND NEW.closedAt IS NOT NULL AND NEW.snapshotId=(SELECT snapshotId FROM ArchiveFinalizationPermit WHERE entityType='academicYear' AND entityId=OLD.id) AND EXISTS(SELECT 1 FROM ArchiveFinalizationPermit p JOIN ArchiveSnapshot s ON s.id=p.snapshotId JOIN AcademicYear y ON y.id=s.academicYearId WHERE p.entityType='academicYear' AND p.entityId=OLD.id AND p.owner=s.leaseOwner AND s.status='verified' AND s.capturedAt IS NOT NULL AND s.artifactPath IS NOT NULL AND length(s.zipSha256)=64 AND s.sizeBytes>0 AND s.leaseExpiresAt>CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) AND (y.status='active') AND p.oldValues=json_object('status',OLD."status",'closedAt',OLD."closedAt",'snapshotId',OLD."snapshotId") AND p.newValues=json_object('status',NEW."status",'closedAt',NEW."closedAt",'snapshotId',NEW."snapshotId")) AND NEW."id" IS OLD."id" AND NEW."label" IS OLD."label" AND NEW."opensAt" IS OLD."opensAt" AND NEW."scheduledCloseAt" IS OLD."scheduledCloseAt")
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
CREATE TRIGGER annual_year_delete BEFORE DELETE ON "AcademicYear"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active')
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
CREATE TRIGGER annual_year_insert BEFORE INSERT ON "AcademicYear"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active')
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
CREATE TRIGGER archive_captured_snapshot_identity BEFORE UPDATE ON "ArchiveSnapshot"
WHEN OLD.capturedAt IS NOT NULL AND NOT(NEW."id" IS OLD."id" AND NEW."academicYearId" IS OLD."academicYearId" AND NEW."label" IS OLD."label" AND NEW."mode" IS OLD."mode" AND NEW."annualKey" IS OLD."annualKey" AND NEW."initiatedBy" IS OLD."initiatedBy" AND NEW."scopeJson" IS OLD."scopeJson" AND NEW."createdAt" IS OLD."createdAt" AND NEW."capturedAt" IS OLD."capturedAt")
BEGIN SELECT RAISE(ABORT,'ARCHIVE_READ_ONLY'); END;
CREATE TRIGGER archive_captured_snapshot_delete BEFORE DELETE ON "ArchiveSnapshot"
WHEN OLD.capturedAt IS NOT NULL
BEGIN SELECT RAISE(ABORT,'ARCHIVE_READ_ONLY'); END;
CREATE TRIGGER archive_captured_snapshot_complete BEFORE UPDATE ON "ArchiveSnapshot"
WHEN OLD.capturedAt IS NOT NULL AND NEW.status='completed' AND NOT(NEW.completedAt IS NOT NULL AND NEW.leaseOwner IS NULL AND NEW.leaseExpiresAt IS NULL AND EXISTS(SELECT 1 FROM ArchiveFinalizationPermit p JOIN ArchiveSnapshot s ON s.id=p.snapshotId JOIN AcademicYear y ON y.id=s.academicYearId WHERE p.entityType='snapshot' AND p.entityId=OLD.id AND p.owner=s.leaseOwner AND s.status='verified' AND s.capturedAt IS NOT NULL AND s.artifactPath IS NOT NULL AND length(s.zipSha256)=64 AND s.sizeBytes>0 AND s.leaseExpiresAt>CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) AND (y.status='active' OR (s.mode='annual' AND y.status='closed' AND y.snapshotId=s.id)) AND p.oldValues=json_object('status',OLD."status",'completedAt',OLD."completedAt",'leaseOwner',OLD."leaseOwner",'leaseExpiresAt',OLD."leaseExpiresAt",'lastError',OLD."lastError",'nextAttemptAt',OLD."nextAttemptAt") AND p.newValues=json_object('status',NEW."status",'completedAt',NEW."completedAt",'leaseOwner',NEW."leaseOwner",'leaseExpiresAt',NEW."leaseExpiresAt",'lastError',NEW."lastError",'nextAttemptAt',NEW."nextAttemptAt")) AND NEW."id" IS OLD."id" AND NEW."academicYearId" IS OLD."academicYearId" AND NEW."label" IS OLD."label" AND NEW."mode" IS OLD."mode" AND NEW."annualKey" IS OLD."annualKey" AND NEW."initiatedBy" IS OLD."initiatedBy" AND NEW."scopeJson" IS OLD."scopeJson" AND NEW."attempts" IS OLD."attempts" AND NEW."artifactPath" IS OLD."artifactPath" AND NEW."zipSha256" IS OLD."zipSha256" AND NEW."sizeBytes" IS OLD."sizeBytes" AND NEW."createdAt" IS OLD."createdAt" AND NEW."capturedAt" IS OLD."capturedAt")
BEGIN SELECT RAISE(ABORT,'ARCHIVE_READ_ONLY'); END;
CREATE TRIGGER annual_transition_rule_insert BEFORE INSERT ON "AcademicTransitionRule"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.academicYearId IN (NEW.yearId) AND s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active' AND (s.status NOT IN ('queued','retry_wait','failed') OR s.leaseExpiresAt>CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)))
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
CREATE TRIGGER annual_transition_rule_update BEFORE UPDATE ON "AcademicTransitionRule"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.academicYearId IN (OLD.yearId,NEW.yearId) AND s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active' AND (s.status NOT IN ('queued','retry_wait','failed') OR s.leaseExpiresAt>CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)))
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
CREATE TRIGGER annual_transition_rule_delete BEFORE DELETE ON "AcademicTransitionRule"
WHEN EXISTS(SELECT 1 FROM ArchiveSnapshot s JOIN AcademicYear y ON y.id=s.academicYearId WHERE s.academicYearId IN (OLD.yearId) AND s.mode='annual' AND s.capturedAt IS NOT NULL AND s.status<>'completed' AND y.status='active' AND (s.status NOT IN ('queued','retry_wait','failed') OR s.leaseExpiresAt>CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)))
BEGIN SELECT RAISE(ABORT,'ANNUAL_CAPTURE_FROZEN'); END;
