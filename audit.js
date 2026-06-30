const axios = require('axios');
const fs = require('fs');

const BASE_URL = 'https://api.viewesta.com/api/v1';

async function runAudit() {
  const timestamp = Date.now();
  const email = `test_audit_${timestamp}@example.com`;
  const username = `test_audit_${timestamp}`;
  const password = 'Password123!';

  console.log('--- STARTING TECHNICAL AUDIT ---');

  // 1. Register User
  console.log(`\n[1] Registering User: ${email}`);
  let token;
  try {
    const regRes = await axios.post(`${BASE_URL}/auth/register`, {
      email,
      username,
      password,
      first_name: 'Audit',
      last_name: 'User',
      user_type: 'viewer'
    });
    const tokens = regRes.data?.data?.tokens || regRes.data?.tokens;
    token = tokens?.accessToken || tokens?.token || regRes.data?.data?.token || regRes.data?.token;
    console.log('Register success. Token acquired.');
  } catch (err) {
    console.error('Registration failed:', err.response?.data || err.message);
    return;
  }

  const client = axios.create({
    baseURL: BASE_URL,
    headers: { Authorization: `Bearer ${token}` }
  });

  // 2. Upload Avatar URL
  console.log('\n[2] Getting Avatar Upload URL (POST /auth/profile/avatar/upload-url)');
  const uploadPayload = {
    content_type: 'image/jpeg',
    file_name: 'test-avatar.jpg',
    file_size: 1024
  };
  console.log('Payload sent:', JSON.stringify(uploadPayload));
  let uploadData;
  try {
    const uploadRes = await client.post('/auth/profile/avatar/upload-url', uploadPayload);
    console.log('Exact response from /auth/profile/avatar/upload-url:');
    console.log(JSON.stringify(uploadRes.data, null, 2));
    uploadData = uploadRes.data?.data?.upload || uploadRes.data?.data || uploadRes.data;
  } catch (err) {
    console.error('Upload URL fetch failed:', err.response?.data || err.message);
    return;
  }

  const uploadUrl = uploadData.upload_url || uploadData.uploadUrl || uploadData.url;
  const key = uploadData.s3_key || uploadData.object_key || uploadData.key || uploadData.objectKey;
  const assetUrl = uploadData.asset_url || uploadData.assetUrl;

  // 3. PUT to S3
  console.log('\n[3] Putting dummy image to S3 (Simulating frontend upload)');
  try {
    // just put a tiny string buffer
    await axios.put(uploadUrl, Buffer.from('test image content'), {
      headers: { 'Content-Type': 'image/jpeg' }
    });
    console.log('S3 Upload successful.');
  } catch (err) {
    console.error('S3 Upload failed:', err.message);
    return;
  }

  // 4. Update Avatar Endpoint
  console.log('\n[4] Updating User Avatar (PUT /auth/profile/avatar)');
  const updateAvatarPayload = {
    asset_url: assetUrl || key,
    avatar_url: assetUrl || key,
    avatar: key
  };
  console.log('Payload sent to /auth/profile/avatar:', JSON.stringify(updateAvatarPayload));
  let avatarFinalUrl;
  try {
    const updateAvatarRes = await client.put('/auth/profile/avatar', updateAvatarPayload);
    console.log('Exact response from /auth/profile/avatar:');
    console.log(JSON.stringify(updateAvatarRes.data, null, 2));
    
    // store the final avatar url to compare later
    const backendUser = updateAvatarRes.data?.data?.user || updateAvatarRes.data?.data || updateAvatarRes.data;
    avatarFinalUrl = backendUser?.avatar || backendUser?.avatar_url;
  } catch (err) {
    console.error('Update Avatar failed:', err.response?.data || err.message);
    return;
  }

  // 5. Update Profile (What the user explicitly asked about)
  console.log('\n[5] Updating Profile after avatar upload (PUT /auth/profile)');
  const updateProfilePayload = {
    first_name: 'Audit',
    last_name: 'User Edited'
  };
  console.log('Payload sent to /auth/profile:', JSON.stringify(updateProfilePayload));
  try {
    const updateProfileRes = await client.put('/auth/profile', updateProfilePayload);
    console.log('Exact response from /auth/profile:');
    console.log(JSON.stringify(updateProfileRes.data, null, 2));
    
    const backendUser = updateProfileRes.data?.data?.user || updateProfileRes.data?.data || updateProfileRes.data;
    console.log('\nDoes PUT /auth/profile return the new avatar?');
    console.log('Avatar in response:', backendUser?.avatar || backendUser?.avatar_url || 'NOT RETURNED OR NULL');
  } catch (err) {
    console.error('Update Profile failed:', err.response?.data || err.message);
    return;
  }

  // 6. Fetch Profile (Simulating Page Refresh)
  console.log('\n[6] Fetching Profile via GET /auth/me (Simulating page refresh)');
  try {
    const meRes = await client.get('/auth/me');
    console.log('Exact response from /auth/me:');
    const backendUser = meRes.data?.data?.user || meRes.data?.data || meRes.data;
    console.log('Avatar currently stored in database:', backendUser?.avatar || backendUser?.avatar_url || 'NOT RETURNED OR NULL');
    
    if ((backendUser?.avatar || backendUser?.avatar_url) === avatarFinalUrl) {
      console.log('SUCCESS: Avatar persisted successfully in the database.');
    } else {
      console.log('FAILURE: Avatar was lost or overwritten in the database.');
    }
  } catch (err) {
    console.error('GET /auth/me failed:', err.response?.data || err.message);
    return;
  }
}

runAudit();
