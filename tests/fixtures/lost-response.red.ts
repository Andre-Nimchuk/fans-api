import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { replayLostResponse } from './lost-response';
import { createAcceptedMessages } from '../../src/services/mock/chat/accepted-messages';
import { openNodeDatabase } from '../helpers/node-database';

test('one logical send must produce one accepted message (intentionally broken client)', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fan-chat-red-'));
  const db = openNodeDatabase(join(directory, 'server.db'));

  try {
    const messages = await replayLostResponse(await createAcceptedMessages(db), true);

    assert.equal(messages.length, 1);
  } finally {
    await db.close();
    await rm(directory, { recursive: true, force: true });
  }
});
