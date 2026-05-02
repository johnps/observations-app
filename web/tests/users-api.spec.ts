import { test, expect } from '@playwright/test';

test('role lookup returns correct role for seeded admin', async ({ request }) => {
  const res = await request.get('/api/users/role?email=test-admin@placeholder.local');
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.role).toBe('admin');
});

test('role lookup returns correct role for seeded district lead', async ({ request }) => {
  const res = await request.get('/api/users/role?email=test-district-lead@placeholder.local');
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.role).toBe('district_lead');
});

test('role lookup returns 404 for unknown email', async ({ request }) => {
  const res = await request.get('/api/users/role?email=nobody@example.com');
  expect(res.status()).toBe(404);
});

test('role lookup returns 400 when email param missing', async ({ request }) => {
  const res = await request.get('/api/users/role');
  expect(res.status()).toBe(400);
});

test('list users returns all seeded placeholder accounts', async ({ request }) => {
  const res = await request.get('/api/users');
  expect(res.status()).toBe(200);
  const body = await res.json();
  const emails = body.users.map((u: { email: string }) => u.email);
  expect(emails).toContain('test-admin@placeholder.local');
  expect(emails).toContain('test-district-lead@placeholder.local');
  expect(emails).toContain('test-block-lead@placeholder.local');
  expect(emails).toContain('test-state-lead@placeholder.local');
});

test('add user creates a new user and upserts on re-add', async ({ request }) => {
  const email = 'test-new-user@placeholder.local';

  const create = await request.post('/api/users', {
    data: { email, role: 'district_lead', district_name: 'Test District' },
  });
  expect(create.status()).toBe(200);

  // Upsert — same email, different role — must not create a duplicate
  const upsert = await request.post('/api/users', {
    data: { email, role: 'block_lead', block_name: 'Test Block' },
  });
  expect(upsert.status()).toBe(200);

  const list = await request.get('/api/users');
  const body = await list.json();
  const matches = body.users.filter((u: { email: string }) => u.email === email);
  expect(matches).toHaveLength(1);
  expect(matches[0].role).toBe('block_lead');

  // Cleanup
  await request.delete(`/api/users/${matches[0].id}`);
});

test('add user returns 400 when geography does not match role', async ({ request }) => {
  const res = await request.post('/api/users', {
    data: { email: 'bad@placeholder.local', role: 'district_lead' }, // missing district_name
  });
  expect(res.status()).toBe(400);
});

test('revoke user removes them from the list', async ({ request }) => {
  const email = 'test-revoke@placeholder.local';
  await request.post('/api/users', {
    data: { email, role: 'admin' },
  });

  const list = await request.get('/api/users');
  const body = await list.json();
  const user = body.users.find((u: { email: string }) => u.email === email);
  expect(user).toBeDefined();

  const del = await request.delete(`/api/users/${user.id}`);
  expect(del.status()).toBe(200);

  const list2 = await request.get('/api/users');
  const body2 = await list2.json();
  const stillThere = body2.users.find((u: { email: string }) => u.email === email);
  expect(stillThere).toBeUndefined();
});
