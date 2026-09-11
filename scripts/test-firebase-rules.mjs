import fs from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  getBytes,
  ref,
  uploadBytes,
} from 'firebase/storage';

const projectId = 'brpa-digital-hub-dev';
const productionId = 'PROD-test';
const ownerId = 'USR-owner';
const otherId = 'USR-other';
const adminId = 'USR-admin';

const environment = await initializeTestEnvironment({
  projectId,
  firestore: { rules: fs.readFileSync('firestore.rules', 'utf8') },
  storage: { rules: fs.readFileSync('storage.rules', 'utf8') },
});

const ownerContext = environment.authenticatedContext('auth-owner', {
  legacyUserId: ownerId,
});
const otherContext = environment.authenticatedContext('auth-other', {
  legacyUserId: otherId,
});
const adminContext = environment.authenticatedContext('auth-admin', {
  legacyUserId: adminId,
  fullAdmin: true,
});
const inactiveContext = environment.authenticatedContext('auth-inactive', {
  legacyUserId: 'USR-inactive',
});

try {
  await environment.withSecurityRulesDisabled(async context => {
    const database = context.firestore();
    await Promise.all([
      setDoc(doc(database, 'users', ownerId), { status: 'Active' }),
      setDoc(doc(database, 'users', otherId), { Status: 'Active' }),
      setDoc(doc(database, 'users', adminId), {
        status: 'Active',
        isFullAdmin: true,
      }),
      setDoc(doc(database, 'users', 'USR-inactive'), { status: 'Disabled' }),
      setDoc(doc(database, 'productions', productionId), { status: 'Active' }),
      setDoc(doc(database, 'productions', productionId, 'tracks', 'TRK-1'), {
        trackID: 'TRK-1',
        status: 'Published',
      }),
      setDoc(
        doc(database, 'productions', productionId, 'propsInventory', 'PROP-1'),
        { propID: 'PROP-1', status: 'Needed' },
      ),
      setDoc(
        doc(
          database,
          'productions',
          productionId,
          'costumeMeasurements',
          'MEASURE-1',
        ),
        { measurementID: 'MEASURE-1', actorUserID: ownerId },
      ),
      setDoc(
        doc(database, 'productions', productionId, 'storageAssets', 'FILE-1'),
        { storagePath: 'legacy-drive/FILE-1/test.mp3', status: 'Verified' },
      ),
    ]);
  });

  const ownerDatabase = ownerContext.firestore();
  const annotation = doc(
    ownerDatabase,
    'productions',
    productionId,
    'scoreAnnotations',
    `${ownerId}_92002`,
  );
  const page = doc(annotation, 'pages', '1');
  const mark = doc(annotation, 'marks', 'mark-1');
  const batch = writeBatch(ownerDatabase);
  batch.set(annotation, {
    ownerUserId: ownerId,
    documentId: '92002',
    schemaVersion: 4,
  });
  batch.set(page, {
    ownerUserId: ownerId,
    documentId: '92002',
    page: 1,
    marks: [],
  });
  batch.set(mark, {
    id: 'mark-1',
    ownerUserId: ownerId,
    documentId: '92002',
    page: 1,
    points: [{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.4 }],
  });
  await assertSucceeds(batch.commit());
  await assertSucceeds(getDoc(annotation));
  await assertSucceeds(getDoc(page));
  await assertSucceeds(getDoc(mark));

  const otherDatabase = otherContext.firestore();
  const adminDatabase = adminContext.firestore();
  await assertSucceeds(
    getDoc(
      doc(
        otherDatabase,
        'productions',
        productionId,
        'scoreAnnotations',
        `${ownerId}_92002`,
      ),
    ),
  );
  await assertSucceeds(
    getDoc(
      doc(
        otherDatabase,
        'productions',
        productionId,
        'scoreAnnotations',
        `${ownerId}_92002`,
        'marks',
        'mark-1',
      ),
    ),
  );
  await assertFails(
    setDoc(
      doc(
        otherDatabase,
        'productions',
        productionId,
        'scoreAnnotations',
        `${ownerId}_92002`,
        'marks',
        'mark-1',
      ),
      {ownerUserId:ownerId,documentId:'92002',page:1,points:[]},
    ),
  );

  const ownerProp = doc(
    ownerDatabase,
    'productions',
    productionId,
    'propsInventory',
    'PROP-1',
  );
  await assertSucceeds(getDoc(ownerProp));
  await assertFails(setDoc(ownerProp, { status: 'Ready' }, { merge: true }));
  await assertSucceeds(
    setDoc(
      doc(
        adminDatabase,
        'productions',
        productionId,
        'propsInventory',
        'PROP-1',
      ),
      { status: 'Ready' },
      { merge: true },
    ),
  );
  await assertFails(
    getDoc(
      doc(
        ownerDatabase,
        'productions',
        productionId,
        'costumeMeasurements',
        'MEASURE-1',
      ),
    ),
  );
  await assertSucceeds(
    getDoc(
      doc(
        adminDatabase,
        'productions',
        productionId,
        'costumeMeasurements',
        'MEASURE-1',
      ),
    ),
  );
  await assertFails(
    setDoc(
      doc(
        otherDatabase,
        'productions',
        productionId,
        'scoreAnnotations',
        `${ownerId}_92002`,
        'pages',
        '1',
      ),
      { ownerUserId: ownerId, documentId: '92002', page: 1, marks: [] },
    ),
  );

  const adminPage = doc(
    adminDatabase,
    'productions',
    productionId,
    'scoreAnnotations',
    `${ownerId}_92002`,
    'pages',
    '1',
  );
  await assertSucceeds(getDoc(adminPage));
  await assertSucceeds(
    setDoc(adminPage, {
      ownerUserId: ownerId,
      documentId: '92002',
      page: 1,
      marks: [{ id: 'admin-note', page: 1 }],
    }),
  );

  await assertSucceeds(
    getDoc(doc(ownerDatabase, 'productions', productionId, 'tracks', 'TRK-1')),
  );
  await assertSucceeds(
    getDoc(
      doc(ownerDatabase, 'productions', productionId, 'storageAssets', 'FILE-1'),
    ),
  );
  await assertFails(
    getDoc(
      doc(
        inactiveContext.firestore(),
        'productions',
        productionId,
        'tracks',
        'TRK-1',
      ),
    ),
  );

  const adminStorage = adminContext.storage();
  const ownerStorage = ownerContext.storage();
  const anonymousStorage = environment.unauthenticatedContext().storage();
  const audioPath = 'legacy-drive/FILE-1/test.mp3';
  await assertSucceeds(
    uploadBytes(ref(adminStorage, audioPath), new Uint8Array([1, 2, 3]), {
      contentType: 'audio/mpeg',
    }),
  );
  await assertSucceeds(getBytes(ref(ownerStorage, audioPath)));
  await assertFails(getBytes(ref(anonymousStorage, audioPath)));
  await assertFails(
    uploadBytes(
      ref(ownerStorage, 'workspace-media/PROD-test/blocking/private.mp3'),
      new Uint8Array([1]),
    ),
  );

  console.log(
    'Firebase rules checks passed: annotation ownership/admin review, workspace boundaries, active track reads, inactive denial, private-record isolation, and authenticated Storage access.',
  );
} finally {
  await environment.cleanup();
}
