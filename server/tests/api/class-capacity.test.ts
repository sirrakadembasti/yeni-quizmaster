import { afterAll, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { storage, closeStorage } from '../../storage';

const db = new PrismaClient();
const account = (name: string, data: any = {}) => storage.createUser({name,email:`${randomUUID()}@example.test`,password:'isolated-capacity-fixture',role:'student',...data});
const classroom = (capacity: number | null) => storage.createClass({name:`Capacity ${randomUUID()}`,maxStudents:capacity});
afterAll(async () => {await db.$disconnect(); await closeStorage();});

it('rejects creation and transfer into a full class without partial user updates', async () => {
 const target = await classroom(1); const source = await classroom(null);
 await account('Occupant',{classId:target.id}); const student = await account('Transfer',{classId:source.id});
 await expect(account('Overflow',{classId:target.id})).rejects.toThrow('CLASS_CAPACITY_EXCEEDED');
 expect(await db.user.count({where:{name:'Overflow'}})).toBe(0);
 await expect(storage.updateUser(student.id,{classId:target.id,name:'Changed name'})).rejects.toThrow('CLASS_CAPACITY_EXCEEDED');
 expect(await db.user.findUnique({where:{id:student.id}})).toMatchObject({name:'Transfer',classId:source.id,studentNo:1});
 await expect(storage.assignStudentToClass(student.id,target.id)).rejects.toThrow('CLASS_CAPACITY_EXCEEDED');
});

it('counts active students only and checks reactivation', async () => {
 const target = await classroom(1);
 const inactive = await account('Inactive',{classId:target.id,isActive:false});
 expect(inactive.isActive).toBe(false);
 const active = await account('Active',{classId:target.id});
 await expect(storage.updateUser(inactive.id,{isActive:true})).rejects.toThrow('CLASS_CAPACITY_EXCEEDED');
 expect((await db.user.findUnique({where:{id:inactive.id}}))?.isActive).toBe(false);
 await storage.deactivateStudent(active.id);
 await storage.updateUser(inactive.id,{isActive:true,deactivatedAt:null});
 expect((await db.user.findUnique({where:{id:inactive.id}}))?.isActive).toBe(true);
});

it('checks conversion into a student before removing existing teacher relationships', async () => {
 const target = await classroom(1); await account('Occupant',{classId:target.id});
 const teacher = await account('Teacher',{role:'teacher'});
 const managed = await storage.createClass({name:`Managed ${randomUUID()}`,classTeacherId:teacher.id});
 await expect(storage.updateUser(teacher.id,{role:'student',classId:target.id})).rejects.toThrow('CLASS_CAPACITY_EXCEEDED');
 expect(await db.user.findUnique({where:{id:teacher.id}})).toMatchObject({role:'teacher',classId:null,sessionVersion:0});
 expect((await db.class.findUnique({where:{id:managed.id}}))?.classTeacherId).toBe(teacher.id);
});

it('allows metadata edits and same-class assignment for existing students in a legacy overfull class', async () => {
 const target = await classroom(1); const student = await account('Existing',{classId:target.id});
 await db.user.create({data:{name:'Legacy overflow',email:`${randomUUID()}@example.test`,password:'fixture',role:'student',classId:target.id,studentNo:2}});
 await storage.updateUser(student.id,{name:'Metadata changed',classId:target.id});
 await storage.assignStudentToClass(student.id,target.id);
 expect(await db.user.findUnique({where:{id:student.id}})).toMatchObject({name:'Metadata changed',classId:target.id,studentNo:1});
});

it('rejects shrinking below active enrollment and allows null unlimited capacity', async () => {
 const target = await classroom(null); await account('One',{classId:target.id}); await account('Two',{classId:target.id});
 await expect(storage.updateClass(target.id,{name:'Should roll back',maxStudents:1})).rejects.toThrow('CLASS_CAPACITY_EXCEEDED');
 expect(await db.class.findUnique({where:{id:target.id}})).toMatchObject({name:target.name,maxStudents:null});
 await storage.updateClass(target.id,{maxStudents:2}); await storage.updateClass(target.id,{maxStudents:null});
 await account('Three',{classId:target.id}); expect(await storage.getStudentsByClass(target.id)).toHaveLength(3);
});

it('checks bulk promotion capacity before moving students or stamping results', async () => {
 const source = await classroom(null); const target = await classroom(2);
 const creator = await account('Creator',{role:'admin'}); const quiz = await db.quiz.create({data:{title:'Promotion quiz',createdBy:creator.id}});
 const first = await account('First',{classId:source.id}); await account('Second',{classId:source.id}); await account('Occupant',{classId:target.id});
 const result = await db.studentResult.create({data:{quizId:quiz.id,studentId:first.id,status:'completed',score:50}});
 await expect(storage.promoteStudents(source.id,target.id,'2031-2032')).rejects.toThrow('CLASS_CAPACITY_EXCEEDED');
 expect(await storage.getStudentsByClass(source.id)).toHaveLength(2);
 expect((await db.studentResult.findUnique({where:{id:result.id}}))?.academicYear).toBeNull();
 await storage.updateClass(target.id,{maxStudents:3}); expect(await storage.promoteStudents(source.id,target.id)).toBe(2);
 expect(await storage.getStudentsByClass(target.id)).toHaveLength(3);
});

it('bulk promotion does not count inactive students as occupied seats', async () => {
 const source = await classroom(null); const target = await classroom(1);
 await account('Active promotion',{classId:source.id}); await account('Inactive promotion',{classId:source.id,isActive:false});
 expect(await storage.promoteStudents(source.id,target.id)).toBe(2);
 expect(await storage.getStudentsByClass(target.id)).toHaveLength(1);
});

it('inactive-only promotion adds no seats even when the target is already overfull', async () => {
 const source = await classroom(null); const target = await classroom(1);
 await account('Active target',{classId:target.id});
 await db.user.create({data:{name:'Legacy extra',email:`${randomUUID()}@example.test`,password:'fixture',role:'student',classId:target.id,studentNo:2}});
 const inactive = await account('Inactive-only move',{classId:source.id,isActive:false});
 expect(await storage.promoteStudents(source.id,target.id)).toBe(1);
 expect((await db.user.findUnique({where:{id:inactive.id}}))?.classId).toBe(target.id);
 expect(await storage.getStudentsByClass(target.id)).toHaveLength(2);
});

it('concurrent creation for the last seat admits exactly one student', async () => {
 const target = await classroom(1);
 const results = await Promise.allSettled([account('Race A',{classId:target.id}),account('Race B',{classId:target.id})]);
 expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
 expect(results.filter(result => result.status === 'rejected').map(result => (result as PromiseRejectedResult).reason.message)).toEqual(['CLASS_CAPACITY_EXCEEDED']);
 expect(await storage.getStudentsByClass(target.id)).toHaveLength(1);
});

it('rejects invalid capacities and nonexistent classes with stable errors', async () => {
 await expect(classroom(-1)).rejects.toThrow('INVALID_CLASS_CAPACITY');
 await expect(account('Missing class',{classId:randomUUID()})).rejects.toThrow('CLASS_NOT_FOUND');
 const target = await classroom(1); await expect(storage.updateClass(target.id,{maxStudents:1.5})).rejects.toThrow('INVALID_CLASS_CAPACITY');
});

it('direct assignment rejects nonstudents without creating enrollment', async () => {
 const teacher = await account('Assignment teacher',{role:'teacher'}); const target = await classroom(1);
 await expect(storage.assignStudentToClass(teacher.id,target.id)).rejects.toThrow('INVALID_STUDENT');
 expect((await db.user.findUnique({where:{id:teacher.id}}))?.classId).toBeNull();
});

it('class creation rejects a nonteacher without writing the class', async () => {
 const parent = await account('Not a teacher',{role:'parent'}); const name = `Bad teacher ${randomUUID()}`;
 await expect(storage.createClass({name,classTeacherId:parent.id})).rejects.toThrow('INVALID_CLASS_TEACHER');
 expect(await db.class.count({where:{name}})).toBe(0);
});

it('canonical teacher null takes precedence over the legacy teacherId alias', async () => {
 const teacher = await account('Alias teacher',{role:'teacher'});
 const cleared = await storage.createClass({name:`Canonical null ${randomUUID()}`,classTeacherId:null,teacherId:teacher.id});
 expect(cleared.classTeacherId).toBeNull();
 const legacy = await storage.createClass({name:`Legacy teacher ${randomUUID()}`,teacherId:teacher.id});
 expect(legacy.classTeacherId).toBe(teacher.id);
});
