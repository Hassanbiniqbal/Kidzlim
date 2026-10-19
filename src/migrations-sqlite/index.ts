import * as migration_20261016_131644_sqlite_initial from './20261016_131644_sqlite_initial';

export const migrations = [
  {
    up: migration_20261016_131644_sqlite_initial.up,
    down: migration_20261016_131644_sqlite_initial.down,
    name: '20261016_131644_sqlite_initial'
  },
];
