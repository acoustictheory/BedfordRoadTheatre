import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';

class BundledTrack {
  BundledTrack(Map<String, dynamic> row)
    : id = row['id'] as String,
      title = row['title'] as String,
      type = row['type'] as String,
      order = (row['order'] as num).toInt(),
      scoreDocumentId = row['scoreDocumentId'] as String,
      assetKey = row['assetKey'] as String,
      driveFileId = row['driveFileId'] as String,
      notes = row['notes'] as String? ?? '';
  final String id, title, type, scoreDocumentId, assetKey, driveFileId, notes;
  final int order;
  Map<String, dynamic> get readerRecord => {
    '_id': id,
    'title': title,
    'trackType': type,
    'sortOrder': order,
    'scoreDocumentId': scoreDocumentId,
    'driveFileID': driveFileId,
  };
}

/// The catalog and every media byte come from the installed application.
/// Extraction is lazy and atomic; interrupted/corrupt copies are repaired from
/// the bundle without a connection. No Firebase or HTTP dependency belongs here.
class OfflineMedia {
  OfflineMedia({AssetBundle? bundle, Future<Directory> Function()? directory})
    : _bundle = bundle ?? rootBundle,
      _directory = directory ?? getApplicationSupportDirectory;
  static final instance = OfflineMedia();
  final AssetBundle _bundle;
  final Future<Directory> Function() _directory;
  Future<Map<String, dynamic>>? _manifest;
  final Map<String, Future<File>> _pending = {};
  final Set<String> _verified = {};

  Future<Map<String, dynamic>> catalog() => _manifest ??= _loadManifest();
  Future<Map<String, dynamic>> _loadManifest() async {
    final data = jsonDecode(
      await _bundle.loadString('assets/offline/manifest.json'),
    ) as Map<String, dynamic>;
    if (data['schemaVersion'] != 1) {
      throw StateError('Please install the latest complete app.');
    }
    return data;
  }

  Future<List<BundledTrack>> tracks() async =>
      ((await catalog())['tracks'] as List)
          .map((row) => BundledTrack(Map<String, dynamic>.from(row as Map)))
          .toList();

  Future<File?> document(String id, {void Function(double)? onProgress}) async {
    final documents = (await catalog())['documents'] as List;
    for (final row in documents) {
      if (row['id'] == id) {
        return file(row['assetKey'] as String, onProgress: onProgress);
      }
    }
    return null;
  }

  Future<File> file(String key, {void Function(double)? onProgress}) =>
      _pending.putIfAbsent(
        key,
        () => _extract(key, onProgress).whenComplete(() {
          _pending.remove(key);
        }),
      );

  Future<File> _extract(String key, void Function(double)? onProgress) async {
    final entry = ((await catalog())['assets'] as Map)[key] as Map?;
    if (entry == null) {
      throw StateError('This file is not included in this app version.');
    }
    final hash = entry['sha256'] as String;
    if (!RegExp(r'^[a-f0-9]{64}$').hasMatch(hash)) {
      throw StateError('Invalid bundled media checksum.');
    }
    final directory = Directory(
      '${(await _directory()).path}${Platform.pathSeparator}offline-media',
    );
    await directory.create(recursive: true);
    final extension = entry['mimeType'] == 'application/pdf' ? 'pdf' : 'mp3';
    final target = File(
      '${directory.path}${Platform.pathSeparator}$hash.$extension',
    );
    final expected = (entry['bytes'] as num).toInt();
    if (await target.exists() && await target.length() == expected) {
      if (_verified.contains(hash) ||
          (await sha256.bind(target.openRead()).first).toString() == hash) {
        _verified.add(hash);
        onProgress?.call(1);
        return target;
      }
    }
    final partial = File('${target.path}.partial');
    var received = 0;
    try {
      final sink = partial.openWrite();
      try {
        for (final part in entry['parts'] as List) {
          final assetPath = part['path'] as String;
          if (!RegExp(r'^assets/offline/[A-Za-z0-9_.-]+\.bin$')
              .hasMatch(assetPath)) {
            throw StateError('Invalid bundled asset path.');
          }
          final data = await _bundle.load(assetPath);
          if (data.lengthInBytes != part['bytes']) {
            throw StateError(
              'The installed media is incomplete. Reinstall the full app.',
            );
          }
          sink.add(
            data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes),
          );
          await sink.flush();
          received += data.lengthInBytes;
          onProgress?.call(received / expected);
        }
      } finally {
        await sink.close();
      }
      if (received != expected ||
          (await sha256.bind(partial.openRead()).first).toString() != hash) {
        throw StateError(
          'The installed media failed verification. Reinstall the full app.',
        );
      }
      if (await target.exists()) await target.delete();
      await partial.rename(target.path);
      _verified.add(hash);
      return target;
    } catch (_) {
      if (await partial.exists()) await partial.delete();
      rethrow;
    }
  }
}
