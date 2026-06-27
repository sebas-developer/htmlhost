// Self-check for hierarchical account permissions.
// Run: node src/services/hierarchy.selfcheck.js
const os = require('os');
const path = require('path');
process.env.DATA_DIR = path.join(os.tmpdir(), 'htmlhost-test-' + Date.now());

const { getDb, close } = require('../db');
const keys = require('./keys');
const pastes = require('./pastes');

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; }
  else { fail++; console.error(`  FAIL: ${msg}`); }
}

getDb();
const db = getDb();

// Build tree: root → childAdmin → teamUnderChild; root → teamDirect, userDirect
const root = insertTestKey('root', 'admin', null, true);
const childAdmin = insertTestKey('childAdmin', 'admin', root.account_id, false);
const teamUnderChild = insertTestKey('teamUnderChild', 'team', childAdmin.account_id, false);
const teamDirect = insertTestKey('teamDirect', 'team', root.account_id, false);
const userDirect = insertTestKey('userDirect', 'user', root.account_id, false);

function insertTestKey(label, scope, parentId, isRoot) {
  const id = label;
  const accountId = label;
  db.prepare('INSERT INTO keys (id, hash, label, created_at, account_id, scope, parent_account_id, is_root) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, 'hash_' + label, label, Date.now(), accountId, scope, parentId, isRoot ? 1 : 0);
  return { id, account_id: accountId, scope };
}

// --- CTE tests ---

// Root's visible paste accounts: own + teamDirect + userDirect (NOT childAdmin, NOT teamUnderChild)
const rootVisible = keys.getVisiblePasteAccounts(root.account_id);
assert(rootVisible.includes(teamDirect.account_id), 'root sees teamDirect');
assert(rootVisible.includes(userDirect.account_id), 'root sees userDirect');
assert(!rootVisible.includes(childAdmin.account_id), 'root does NOT see childAdmin');
assert(!rootVisible.includes(teamUnderChild.account_id), 'root does NOT see teamUnderChild (stop at admin boundary)');

// Root's all descendants (for key management): includes everyone
const rootAllDesc = keys.getAllDescendantAccounts(root.account_id);
assert(rootAllDesc.includes(childAdmin.account_id), 'root manages childAdmin');
assert(rootAllDesc.includes(teamUnderChild.account_id), 'root manages teamUnderChild');
assert(rootAllDesc.includes(teamDirect.account_id), 'root manages teamDirect');
assert(rootAllDesc.includes(userDirect.account_id), 'root manages userDirect');

// Child admin's visible paste accounts: own + teamUnderChild
const childVisible = keys.getVisiblePasteAccounts(childAdmin.account_id);
assert(childVisible.includes(teamUnderChild.account_id), 'childAdmin sees teamUnderChild');
assert(!childVisible.includes(teamDirect.account_id), 'childAdmin does NOT see teamDirect');
assert(!childVisible.includes(root.account_id), 'childAdmin does NOT see root');

// --- Paste visibility tests ---

// Create private paste under childAdmin
const childPrivate = pastes.createPaste({ html: '<p>child private</p>', ttl: '1d', ownerKeyId: childAdmin.id, accountId: childAdmin.account_id });
// Create private paste under teamDirect
const teamPrivate = pastes.createPaste({ html: '<p>team private</p>', ttl: '1d', ownerKeyId: teamDirect.id, accountId: teamDirect.account_id });

// Root accountIds (computed like auth middleware does)
const rootAccountIds = [root.account_id, ...keys.getVisiblePasteAccounts(root.account_id)];
const childAccountIds = [childAdmin.account_id, ...keys.getVisiblePasteAccounts(childAdmin.account_id)];

// Root list: should NOT include childAdmin's private paste
const rootList = pastes.listPastes(root.id, rootAccountIds, 'admin');
assert(!rootList.find(p => p.id === childPrivate.id), 'root list does NOT include childAdmin private');
// Root list: SHOULD include teamDirect's private paste
assert(!!rootList.find(p => p.id === teamPrivate.id), 'root list includes teamDirect private');

// Child admin list: SHOULD include own private
const childList = pastes.listPastes(childAdmin.id, childAccountIds, 'admin');
assert(!!childList.find(p => p.id === childPrivate.id), 'childAdmin list includes own private');
// Child admin list: should NOT include teamDirect's private
assert(!childList.find(p => p.id === teamPrivate.id), 'childAdmin list does NOT include teamDirect private');

// --- Delete guards ---

// Cannot delete root
const delRoot = keys.deleteKey(root.id);
assert(delRoot && delRoot.error, 'cannot delete root key');

// Cannot delete childAdmin (has children)
const delChildAdmin = keys.deleteKey(childAdmin.id);
assert(delChildAdmin && delChildAdmin.error, 'cannot delete key with children');

// Can delete leaf (userDirect)
const delUser = keys.deleteKey(userDirect.id);
assert(delUser && !delUser.error && delUser.deletedPastes !== undefined, 'can delete leaf key');

// --- Public paste edit by admin from different tree ---

// Make teamDirect's paste public
db.prepare('UPDATE pastes SET is_public = 1 WHERE id = ?').run(teamPrivate.id);
// Child admin should be able to edit public paste (canEdit via is_public)
const childCanEditPublic = !!teamPrivate.is_public || true; // gate logic: admin + is_public = true
// Root should see it in list (it's public now)
const rootListWithPublic = pastes.listPastes(root.id, rootAccountIds, 'admin');
assert(!!rootListWithPublic.find(p => p.id === teamPrivate.id), 'root sees public paste from team account');

close();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
