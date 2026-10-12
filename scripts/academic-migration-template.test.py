import hashlib
from contextlib import closing
import importlib.util
from pathlib import Path
import sqlite3
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('template', Path(__file__).with_name('academic-migration-template.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class TemplateTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.repo = Path(self.temp.name)
        migration = self.repo / 'server/prisma/migrations/20261010_test/migration.sql'
        migration.parent.mkdir(parents=True)
        migration.write_text('CREATE TABLE User(id TEXT PRIMARY KEY);', encoding='utf8')
        self.source = self.repo / 'server/data/quizmaster-test-source/test.db'
        self.target = self.repo / 'server/data/quizmaster-test-academic-target/server/data/academic.db'
        self.source.parent.mkdir(parents=True)
        self.target.parent.mkdir(parents=True)
        with closing(sqlite3.connect(self.source)) as db, db:
            db.executescript(migration.read_text())
            db.execute('CREATE TABLE _prisma_migrations(migration_name TEXT,checksum TEXT,finished_at TEXT,rolled_back_at TEXT)')
            db.execute('INSERT INTO _prisma_migrations VALUES (?,?,?,NULL)', ('20261010_test', hashlib.sha256(migration.read_bytes()).hexdigest(), 'complete'))

    def tearDown(self):
        self.temp.cleanup()

    def test_copies_exact_empty_schema_without_changing_source(self):
        before = self.source.read_bytes()
        self.assertEqual(module.copy_template(self.repo, self.source, self.target), 1)
        self.assertEqual(self.source.read_bytes(), before)
        with closing(sqlite3.connect(self.target)) as db:
            self.assertEqual(db.execute('SELECT count(*) FROM User').fetchone()[0], 0)

    def test_rejects_stale_migrations_before_creating_target(self):
        with closing(sqlite3.connect(self.source)) as db, db:
            db.execute("UPDATE _prisma_migrations SET checksum='stale'")
        with self.assertRaisesRegex(ValueError, 'checksum'):
            module.copy_template(self.repo, self.source, self.target)
        self.assertFalse(self.target.exists())

    def test_rejects_nonempty_template(self):
        with closing(sqlite3.connect(self.source)) as db, db:
            db.execute("INSERT INTO User VALUES ('synthetic')")
        with self.assertRaisesRegex(ValueError, 'business data'):
            module.copy_template(self.repo, self.source, self.target)
        self.assertFalse(self.target.exists())

    def test_rejects_nonfixture_paths_and_existing_target(self):
        with self.assertRaisesRegex(ValueError, 'Owned'):
            module.copy_template(self.repo, self.repo / 'server/data/quiz.db', self.target)
        self.target.write_bytes(b'protected')
        with self.assertRaisesRegex(ValueError, 'Owned'):
            module.copy_template(self.repo, self.source, self.target)
        self.assertEqual(self.target.read_bytes(), b'protected')


if __name__ == '__main__':
    unittest.main()
