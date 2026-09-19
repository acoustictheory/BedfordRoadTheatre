import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:musical/offline_media.dart';

class MemoryBundle extends CachingAssetBundle {
  MemoryBundle(this.files);
  final Map<String, List<int>> files;
  final Map<String, int> reads = {};
  @override
  Future<ByteData> load(String key) async {
    reads[key] = (reads[key] ?? 0) + 1;
    final bytes = files[key];
    if (bytes == null) throw StateError('Missing local asset $key');
    return ByteData.sublistView(Uint8List.fromList(bytes));
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late Directory directory;
  late MemoryBundle bundle;
  late OfflineMedia media;
  final original = utf8.encode('Bundled audio, available without any server.');
  setUp(() async {
    directory = await Directory.systemTemp.createTemp('offline-media-test-');
    final first = original.sublist(0, 16), last = original.sublist(16);
    final manifest = {
      'schemaVersion': 1,
      'tracks': [],
      'documents': [
        {'id': 'score', 'assetKey': 'sample'},
      ],
      'assets': {
        'sample': {
          'bytes': original.length,
          'sha256': sha256.convert(original).toString(),
          'mimeType': 'audio/mpeg',
          'parts': [
            {'path': 'assets/offline/sample.0.bin', 'bytes': first.length},
            {'path': 'assets/offline/sample.1.bin', 'bytes': last.length},
          ],
        },
      },
    };
    bundle = MemoryBundle({
      'assets/offline/manifest.json': utf8.encode(jsonEncode(manifest)),
      'assets/offline/sample.0.bin': first,
      'assets/offline/sample.1.bin': last,
    });
    media = OfflineMedia(bundle: bundle, directory: () async => directory);
  });
  tearDown(() async {
    await directory.delete(recursive: true);
  });
  test(
    'First open assembles and verifies installed bytes with no network service',
    () async {
      final progress = <double>[];
      final file = await media.file('sample', onProgress: progress.add);
      expect(await file.readAsBytes(), original);
      expect(progress.last, 1);
      expect(file.path.endsWith('.mp3'), isTrue);
      expect(await File('${file.path}.partial').exists(), isFalse);
      expect((await media.document('score'))!.path, file.path);
    },
  );
  test(
    'Concurrent players share extraction; later opens reuse local audio',
    () async {
      final files = await Future.wait([
        media.file('sample'),
        media.file('sample'),
      ]);
      expect(files[0].path, files[1].path);
      await media.file('sample');
      expect(bundle.reads['assets/offline/sample.0.bin'], 1);
      expect(bundle.reads['assets/offline/sample.1.bin'], 1);
    },
  );
  test(
    'Corrupted persisted copies are repaired from included assets on restart',
    () async {
      final file = await media.file('sample');
      await file.writeAsBytes(List.filled(original.length, 0));
      final reopened = OfflineMedia(
        bundle: bundle,
        directory: () async => directory,
      );
      final repaired = await reopened.file('sample');
      expect(await repaired.readAsBytes(), original);
    },
  );
  test(
    'Incomplete installed bytes cannot become a playable cached file',
    () async {
      bundle.files['assets/offline/sample.1.bin'] = List.filled(
        original.length - 16,
        0,
      );
      await expectLater(media.file('sample'), throwsStateError);
      expect(
        await Directory('${directory.path}/offline-media').list().length,
        0,
      );
    },
  );
  test('Unknown catalog entries fail without trying the website', () async {
    await expectLater(media.file('missing'), throwsStateError);
    expect(await media.document('not-included'), isNull);
  });
  test('Release catalog includes every guide/practice pair and all score references', () {
    final manifest = jsonDecode(
      File('assets/offline/manifest.json').readAsStringSync(),
    ) as Map<String, dynamic>;
    final tracks = (manifest['tracks'] as List)
        .map((row) => BundledTrack(Map<String, dynamic>.from(row)))
        .toList();
    final documents = (manifest['documents'] as List)
        .map((row) => row['id'])
        .toSet();
    expect(tracks.length, 92);
    expect(documents.length, 49);
    for (var number = 1; number <= 46; number++) {
      final song = tracks.where((t) => t.order == number).toList();
      expect(song.length, 2, reason: 'Song $number must include both variants');
      expect(song.map((t) => t.type.toLowerCase()).toSet(), {
        'guide vocal',
        'practice',
      });
      for (final track in song) {
        expect(documents.contains(track.scoreDocumentId), isTrue);
        expect((manifest['assets'] as Map).containsKey(track.assetKey), isTrue);
      }
    }
  });
}
