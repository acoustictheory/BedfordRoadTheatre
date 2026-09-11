import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const requireCondition = (condition, message) => {
  if (!condition) throw new Error(message);
};

const functionsSource = read('functions/index.js');
const apiSource = read('assets/js/api.js');
const rulesSource = read('firestore.rules');
const storageRules = read('storage.rules');
const mobileSource = read('mobile-app/lib/annotation/document_reader.dart');
const annotationStore = read('mobile-app/lib/annotation/practice_notes_store.dart');
const bundleId = 'ca.sk.bedfordroad.musical';
const productionId = 'PROD-b0d6edc6-c518-404c-a0a8-29b8a7369ba1';

const routedActions = [
  'tracks', 'trackAudioInfo', 'trackAudioChunk',
  'savePropsItem', 'uploadPropsImage', 'saveScenicSet', 'uploadScenicImage',
  'saveCostumeCharacter', 'uploadCostumeImage',
  'blockingSnapshot', 'saveBlockingSnapshot', 'saveBlockingTimeline',
  'saveBlockingSceneRecording', 'blockingSceneAudioChunk',
];
for (const action of routedActions) {
  requireCondition(apiSource.includes(`'${action}'`), `${action} is not routed to Firebase.`);
  requireCondition(functionsSource.includes(`action==='${action}'`) || functionsSource.includes(`${action}:`), `${action} has no Firebase server handler.`);
}

requireCondition(rulesSource.includes('match /scoreAnnotations/{annotationId}'), 'Annotation parent rules are missing.');
requireCondition(rulesSource.includes('match /pages/{pageId}'), 'Page-sharded annotation rules are missing.');
requireCondition(annotationStore.includes("collection('pages')"), 'Mobile annotations are not page-sharded.');
requireCondition(annotationStore.includes("collection('marks')"), 'Mobile annotations are not stored as Firestore-safe mark documents.');
requireCondition(annotationStore.includes('_saveQueue'), 'Mobile annotation writes are not serialized.');
requireCondition(storageRules.includes('match /legacy-drive/{driveFileId}/{fileName}'), 'Track Storage read rule is missing.');

const bundleFiles = [
  'codemagic.yaml',
  'mobile-app/android/app/build.gradle.kts',
  'mobile-app/ios/Runner.xcodeproj/project.pbxproj',
  'mobile-app/ios/Runner/GoogleService-Info.plist',
];
for (const file of bundleFiles) requireCondition(read(file).includes(bundleId), `${file} does not use ${bundleId}.`);
requireCondition(mobileSource.includes(productionId), 'ScoreFlow is pointed at a different production.');

const backupRoot = path.join(root, 'backups', 'pre-cutover-20260908-202450');
for (const file of ['legacy-google-drive-export.zip', 'source-code-working-tree.zip', 'legacy-integrity-report.json', 'reconciliation-apply-report.json']) {
  const target = path.join(backupRoot, file);
  requireCondition(fs.existsSync(target) && fs.statSync(target).size > 0, `Rollback artifact is missing: ${file}`);
}
const legacyReport = JSON.parse(fs.readFileSync(path.join(backupRoot, 'legacy-integrity-report.json'), 'utf8'));
requireCondition(legacyReport.valid === true, 'Legacy backup integrity report is not valid.');
const storageManifest = JSON.parse(fs.readFileSync(path.join(backupRoot, 'firebase', 'storage', 'storage-manifest.json'), 'utf8'));
requireCondition(storageManifest.valid === true && storageManifest.failedSizeChecks.length === 0, 'Firebase Storage backup validation failed.');
requireCondition(storageManifest.objects === 150 && storageManifest.bytes === 614800142, 'Firebase Storage backup count changed unexpectedly.');

const firestore = JSON.parse(fs.readFileSync(path.join(backupRoot, 'firebase', 'active-production', 'firestore-complete.json'), 'utf8'));
const collection = name => firestore.collections.find(item => item.path.endsWith(`/${name}`))?.documents || [];
const field = (document, name) => document.fields?.[name]?.stringValue ?? document.fields?.[name]?.integerValue ?? '';
const tracks = collection('tracks');
const assets = new Set(collection('storageAssets').map(document => document.name.split('/').at(-1)));
const missingAssets = tracks.filter(track => !assets.has(field(track, 'DriveFileID')));
requireCondition(tracks.length === 92, `Expected 92 ScoreFlow tracks, found ${tracks.length}.`);
requireCondition(missingAssets.length === 0, `${missingAssets.length} ScoreFlow tracks lack Storage metadata.`);

console.log(JSON.stringify({
  ready: true,
  routedActions: routedActions.length,
  bundleId,
  productionId,
  tracks: tracks.length,
  storageObjects: storageManifest.objects,
  storageBytes: storageManifest.bytes,
  rollbackArtifacts: 4,
}, null, 2));
