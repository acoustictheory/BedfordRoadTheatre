import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const serviceAccount = '499470162310-compute@developer.gserviceaccount.com';
const configPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const firebaseAuth = require(path.join(process.env.APPDATA, 'npm', 'node_modules', 'firebase-tools', 'lib', 'auth.js'));
const credentials = await firebaseAuth.getAccessToken(config.tokens?.refresh_token, []);
if (!credentials.access_token) throw new Error('Run firebase login first.');

const endpoint = `https://iam.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(serviceAccount)}`;
const headers = {Authorization:`Bearer ${credentials.access_token}`,'Content-Type':'application/json'};
const currentResponse = await fetch(`${endpoint}:getIamPolicy`, {method:'POST',headers,body:'{}'});
if (!currentResponse.ok) throw new Error(`Could not read IAM policy: ${currentResponse.status} ${await currentResponse.text()}`);
const policy = await currentResponse.json();
policy.bindings ||= [];
const role = 'roles/iam.serviceAccountTokenCreator';
const member = `serviceAccount:${serviceAccount}`;
let binding = policy.bindings.find(item => item.role === role);
if (!binding) policy.bindings.push(binding = {role,members:[]});
binding.members ||= [];
if (!binding.members.includes(member)) binding.members.push(member);
const saveResponse = await fetch(`${endpoint}:setIamPolicy`, {method:'POST',headers,body:JSON.stringify({policy})});
if (!saveResponse.ok) throw new Error(`Could not save IAM policy: ${saveResponse.status} ${await saveResponse.text()}`);
console.log(`Granted ${role} to ${member}.`);
