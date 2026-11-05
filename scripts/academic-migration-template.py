"""Copy only a verified empty, already migrated disposable test database."""
import hashlib
from contextlib import closing
from pathlib import Path
import sqlite3
import sys


def copy_template(repo, source, target):
    repo, source, target = Path(repo).resolve(), Path(source), Path(target)
    if source.is_symlink() or source.parent.is_symlink():
        raise ValueError('Symlink template rejected')
    source, target = source.resolve(), target.resolve()
    data_root = repo / 'server/data'
    fixture = target.parents[2]
    if (source.parent.parent != data_root or source.name != 'test.db'
            or not source.parent.name.startswith('quizmaster-test-')
            or fixture.parent != data_root
            or not fixture.name.startswith('quizmaster-test-academic-')
            or target != fixture / 'server/data/academic.db' or target.exists()):
        raise ValueError('Owned empty template and fresh academic target required')
    migrations = repo / 'server/prisma/migrations'
    expected = [(p.parent.name, hashlib.sha256(p.read_bytes()).hexdigest())
                for p in sorted(migrations.glob('[0-9]*/migration.sql'))]
    if not expected:
        raise ValueError('Migration sources required')
    with closing(sqlite3.connect(source.as_uri() + '?mode=ro', uri=True, timeout=1)) as db:
        actual = db.execute('SELECT migration_name,checksum FROM _prisma_migrations '
                            'WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL '
                            'ORDER BY migration_name').fetchall()
        if actual != expected or db.execute('SELECT count(*) FROM _prisma_migrations').fetchone()[0] != len(expected):
            raise ValueError('Template migration checksum or status mismatch')
        if db.execute('PRAGMA integrity_check').fetchall() != [('ok',)] or db.execute('PRAGMA foreign_key_check').fetchall():
            raise ValueError('Template integrity failure')
        tables = db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name!='_prisma_migrations'").fetchall()
        for (name,) in tables:
            quoted = '"' + name.replace('"', '""') + '"'
            if db.execute('SELECT count(*) FROM ' + quoted).fetchone()[0]:
                raise ValueError('Template contains business data')
        with closing(sqlite3.connect(target)) as output:
            db.backup(output)
    return len(expected)


if __name__ == '__main__':
    count = copy_template(Path(__file__).resolve().parent.parent, sys.argv[1], sys.argv[2])
    print('Verified empty disposable migration template copied: ' + str(count) + ' migrations')
