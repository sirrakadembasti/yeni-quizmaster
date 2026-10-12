import {isolateTestDatabase} from './utils/test-database-isolation';
const template=process.env.QUIZMASTER_TEST_TEMPLATE;
if(!template)throw new Error('The migrated test template is required');
process.env.DATABASE_URL=isolateTestDatabase(template);
