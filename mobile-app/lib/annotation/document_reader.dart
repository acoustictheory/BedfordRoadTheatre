import 'dart:async';
import 'dart:io';
import 'dart:math' as math;

import 'package:firebase_storage/firebase_storage.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:http/http.dart' as http;
import 'package:just_audio/just_audio.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdfrx/pdfrx.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'music_notation_symbols.dart';
import 'practice_notes_store.dart';
import 'score_annotation_layer.dart';

class ProductionDocument {
  const ProductionDocument({
    required this.id,
    required this.title,
    required this.storagePath,
    required this.storeId,
    this.remoteUrl = '',
  });
  final String id, title, storagePath, remoteUrl;
  final int storeId;
}

ProductionDocument productionSongDocument(int number, String title) {
  final padded = number.toString().padLeft(2, '0');
  return ProductionDocument(
    id: 'descendants-song-$padded',
    title: '$padded - $title',
    storagePath:
        'production-documents/PROD-b0d6edc6-c518-404c-a0a8-29b8a7369ba1/descendants-song-$padded.pdf',
    storeId: 92000 + number,
  );
}

const scoreFlowSongTitles = <String>[
  'Overture',
  'Better Together (Prelude 1)',
  'Rotten To The Core (Part 1)',
  'Rotten To The Core (Part 2)',
  "Maleficent's Entrance 1",
  'Evil Like Me',
  'Be Our Guest (Part 1)',
  'Be Our Guest (Part 2)',
  'Good is the New Bad (Preprise)',
  'Good is the New Bad (Part 1)',
  'Good is the New Bad (Part 2)',
  'Good is the New Bad (Playoff)',
  'Truancy',
  'Museum Spells',
  'Evil Like Me (Reprise 1)',
  'Remedial Goodness',
  "Rotten To The Core (Parents' Revenge)",
  'Tourney Field',
  'Goal',
  'Good is the New Bad (Reprise 1)',
  'Ways to Be Wicked (Preprise)',
  'A Dream Is A Wish',
  'Potioned Cookies',
  'Did I Mention (Prelude)',
  'Did I Mention',
  'Did I Mention (Playoff)',
  'Better Together (Prelude 2)',
  'The Fight',
  'Space Between',
  "Chillin' Like a Villain (Part 1)",
  "Chillin' Like a Villain (Part 2)",
  'Good is the New Bad (Reprise 2)',
  'Sad Graffiti',
  "Maleficent's Entrance 2",
  'If Only',
  'Ways to Be Wicked',
  'Coronation Day',
  'Go The Distance (Chorale)',
  "Maleficent's Entrance 3",
  'Evil Like Me (Reprise 2)',
  'Get The Wand!',
  'Better Together',
  'Break This Down',
  'Exit Music',
  "Entr'acte",
  'Go The Distance (2-Part Chorale)',
];

class _AutoTrackFrame {
  const _AutoTrackFrame(this.timeMs, this.page, this.y, this.holdMs);
  final int timeMs, page, holdMs;
  final double y;
}

const productionDocuments = [
  ProductionDocument(
    id: 'descendants-libretto',
    title: 'Descendants Libretto',
    storagePath: 'production-documents/PROD-b0d6edc6-c518-404c-a0a8-29b8a7369ba1/descendants-libretto.pdf',
    storeId: 91000,
  ),
  ProductionDocument(
    id: 'descendants-script',
    title: 'Descendants Script',
    storagePath: 'production-documents/PROD-b0d6edc6-c518-404c-a0a8-29b8a7369ba1/descendants-script.pdf',
    storeId: 91001,
  ),
  ProductionDocument(
    id: 'descendants-music',
    title: 'Descendants Sheet Music',
    storagePath: 'production-documents/PROD-b0d6edc6-c518-404c-a0a8-29b8a7369ba1/descendants-music.pdf',
    storeId: 91002,
  ),
];

class DocumentLibraryScreen extends StatelessWidget {
  const DocumentLibraryScreen({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Script & music')),
    body: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          'Production library',
          style: Theme.of(context).textTheme.headlineSmall
              ?.copyWith(fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 6),
        Text(
          'Read offline inside the app and keep private page-anchored annotations on this device.',
          style: TextStyle(
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: 18),
        ...productionDocuments.map(
          (document) => Card(
            child: ListTile(
              contentPadding: const EdgeInsets.all(16),
              leading: CircleAvatar(
                child: Icon(
                  document.id.contains('music')
                      ? Icons.music_note
                      : Icons.menu_book,
                ),
              ),
              title: Text(
                document.title,
                style: const TextStyle(fontWeight: FontWeight.w900),
              ),
              subtitle: const Text('App-private reader - Annotation Studio'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => AnnotatedDocumentScreen(document: document),
                ),
              ),
            ),
          ),
        ),
      ],
    ),
  );
}

class AnnotatedDocumentScreen extends StatefulWidget {
  const AnnotatedDocumentScreen({
    super.key,
    required this.document,
    this.ownerUserId,
    this.ownerName,
  });
  final ProductionDocument document;
  final String? ownerUserId, ownerName;
  @override
  State<AnnotatedDocumentScreen> createState() =>
      _AnnotatedDocumentScreenState();
}

class _AnnotatedDocumentScreenState extends State<AnnotatedDocumentScreen>
    with WidgetsBindingObserver {
  late final PracticeNotesStore store = PracticeNotesStore(
    widget.document.storeId,
    productionId:
        RegExp(r'production-documents/([^/]+)')
            .firstMatch(widget.document.storagePath)
            ?.group(1) ??
        '',
    ownerUserId: widget.ownerUserId,
  );
  final controller = PdfViewerController();
  final audio = AudioPlayer();
  final companionAudio = AudioPlayer();
  StreamSubscription<Duration>? positionSubscription;
  StreamSubscription<List<ScoreInkMark>>? annotationCloudSubscription;
  Timer? annotationSaveTimer;
  List<ScoreInkMark>? pendingAnnotationSave;
  String annotationSyncStatus = 'Loading annotations';
  String? annotationSyncError;
  List<Map<String, dynamic>> audioTracks = [];
  String activeTrackId = '';
  Map<String, dynamic>? guideTrack, practiceTrack;
  double trackBlend = .5;
  double masterVolume = 1;
  double trackDownloadProgress = 0;
  String trackLoadStatus = '';
  String? trackError;
  Duration audioPosition = Duration.zero, audioDuration = Duration.zero;
  Duration? loopA, loopB;
  bool playerCollapsed = false, audioLoading = false, autoTrackEnabled = false;
  List<_AutoTrackFrame> autoTrackFrames = const [];
  int autoTrackFrameIndex = -1;
  Matrix4? annotationNavStartMatrix;
  Offset? annotationNavStartFocal;
  String readerMode = 'continuous';
  double playbackSpeed = 1;
  File? file;
  double progress = 0;
  String? error;
  int page = 1;
  int pages = 0;
  bool annotate = false, stylusOnly = false;
  ScoreInkTool tool = ScoreInkTool.pen;
  Color color = const Color(0xffff3ec9);
  double width = .0045, opacity = 1;
  String stamp = 'VOWEL', layer = 'my_notes';
  Set<String> visibleLayers = {'my_notes', 'rehearsal', 'shared'};
  List<ScoreAnnotationLayerDefinition> layers = [
    ...defaultScoreAnnotationLayers,
  ];
  List<ScoreInkMark> marks = [];
  final List<List<ScoreInkMark>> undo = [], redo = [];
  Set<String> selected = {};
  Map<String, ScoreInkMark> transformBase = {};
  Color scoreFlowPrimary = const Color(0xffff3ec9);
  Color scoreFlowSecondary = const Color(0xff00e9ff);
  Color scoreFlowSurface = const Color(0xff12101f);
  String scoreFlowPreset = 'Descendants Neon';
  bool administrator = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    unawaited(restoreReadingState());
    unawaited(load());
    unawaited(loadTracks());
    unawaited(loadScoreFlowAppearance());
    unawaited(loadAdministratorState());
    positionSubscription = audio.positionStream.listen((position) {
      if (loopA != null && loopB != null && position >= loopB!) {
        unawaited(seekPair(loopA!));
        return;
      }
      if (autoTrackEnabled) unawaited(followAutoTrack(position));
      if (companionAudio.playing &&
          (companionAudio.position - position).inMilliseconds.abs() > 90) {
        unawaited(companionAudio.seek(position));
      }
      if (mounted) setState(() => audioPosition = position);
    });
    audio.durationStream.listen((value) {
      if (mounted && value != null) setState(() => audioDuration = value);
    });
  }

  Future<void> loadAdministratorState() async {
    final uid = await store.resolveOwner();
    if (uid == 'local') return;
    final data =
        (await FirebaseFirestore.instance.collection('users').doc(uid).get())
            .data() ??
        {};
    if (mounted)
      setState(
        () => administrator =
            data['isFullAdmin'] == true ||
            data['IsFullAdmin'] == true ||
            '${data['IsFullAdmin']}'.toUpperCase() == 'TRUE',
      );
  }

  Future<void> chooseAnnotationOwner() async {
    final snapshot = await FirebaseFirestore.instance
        .collection('communityMembers')
        .get();
    if (!mounted) return;
    final chosen = await showModalBottomSheet<Map<String, String>>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          children: [
            const ListTile(
              title: Text('Review singer annotations'),
              subtitle: Text(
                'Choose whose private working copy to open. Administrator edits are recorded.',
              ),
            ),
            ...snapshot.docs
                .where((document) {
                  final data = document.data();
                  return '${data['status'] ?? data['Status'] ?? 'Active'}'
                          .toLowerCase() ==
                      'active';
                })
                .map((document) {
                  final data = document.data(),
                      name =
                          '${data['firstName'] ?? data['FirstName'] ?? ''} ${data['lastName'] ?? data['LastName'] ?? ''}'
                              .trim(),
                      photo = '${data['photoURL'] ?? data['PhotoURL'] ?? ''}'
                          .trim();
                  return ListTile(
                    leading: CircleAvatar(
                      backgroundImage: photo.isEmpty
                          ? null
                          : NetworkImage(photo),
                      child: photo.isEmpty
                          ? const Icon(Icons.person_outline)
                          : null,
                    ),
                    title: Text(
                      name.isEmpty
                          ? '${data['displayName'] ?? data['DisplayName'] ?? data['username'] ?? data['Username'] ?? document.id}'
                          : name,
                    ),
                    subtitle: Text(
                      '@${data['username'] ?? data['Username'] ?? document.id}',
                    ),
                    onTap: () => Navigator.pop(sheetContext, {
                      'id': document.id,
                      'name': name.isEmpty
                          ? '${data['displayName'] ?? document.id}'
                          : name,
                    }),
                  );
                }),
          ],
        ),
      ),
    );
    if (chosen == null || !mounted) return;
    await Navigator.pushReplacement(
      context,
      MaterialPageRoute(
        builder: (_) => AnnotatedDocumentScreen(
          document: widget.document,
          ownerUserId: chosen['id'],
          ownerName: chosen['name'],
        ),
      ),
    );
  }

  Future<void> restoreReadingState() async {
    final preferences = await SharedPreferences.getInstance();
    final key = 'scoreFlow.${widget.document.id}';
    final restoredPage = preferences.getInt('$key.page') ?? 1;
    final restoredPosition = preferences.getInt('$key.positionMs') ?? 0;
    final restoredSpeed = preferences.getDouble('$key.speed') ?? 1;
    final restoredLoopA = preferences.getInt('$key.loopA') ?? -1;
    final restoredLoopB = preferences.getInt('$key.loopB') ?? -1;
    if (!mounted) return;
    setState(() {
      page = restoredPage;
      audioPosition = Duration(milliseconds: restoredPosition);
      playbackSpeed = restoredSpeed;
      loopA = restoredLoopA >= 0 ? Duration(milliseconds: restoredLoopA) : null;
      loopB = restoredLoopB >= 0 ? Duration(milliseconds: restoredLoopB) : null;
    });
  }

  Future<void> saveReadingState() async {
    final preferences = await SharedPreferences.getInstance();
    final key = 'scoreFlow.${widget.document.id}';
    await preferences.setInt('$key.page', page);
    await preferences.setInt('$key.positionMs', audioPosition.inMilliseconds);
    await preferences.setDouble('$key.speed', playbackSpeed);
    await preferences.setString('$key.trackId', activeTrackId);
    await preferences.setInt('$key.loopA', loopA?.inMilliseconds ?? -1);
    await preferences.setInt('$key.loopB', loopB?.inMilliseconds ?? -1);
    await preferences.setBool('$key.autoTrack', autoTrackEnabled);
    await preferences.setString('scoreFlow.lastTitle', widget.document.title);
    await preferences.setInt('scoreFlow.lastPage', page);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    positionSubscription?.cancel();
    annotationCloudSubscription?.cancel();
    annotationSaveTimer?.cancel();
    final pending = pendingAnnotationSave;
    if (pending != null) unawaited(store.saveInk(pending));
    unawaited(audio.dispose());
    unawaited(companionAudio.dispose());
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive ||
        state == AppLifecycleState.detached) {
      unawaited(flushAnnotationSave());
    } else if (state == AppLifecycleState.resumed && !annotate) {
      unawaited(refreshAnnotationsFromCloud());
    }
  }

  String get songTitle =>
      widget.document.title.replaceFirst(RegExp(r'^\d{2}\s*-\s*'), '');

  Future<void> loadTracks() async {
    try {
      const productionId = 'PROD-b0d6edc6-c518-404c-a0a8-29b8a7369ba1';
      final production = FirebaseFirestore.instance
          .collection('productions')
          .doc(productionId);
      var result = await production.collection('tracks').get();
      // Releases made before the sync casing repair wrote the collection as
      // `Tracks`. Administrators can read it during rollout; normal members
      // will simply continue with the correctly cased collection.
      if (result.docs.isEmpty) {
        try {
          result = await production.collection('Tracks').get();
        } catch (_) {}
      }
      final songNumber = int.tryParse(
        RegExp(r'(\d+)$').firstMatch(widget.document.id)?.group(1) ?? '',
      );
      String normalized(String value) =>
          value.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '');
      final allTracks = result.docs
          .map((doc) => {...doc.data(), '_id': doc.id})
          .toList();
      final tracks =
          allTracks.where((track) {
            if (!widget.document.id.startsWith('descendants-song-'))
              return true;
            final scoreId =
                '${track['scoreDocumentId'] ?? track['ScoreDocumentID'] ?? ''}';
            final songKey = '${track['songKey'] ?? track['SongKey'] ?? ''}';
            final order = int.tryParse(
              '${track['sortOrder'] ?? track['SortOrder'] ?? ''}',
            );
            if (scoreId.isNotEmpty) return scoreId == widget.document.id;
            if (songKey.isNotEmpty && songNumber != null)
              return songKey.endsWith(songNumber.toString().padLeft(2, '0'));
            if (order != null && songNumber != null) return order == songNumber;
            return normalized('${track['title'] ?? track['Title'] ?? ''}') ==
                normalized(songTitle);
          }).toList()..sort(
            (a, b) => '${a['trackType'] ?? a['TrackType']}'.compareTo(
              '${b['trackType'] ?? b['TrackType']}',
            ),
          );
      if (!mounted) return;
      Map<String, dynamic>? guide;
      Map<String, dynamic>? practice;
      for (final track in tracks) {
        final type = '${track['trackType'] ?? track['TrackType'] ?? ''}'
            .toLowerCase();
        if (type.contains('guide')) guide ??= track;
        if (type.contains('practice') || type.contains('instrumental'))
          practice ??= track;
      }
      setState(() {
        audioTracks = tracks;
        guideTrack = guide;
        practiceTrack = practice;
      });
      if (tracks.isNotEmpty) {
        final preferences = await SharedPreferences.getInstance();
        final wanted = preferences.getString(
          'scoreFlow.${widget.document.id}.trackId',
        );
        final initial = tracks.where((t) => '${t['_id']}' == wanted);
        if (guide != null || practice != null) {
          await prepareTrackPair(
            preferred: initial.isNotEmpty ? initial.first : null,
          );
        } else {
          await selectTrack(initial.isNotEmpty ? initial.first : tracks.first);
        }
      }
    } catch (e) {
      if (mounted)
        setState(() => trackError = 'Could not load the track library: $e');
    }
  }

  Future<File> validatedTrackFile(Map<String, dynamic> track) async {
    final id = '${track['_id']}';
    final driveId = '${track['driveFileID'] ?? track['DriveFileID'] ?? ''}';
    if (driveId.isEmpty)
      throw StateError('This track has no storage reference.');
    const productionId = 'PROD-b0d6edc6-c518-404c-a0a8-29b8a7369ba1';
    final metadata = await FirebaseFirestore.instance
        .collection('productions')
        .doc(productionId)
        .collection('storageAssets')
        .doc(driveId)
        .get();
    final data = metadata.data();
    final storagePath = '${data?['storagePath'] ?? ''}';
    final expectedBytes = (data?['bytes'] as num?)?.toInt() ?? 0;
    if (storagePath.isEmpty) {
      throw StateError('The Firebase audio index is missing for this track.');
    }
    final directory = await getApplicationDocumentsDirectory();
    final target = File(
      '${directory.path}${Platform.pathSeparator}rehearsal-$id.mp3',
    );
    final valid =
        await target.exists() &&
        await target.length() >= 10000 &&
        (expectedBytes <= 0 || await target.length() == expectedBytes);
    if (valid) return target;
    if (await target.exists()) await target.delete();
    final partial = File('${target.path}.partial');
    if (await partial.exists()) await partial.delete();
    final task = FirebaseStorage.instance.ref(storagePath).writeToFile(partial);
    final subscription = task.snapshotEvents.listen((snapshot) {
      if (!mounted || snapshot.totalBytes <= 0) return;
      setState(() {
        trackDownloadProgress = snapshot.bytesTransferred / snapshot.totalBytes;
        trackLoadStatus =
            'Downloading ${track['trackType'] ?? track['TrackType'] ?? 'track'}';
      });
    });
    try {
      await task;
    } finally {
      await subscription.cancel();
    }
    final received = await partial.length();
    if (received < 10000 || (expectedBytes > 0 && received != expectedBytes)) {
      await partial.delete();
      throw StateError('The audio download was incomplete. Tap retry.');
    }
    return partial.rename(target.path);
  }

  Future<void> prepareTrackPair({Map<String, dynamic>? preferred}) async {
    if (audioLoading) return;
    final primary = guideTrack ?? practiceTrack;
    if (primary == null) return;
    final resume = audioPosition;
    final wasPlaying = audio.playing;
    setState(() {
      audioLoading = true;
      trackError = null;
      trackDownloadProgress = 0;
      trackLoadStatus = 'Preparing rehearsal audio';
      activeTrackId = '${preferred?['_id'] ?? primary['_id']}';
    });
    try {
      final companion = guideTrack != null && practiceTrack != null
          ? (identical(primary, guideTrack) ? practiceTrack! : guideTrack!)
          : null;
      final prepared = await Future.wait([
        validatedTrackFile(primary),
        if (companion != null) validatedTrackFile(companion),
      ]);
      await audio.setFilePath(prepared.first.path);
      if (guideTrack != null && practiceTrack != null) {
        await companionAudio.setFilePath(prepared[1].path);
      } else {
        await companionAudio.stop();
      }
      await Future.wait([
        audio.setSpeed(playbackSpeed),
        companionAudio.setSpeed(playbackSpeed),
      ]);
      final duration = audio.duration ?? Duration.zero;
      final restored = resume < duration ? resume : Duration.zero;
      await Future.wait([audio.seek(restored), companionAudio.seek(restored)]);
      applyMixerVolume();
      await loadAutoTrack(activeTrackId);
      if (wasPlaying) await playPair();
      if (mounted)
        setState(() {
          audioPosition = restored;
          audioDuration = duration;
          trackLoadStatus = 'Guide and practice tracks ready';
          trackDownloadProgress = 1;
        });
    } catch (e) {
      if (mounted) setState(() => trackError = '$e');
    } finally {
      if (mounted) setState(() => audioLoading = false);
    }
  }

  Future<void> selectTrack(Map<String, dynamic> track) async {
    final id = '${track['_id']}';
    final driveId = '${track['driveFileID'] ?? track['DriveFileID'] ?? ''}';
    if (driveId.isEmpty || audioLoading) return;
    final resumePosition = audioPosition;
    final wasPlaying = audio.playing;
    setState(() {
      audioLoading = true;
      activeTrackId = id;
    });
    try {
      final target = await validatedTrackFile(track);
      await audio.setFilePath(target.path);
      await audio.setSpeed(playbackSpeed);
      if (resumePosition > Duration.zero &&
          resumePosition < (audio.duration ?? Duration.zero)) {
        await audio.seek(resumePosition);
      }
      await loadAutoTrack(id);
      if (wasPlaying) await audio.play();
      if (mounted)
        setState(() {
          audioPosition = resumePosition < (audio.duration ?? Duration.zero)
              ? resumePosition
              : Duration.zero;
          audioDuration = audio.duration ?? Duration.zero;
        });
    } catch (e) {
      if (mounted) setState(() => trackError = '$e');
    } finally {
      if (mounted) setState(() => audioLoading = false);
    }
  }

  Future<void> selectTrackVariant(Map<String, dynamic> track) async {
    final type = '${track['trackType'] ?? track['TrackType'] ?? ''}'
        .toLowerCase();
    if (guideTrack != null && practiceTrack != null) {
      setState(() {
        activeTrackId = '${track['_id']}';
        trackBlend = type.contains('guide') ? 0 : 1;
      });
      applyMixerVolume();
      await loadAutoTrack(activeTrackId);
      final preferences = await SharedPreferences.getInstance();
      await preferences.setString(
        'scoreFlow.${widget.document.id}.trackId',
        activeTrackId,
      );
      return;
    }
    await selectTrack(track);
  }

  void applyMixerVolume() {
    final paired = guideTrack != null && practiceTrack != null;
    final guideGain = paired ? math.cos(trackBlend * math.pi / 2) : 1.0;
    final practiceGain = paired ? math.sin(trackBlend * math.pi / 2) : 0.0;
    unawaited(audio.setVolume((masterVolume * guideGain).clamp(0, 1)));
    unawaited(
      companionAudio.setVolume((masterVolume * practiceGain).clamp(0, 1)),
    );
  }

  Future<void> playPair() async {
    if (guideTrack != null && practiceTrack != null)
      unawaited(companionAudio.play());
    unawaited(audio.play());
  }

  Future<void> pausePair() async {
    await Future.wait([audio.pause(), companionAudio.pause()]);
  }

  Future<void> seekPair(Duration target) async {
    final safe = target < Duration.zero ? Duration.zero : target;
    await Future.wait([audio.seek(safe), companionAudio.seek(safe)]);
  }

  Future<void> loadAutoTrack(String trackId) async {
    const productionId = 'PROD-b0d6edc6-c518-404c-a0a8-29b8a7369ba1';
    try {
      final snapshot = await FirebaseFirestore.instance
          .collection('productions')
          .doc(productionId)
          .collection('scoreFlowSync')
          .doc(trackId)
          .get();
      final data = snapshot.data();
      final raw = data?['keyframes'];
      final frames = raw is List
          ? (raw
                .whereType<Map>()
                .map(
                  (item) => _AutoTrackFrame(
                    (item['timeMs'] as num?)?.round() ?? 0,
                    math.max(1, (item['page'] as num?)?.round() ?? 1),
                    ((item['y'] as num?)?.toDouble() ?? 0).clamp(0, 1),
                    math.max(0, (item['holdMs'] as num?)?.round() ?? 0),
                  ),
                )
                .toList()
              ..sort((a, b) => a.timeMs.compareTo(b.timeMs)))
          : <_AutoTrackFrame>[];
      if (!mounted) return;
      final preferences = await SharedPreferences.getInstance();
      setState(() {
        autoTrackFrames = frames;
        autoTrackFrameIndex = -1;
        autoTrackEnabled =
            frames.isNotEmpty &&
            (preferences.getBool('scoreFlow.${widget.document.id}.autoTrack') ??
                false);
      });
    } catch (_) {
      if (mounted)
        setState(() {
          autoTrackFrames = const [];
          autoTrackEnabled = false;
        });
    }
  }

  Future<void> followAutoTrack(Duration position) async {
    if (!controller.isReady || autoTrackFrames.isEmpty || annotate) return;
    var index = -1;
    for (var i = 0; i < autoTrackFrames.length; i++) {
      if (autoTrackFrames[i].timeMs <= position.inMilliseconds)
        index = i;
      else
        break;
    }
    if (index < 0 || index == autoTrackFrameIndex) return;
    autoTrackFrameIndex = index;
    final frame = autoTrackFrames[index];
    if (frame.page > pages) return;
    final pageRect = controller.layout.pageLayouts[frame.page - 1];
    await controller.goToPosition(
      documentOffset: Offset(
        pageRect.left,
        pageRect.top + pageRect.height * frame.y,
      ),
      duration: Duration(milliseconds: readerMode == 'page' ? 230 : 520),
    );
  }

  int? get songNumber => int.tryParse(
    RegExp(r'(\d+)$').firstMatch(widget.document.id)?.group(1) ?? '',
  );

  Future<void> moveSong(int delta) async {
    final number = songNumber;
    if (number == null) return;
    final target = number + delta;
    if (target < 1 || target > scoreFlowSongTitles.length) return;
    await saveReadingState();
    if (!mounted) return;
    Navigator.pushReplacement(
      context,
      PageRouteBuilder(
        transitionDuration: const Duration(milliseconds: 240),
        pageBuilder: (_, animation, __) => AnnotatedDocumentScreen(
          document: productionSongDocument(
            target,
            scoreFlowSongTitles[target - 1],
          ),
          ownerUserId: widget.ownerUserId,
          ownerName: widget.ownerName,
        ),
        transitionsBuilder: (_, animation, __, child) => SlideTransition(
          position:
              Tween(
                begin: Offset(delta > 0 ? 1 : -1, 0),
                end: Offset.zero,
              ).animate(
                CurvedAnimation(parent: animation, curve: Curves.easeOutCubic),
              ),
          child: child,
        ),
      ),
    );
  }

  Future<void> jumpToSong() async {
    final chosen = await showModalBottomSheet<int>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: FractionallySizedBox(
          heightFactor: .88,
          child: ListView.builder(
            itemCount: scoreFlowSongTitles.length + 1,
            itemBuilder: (_, index) => index == 0
                ? const ListTile(
                    title: Text(
                      'Jump to song',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    subtitle: Text(
                      'Move through the complete show without leaving ScoreFlow.',
                    ),
                  )
                : ListTile(
                    selected: index == songNumber,
                    leading: CircleAvatar(
                      child: Text(index.toString().padLeft(2, '0')),
                    ),
                    title: Text(scoreFlowSongTitles[index - 1]),
                    trailing: index == songNumber
                        ? const Icon(Icons.graphic_eq_rounded)
                        : const Icon(Icons.chevron_right_rounded),
                    onTap: () => Navigator.pop(sheetContext, index),
                  ),
          ),
        ),
      ),
    );
    if (chosen == null || chosen == songNumber) return;
    await saveReadingState();
    if (!mounted) return;
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(
        builder: (_) => AnnotatedDocumentScreen(
          document: productionSongDocument(
            chosen,
            scoreFlowSongTitles[chosen - 1],
          ),
          ownerUserId: widget.ownerUserId,
          ownerName: widget.ownerName,
        ),
      ),
    );
  }

  void beginAnnotationNavigation(Offset globalFocalPoint) {
    if (!controller.isReady) return;
    final local = controller.globalToLocal(globalFocalPoint);
    if (local == null) return;
    controller.stopInteractiveViewerAnimation();
    annotationNavStartMatrix = Matrix4.copy(controller.value);
    annotationNavStartFocal = local;
  }

  void updateAnnotationNavigation(
    Offset globalFocalPoint,
    double relativeScale,
  ) {
    final start = annotationNavStartMatrix, focal = annotationNavStartFocal;
    if (!controller.isReady || start == null || focal == null) return;
    final current = controller.globalToLocal(globalFocalPoint);
    if (current == null) return;
    final scale = relativeScale.clamp(.2, 5.0).toDouble();
    final gesture = Matrix4.identity()
      ..translateByDouble(current.dx, current.dy, 0, 1)
      ..scaleByDouble(scale, scale, 1, 1)
      ..translateByDouble(-focal.dx, -focal.dy, 0, 1);
    controller.value = controller.makeMatrixInSafeRange(gesture * start);
  }

  void endAnnotationNavigation() {
    if (controller.isReady && annotationNavStartMatrix != null) {
      controller.value = controller.makeMatrixInSafeRange(
        controller.value,
        forceClamp: true,
      );
    }
    annotationNavStartMatrix = null;
    annotationNavStartFocal = null;
  }

  PdfPageLayout horizontalPageLayout(
    List<PdfPage> pdfPages,
    PdfViewerParams params,
  ) {
    final height =
        pdfPages.fold<double>(
          0,
          (value, item) => math.max(value, item.height),
        ) +
        params.margin * 2;
    final layouts = <Rect>[];
    var x = params.margin;
    for (final item in pdfPages) {
      layouts.add(
        Rect.fromLTWH(x, (height - item.height) / 2, item.width, item.height),
      );
      x += item.width + params.margin * 2;
    }
    return PdfPageLayout(pageLayouts: layouts, documentSize: Size(x, height));
  }

  String clock(Duration value) {
    final seconds = value.inSeconds;
    return '${seconds ~/ 60}:${(seconds % 60).toString().padLeft(2, '0')}';
  }

  Future<void> load() async {
    try {
      final directory = await getApplicationDocumentsDirectory();
      final target = File(
        '${directory.path}${Platform.pathSeparator}${widget.document.id}.pdf',
      );
      if (!await target.exists() || await target.length() < 100000) {
        if (widget.document.remoteUrl.isNotEmpty) {
          final request = http.Request(
            'GET',
            Uri.parse(widget.document.remoteUrl),
          );
          final response = await request.send();
          if (response.statusCode != 200)
            throw Exception('Score download returned ${response.statusCode}.');
          final sink = target.openWrite();
          var received = 0;
          await for (final chunk in response.stream) {
            sink.add(chunk);
            received += chunk.length;
            if (mounted &&
                response.contentLength != null &&
                response.contentLength! > 0) {
              setState(() => progress = received / response.contentLength!);
            }
          }
          await sink.close();
        } else {
          final task = FirebaseStorage.instance
              .ref(widget.document.storagePath)
              .writeToFile(target);
          task.snapshotEvents.listen((event) {
            if (mounted && event.totalBytes > 0)
              setState(
                () => progress = event.bytesTransferred / event.totalBytes,
              );
          });
          await task;
        }
      }
      final loaded = await Future.wait([store.loadInk(), store.loadLayers()]);
      if (!mounted) return;
      setState(() {
        file = target;
        marks = loaded[0] as List<ScoreInkMark>;
        layers = loaded[1] as List<ScoreAnnotationLayerDefinition>;
        progress = 1;
      });
      startCloudAnnotationSync();
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    }
  }

  void beginEdit() {
    undo.add(List.of(marks));
    if (undo.length > 80) undo.removeAt(0);
    redo.clear();
  }

  void setMarks(List<ScoreInkMark> value) {
    if (!mounted) return;
    setState(() {
      marks = value;
      annotationSyncStatus = 'Saving on device…';
      annotationSyncError = null;
    });
    pendingAnnotationSave = List<ScoreInkMark>.of(value);
    annotationSaveTimer?.cancel();
    annotationSaveTimer = Timer(const Duration(milliseconds: 220), () {
      final pending = pendingAnnotationSave;
      pendingAnnotationSave = null;
      if (pending != null) unawaited(saveAnnotationDraft(pending));
    });
  }

  Future<void> saveAnnotationDraft(List<ScoreInkMark> pending) async {
    final result = await store.saveInk(pending);
    if (!mounted) return;
    setState(() {
      annotationSyncStatus = result.cloudQueued
          ? 'Saved • syncing'
          : result.localSaved
          ? 'Saved on device'
          : 'Save failed';
      annotationSyncError = result.message;
    });
  }

  Future<AnnotationSaveResult> flushAnnotationSave() async {
    annotationSaveTimer?.cancel();
    annotationSaveTimer = null;
    final pending = pendingAnnotationSave;
    pendingAnnotationSave = null;
    if (mounted) {
      setState(() {
        annotationSyncStatus = 'Syncing…';
        annotationSyncError = null;
      });
    }
    final result = await store.saveInk(pending ?? marks, waitForServer: true);
    await store.saveLayers(layers);
    if (mounted) {
      setState(() {
        annotationSyncStatus = result.serverConfirmed
            ? 'Synced'
            : result.localSaved
            ? 'Saved on device'
            : 'Save failed';
        annotationSyncError = result.message;
      });
    }
    return result;
  }

  void startCloudAnnotationSync() {
    annotationCloudSubscription?.cancel();
    annotationCloudSubscription = store.watchInk().listen(
      (cloudMarks) {
        if (!mounted || annotate || pendingAnnotationSave != null) return;
        setState(() {
          marks = cloudMarks;
          annotationSyncStatus = 'Synced';
          annotationSyncError = null;
        });
      },
      onError: (Object error) {
        if (!mounted) return;
        setState(() {
          annotationSyncStatus = 'Cloud unavailable';
          annotationSyncError = '$error';
        });
      },
    );
  }

  Future<void> refreshAnnotationsFromCloud() async {
    final refreshed = await store.loadInk();
    if (!mounted || annotate) return;
    setState(() => marks = refreshed);
  }

  void undoEdit() {
    if (undo.isEmpty) return;
    redo.add(List.of(marks));
    setMarks(undo.removeLast());
  }

  void redoEdit() {
    if (redo.isEmpty) return;
    undo.add(List.of(marks));
    setMarks(redo.removeLast());
  }

  Future<String?> requestText(int _, Offset __) async {
    final input = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Text annotation'),
        content: TextField(controller: input, autofocus: true, maxLines: 3),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, input.text.trim()),
            child: const Text('Place'),
          ),
        ],
      ),
    );
  }

  void transformStart(String id) {
    transformBase = {
      for (final mark in marks.where(
        (m) => selected.contains(m.id) || m.id == id,
      ))
        mark.id: mark,
    };
    beginEdit();
  }

  void transformUpdate(String id, double scale, double rotation) {
    setMarks(
      marks.map((mark) {
        final base = transformBase[mark.id];
        return base == null
            ? mark
            : base.copyWith(
                scale: (base.scale * scale).clamp(.35, 4),
                rotation: base.rotation + rotation,
              );
      }).toList(),
    );
  }

  Future<void> chooseStamp() async {
    final choice = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (context) => SafeArea(
        child: SizedBox(
          height: MediaQuery.sizeOf(context).height * .72,
          child: Column(
            children: [
              const ListTile(
                title: Text(
                  'Music symbols & rehearsal marks',
                  style: TextStyle(fontWeight: FontWeight.w900),
                ),
                subtitle: Text(
                  'Organized by notation family for faster marking.',
                ),
              ),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.all(12),
                  children: [
                    const _SymbolSectionHeading(label: 'REHEARSAL QUICK MARKS'),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: choralAnnotationStamps
                          .map(
                            (label) => ActionChip(
                              label: Text(label),
                              onPressed: () => Navigator.pop(context, label),
                            ),
                          )
                          .toList(),
                    ),
                    for (final category
                        in musicNotationSymbols
                            .map((s) => s.category)
                            .toSet()) ...[
                      _SymbolSectionHeading(label: category.toUpperCase()),
                      GridView.count(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        crossAxisCount: MediaQuery.sizeOf(context).width >= 600
                            ? 6
                            : 4,
                        childAspectRatio: .92,
                        children: musicNotationSymbols
                            .where((s) => s.category == category)
                            .map(
                              (symbol) => InkWell(
                                borderRadius: BorderRadius.circular(14),
                                onTap: () =>
                                    Navigator.pop(context, symbol.token),
                                child: Card(
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Text(
                                        symbol.glyph,
                                        style: TextStyle(
                                          fontFamily: 'Bravura',
                                          fontSize: 29 * symbol.pickerScale,
                                          height: 1,
                                        ),
                                      ),
                                      const SizedBox(height: 5),
                                      Padding(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 3,
                                        ),
                                        child: Text(
                                          symbol.label,
                                          textAlign: TextAlign.center,
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(fontSize: 9),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            )
                            .toList(),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
    if (choice != null)
      setState(() {
        stamp = choice;
        tool = ScoreInkTool.stamp;
        annotate = true;
      });
  }

  Future<void> chooseLayer() async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) => StatefulBuilder(
        builder: (context, refresh) => SafeArea(
          child: SizedBox(
            height: MediaQuery.sizeOf(context).height * .72,
            child: Column(
              children: [
                ListTile(
                  title: const Text(
                    'Annotation Layers',
                    style: TextStyle(fontWeight: FontWeight.w900),
                  ),
                  subtitle: const Text(
                    'Choose the writing layer, visibility, and stacking order.',
                  ),
                  trailing: IconButton.filledTonal(
                    icon: const Icon(Icons.add),
                    tooltip: 'Add layer',
                    onPressed: () async {
                      await addLayer();
                      refresh(() {});
                    },
                  ),
                ),
                Expanded(
                  child: ReorderableListView.builder(
                    padding: const EdgeInsets.all(10),
                    itemCount: layers.length,
                    onReorder: (oldIndex, newIndex) {
                      setState(() {
                        if (newIndex > oldIndex) newIndex--;
                        final item = layers.removeAt(oldIndex);
                        layers.insert(newIndex, item);
                      });
                      unawaited(store.saveLayers(layers));
                      refresh(() {});
                    },
                    itemBuilder: (context, index) {
                      final item = layers[index], active = item.id == layer;
                      return Card(
                        key: ValueKey(item.id),
                        child: ListTile(
                          leading: IconButton(
                            icon: Icon(
                              visibleLayers.contains(item.id)
                                  ? Icons.visibility
                                  : Icons.visibility_off,
                            ),
                            onPressed: () {
                              setState(() {
                                visibleLayers.contains(item.id)
                                    ? visibleLayers.remove(item.id)
                                    : visibleLayers.add(item.id);
                              });
                              refresh(() {});
                            },
                          ),
                          title: Text(
                            item.name,
                            style: TextStyle(
                              fontWeight: active
                                  ? FontWeight.w900
                                  : FontWeight.w600,
                            ),
                          ),
                          subtitle: Text(
                            '${marks.where((mark) => mark.layerId == item.id).length} marks${active ? ' · active writing layer' : ''}',
                          ),
                          onTap: () {
                            setState(() {
                              layer = item.id;
                              visibleLayers.add(item.id);
                            });
                            refresh(() {});
                          },
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              if (active) const Icon(Icons.check_circle),
                              if (!item.builtIn)
                                PopupMenuButton<String>(
                                  onSelected: (action) async {
                                    if (action == 'rename')
                                      await renameLayer(item);
                                    else
                                      await deleteLayer(item);
                                    refresh(() {});
                                  },
                                  itemBuilder: (_) => const [
                                    PopupMenuItem(
                                      value: 'rename',
                                      child: Text('Rename'),
                                    ),
                                    PopupMenuItem(
                                      value: 'delete',
                                      child: Text('Delete layer'),
                                    ),
                                  ],
                                ),
                              const Icon(Icons.drag_handle),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<String?> layerName(String title, [String initial = '']) async {
    final input = TextEditingController(text: initial);
    return showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: TextField(controller: input, autofocus: true, maxLength: 32),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, input.text.trim()),
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  Future<void> addLayer() async {
    final name = await layerName('Add annotation layer');
    if (name == null || name.isEmpty) return;
    final item = ScoreAnnotationLayerDefinition(
      id: 'custom_${DateTime.now().microsecondsSinceEpoch}',
      name: name,
    );
    setState(() {
      layers.add(item);
      layer = item.id;
      visibleLayers.add(item.id);
    });
    await store.saveLayers(layers);
  }

  Future<void> renameLayer(ScoreAnnotationLayerDefinition item) async {
    final name = await layerName('Rename layer', item.name);
    if (name == null || name.isEmpty) return;
    setState(() {
      final index = layers.indexWhere((entry) => entry.id == item.id);
      if (index >= 0)
        layers[index] = ScoreAnnotationLayerDefinition(id: item.id, name: name);
    });
    await store.saveLayers(layers);
  }

  Future<void> deleteLayer(ScoreAnnotationLayerDefinition item) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Delete “${item.name}”?'),
        content: const Text(
          'Marks on this layer will be safely moved to My Notes.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete layer'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    beginEdit();
    setState(() {
      marks = marks
          .map(
            (mark) => mark.layerId == item.id
                ? mark.copyWith(layerId: 'my_notes')
                : mark,
          )
          .toList();
      layers.removeWhere((entry) => entry.id == item.id);
      visibleLayers.remove(item.id);
      if (layer == item.id) layer = 'my_notes';
    });
    await Future.wait([store.saveInk(marks), store.saveLayers(layers)]);
  }

  Future<void> chooseColor() async {
    const choices = [
      Color(0xff000000),
      Color(0xffffffff),
      Color(0xffef4444),
      Color(0xfff97316),
      Color(0xfff59e0b),
      Color(0xfffacc15),
      Color(0xff84cc16),
      Color(0xff22c55e),
      Color(0xff10b981),
      Color(0xff14b8a6),
      Color(0xff06b6d4),
      Color(0xff0ea5e9),
      Color(0xff3b82f6),
      Color(0xff6366f1),
      Color(0xff8b5cf6),
      Color(0xffa855f7),
      Color(0xffd946ef),
      Color(0xffec4899),
      Color(0xff9b1c31),
      Color(0xffff3ec9),
      Color(0xff00e9ff),
      Color(0xff72f58e),
      Color(0xffff7a2c),
      Color(0xfff3c75f),
    ];
    var hsv = HSVColor.fromColor(color);
    final selected = await showModalBottomSheet<Color>(
      context: context,
      isScrollControlled: true,
      builder: (context) => StatefulBuilder(
        builder: (context, refresh) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(
                    'Annotation Colour Studio',
                    style: TextStyle(fontWeight: FontWeight.w900),
                  ),
                  subtitle: Text(
                    'Choose a rehearsal colour or tune the full spectrum.',
                  ),
                ),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: choices
                      .map(
                        (value) => InkWell(
                          onTap: () => Navigator.pop(context, value),
                          borderRadius: BorderRadius.circular(30),
                          child: CircleAvatar(
                            radius: 18,
                            backgroundColor: value,
                            child: value == color
                                ? Icon(
                                    Icons.check,
                                    color: value.computeLuminance() > .5
                                        ? Colors.black
                                        : Colors.white,
                                  )
                                : null,
                          ),
                        ),
                      )
                      .toList(),
                ),
                const SizedBox(height: 18),
                Container(
                  height: 52,
                  decoration: BoxDecoration(
                    color: hsv.toColor(),
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                Slider(
                  value: hsv.hue,
                  min: 0,
                  max: 360,
                  onChanged: (value) => refresh(() => hsv = hsv.withHue(value)),
                ),
                Slider(
                  value: hsv.saturation,
                  onChanged: (value) =>
                      refresh(() => hsv = hsv.withSaturation(value)),
                ),
                Slider(
                  value: hsv.value,
                  onChanged: (value) =>
                      refresh(() => hsv = hsv.withValue(value)),
                ),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: () => Navigator.pop(context, hsv.toColor()),
                    icon: const Icon(Icons.check),
                    label: const Text('Use custom colour'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    if (selected != null) setState(() => color = selected);
  }

  int appearanceColor(dynamic value, int fallback) {
    if (value is num) return value.toInt();
    final text = '$value'.replaceFirst('#', '');
    return int.tryParse(text.length == 6 ? 'ff$text' : text, radix: 16) ??
        fallback;
  }

  Future<void> loadScoreFlowAppearance() async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return;
    try {
      final profile =
          (await FirebaseFirestore.instance
                  .collection('profiles')
                  .doc(uid)
                  .get())
              .data();
      final preferences = profile?['themePreferences'];
      final scoreFlow = preferences is Map ? preferences['scoreFlow'] : null;
      if (scoreFlow is! Map || !mounted) return;
      setState(() {
        scoreFlowPreset = '${scoreFlow['preset'] ?? scoreFlowPreset}';
        scoreFlowPrimary = Color(
          appearanceColor(scoreFlow['primary'], scoreFlowPrimary.toARGB32()),
        );
        scoreFlowSecondary = Color(
          appearanceColor(
            scoreFlow['secondary'],
            scoreFlowSecondary.toARGB32(),
          ),
        );
        scoreFlowSurface = Color(
          appearanceColor(scoreFlow['surface'], scoreFlowSurface.toARGB32()),
        );
        masterVolume =
            ((scoreFlow['masterVolume'] as num?)?.toDouble() ?? masterVolume)
                .clamp(0, 1);
      });
      applyMixerVolume();
    } catch (_) {}
  }

  Future<void> saveScoreFlowAppearance() async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return;
    final reference = FirebaseFirestore.instance
        .collection('profiles')
        .doc(uid);
    final existing = (await reference.get()).data()?['themePreferences'];
    final preferences = existing is Map
        ? Map<String, dynamic>.from(existing)
        : <String, dynamic>{};
    preferences['scoreFlow'] = {
      'preset': scoreFlowPreset,
      'primary': scoreFlowPrimary.toARGB32(),
      'secondary': scoreFlowSecondary.toARGB32(),
      'surface': scoreFlowSurface.toARGB32(),
      'masterVolume': masterVolume,
    };
    await reference.set({
      'themePreferences': preferences,
      'updatedAt': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));
  }

  void applyAppearancePreset(String preset) {
    final colors = switch (preset) {
      'Villain Night' => const [
        Color(0xffa855f7),
        Color(0xffff365b),
        Color(0xff090713),
      ],
      'Auradon Royal' => const [
        Color(0xff2563eb),
        Color(0xfff3c75f),
        Color(0xff071426),
      ],
      'Electric Rehearsal' => const [
        Color(0xff00e9ff),
        Color(0xff72f58e),
        Color(0xff07171d),
      ],
      'Soft Parchment' => const [
        Color(0xff9b1c31),
        Color(0xffb7791f),
        Color(0xff2b2118),
      ],
      'Stage Blackout' => const [
        Color(0xffffb020),
        Color(0xff8b5cf6),
        Color(0xff050506),
      ],
      _ => const [Color(0xffff3ec9), Color(0xff00e9ff), Color(0xff12101f)],
    };
    setState(() {
      scoreFlowPreset = preset;
      scoreFlowPrimary = colors[0];
      scoreFlowSecondary = colors[1];
      scoreFlowSurface = colors[2];
    });
  }

  Future<Color?> pickAppearanceColor(Color initial, String title) async {
    var hsv = HSVColor.fromColor(initial);
    return showModalBottomSheet<Color>(
      context: context,
      builder: (sheetContext) => StatefulBuilder(
        builder: (_, refresh) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 14),
                Container(
                  height: 54,
                  decoration: BoxDecoration(
                    color: hsv.toColor(),
                    borderRadius: BorderRadius.circular(18),
                  ),
                ),
                Slider(
                  value: hsv.hue,
                  min: 0,
                  max: 360,
                  onChanged: (v) => refresh(() => hsv = hsv.withHue(v)),
                ),
                Slider(
                  value: hsv.saturation,
                  onChanged: (v) => refresh(() => hsv = hsv.withSaturation(v)),
                ),
                Slider(
                  value: hsv.value,
                  onChanged: (v) => refresh(() => hsv = hsv.withValue(v)),
                ),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: () => Navigator.pop(sheetContext, hsv.toColor()),
                    child: const Text('USE COLOUR'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> showScoreFlowAppearance() async {
    const presets = [
      'Descendants Neon',
      'Villain Night',
      'Auradon Royal',
      'Electric Rehearsal',
      'Stage Blackout',
      'Soft Parchment',
    ];
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) => StatefulBuilder(
        builder: (_, refresh) => SafeArea(
          child: FractionallySizedBox(
            heightFactor: .88,
            child: ListView(
              padding: const EdgeInsets.all(18),
              children: [
                const Text(
                  'ScoreFlow Appearance Studio',
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900),
                ),
                const Text(
                  'Style the rehearsal frame and player without changing the score itself.',
                ),
                const SizedBox(height: 18),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: presets
                      .map(
                        (preset) => ChoiceChip(
                          selected: scoreFlowPreset == preset,
                          label: Text(preset),
                          onSelected: (_) {
                            applyAppearancePreset(preset);
                            refresh(() {});
                          },
                        ),
                      )
                      .toList(),
                ),
                const SizedBox(height: 22),
                for (final item in [
                  ('Primary glow', scoreFlowPrimary, 0),
                  ('Secondary glow', scoreFlowSecondary, 1),
                  ('Player surface', scoreFlowSurface, 2),
                ])
                  ListTile(
                    leading: CircleAvatar(backgroundColor: item.$2),
                    title: Text(item.$1),
                    trailing: const Icon(Icons.tune_rounded),
                    onTap: () async {
                      final selected = await pickAppearanceColor(
                        item.$2,
                        item.$1,
                      );
                      if (selected == null) return;
                      setState(() {
                        scoreFlowPreset = 'Custom';
                        if (item.$3 == 0) scoreFlowPrimary = selected;
                        if (item.$3 == 1) scoreFlowSecondary = selected;
                        if (item.$3 == 2) scoreFlowSurface = selected;
                      });
                      refresh(() {});
                    },
                  ),
                const SizedBox(height: 10),
                Text('Master volume ${(masterVolume * 100).round()}%'),
                Slider(
                  value: masterVolume,
                  onChanged: (value) {
                    setState(() => masterVolume = value);
                    applyMixerVolume();
                    refresh(() {});
                  },
                ),
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    icon: const Icon(Icons.cloud_done_rounded),
                    label: const Text('SAVE TO MY ACCOUNT'),
                    onPressed: () async {
                      await saveScoreFlowAppearance();
                      if (sheetContext.mounted) Navigator.pop(sheetContext);
                    },
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> navigator() async {
    final annotated = marks.map((m) => m.page).toSet().toList()..sort();
    final target = await showModalBottomSheet<int>(
      context: context,
      builder: (context) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          children: [
            const ListTile(
              title: Text(
                'Annotation Navigator',
                style: TextStyle(fontWeight: FontWeight.w900),
              ),
            ),
            ...annotated.map(
              (p) => ListTile(
                title: Text('Page $p'),
                trailing: Text(
                  '${marks.where((m) => m.page == p).length} marks',
                ),
                onTap: () => Navigator.pop(context, p),
              ),
            ),
          ],
        ),
      ),
    );
    if (target != null) await controller.goToPage(pageNumber: target);
  }

  Widget rehearsalPlayer() {
    final maxMs = audioDuration.inMilliseconds > 0
        ? audioDuration.inMilliseconds.toDouble()
        : 1.0;
    final positionMs = audioPosition.inMilliseconds
        .clamp(0, maxMs.toInt())
        .toDouble();
    return GestureDetector(
      onVerticalDragEnd: (details) {
        final velocity = details.primaryVelocity ?? 0;
        if (velocity > 180) setState(() => playerCollapsed = true);
        if (velocity < -180) setState(() => playerCollapsed = false);
      },
      child: SafeArea(
        top: false,
        child: Material(
          elevation: 18,
          color: Colors.transparent,
          child: AnimatedSize(
            duration: const Duration(milliseconds: 220),
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    scoreFlowSurface,
                    Color.lerp(scoreFlowSurface, scoreFlowPrimary, .3)!,
                  ],
                ),
                border: Border(
                  top: BorderSide(
                    color: scoreFlowSecondary.withValues(alpha: .55),
                  ),
                ),
              ),
              child: DefaultTextStyle.merge(
                style: const TextStyle(color: Colors.white),
                child: IconTheme.merge(
                  data: const IconThemeData(color: Colors.white),
                  child: playerCollapsed
                      ? ListTile(
                          dense: true,
                          leading: StreamBuilder<bool>(
                            stream: audio.playingStream,
                            builder: (_, state) => IconButton.filled(
                              onPressed: audioTracks.isEmpty
                                  ? null
                                  : () => state.data == true
                                        ? pausePair()
                                        : playPair(),
                              icon: Icon(
                                state.data == true
                                    ? Icons.pause_rounded
                                    : Icons.play_arrow_rounded,
                              ),
                            ),
                          ),
                          title: Text(
                            audioTracks.isEmpty
                                ? 'No rehearsal track assigned'
                                : widget.document.id.startsWith(
                                    'descendants-song-',
                                  )
                                ? songTitle
                                : 'Rehearsal player',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          subtitle: Text(
                            '${clock(audioPosition)} / ${clock(audioDuration)}',
                          ),
                          trailing: IconButton(
                            icon: const Icon(Icons.expand_less_rounded),
                            onPressed: () =>
                                setState(() => playerCollapsed = false),
                          ),
                        )
                      : Padding(
                          padding: const EdgeInsets.fromLTRB(12, 5, 12, 8),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                width: 42,
                                height: 4,
                                decoration: BoxDecoration(
                                  color: Theme.of(context)
                                      .colorScheme
                                      .outlineVariant,
                                  borderRadius: BorderRadius.circular(4),
                                ),
                              ),
                              Row(
                                children: [
                                  Expanded(
                                    child: DropdownButtonHideUnderline(
                                      child: DropdownButton<String>(
                                        isExpanded: true,
                                        value: activeTrackId.isEmpty
                                            ? null
                                            : activeTrackId,
                                        hint: Text(
                                          audioLoading
                                              ? 'Preparing rehearsal track...'
                                              : 'Choose rehearsal track',
                                        ),
                                        items: audioTracks
                                            .map(
                                              (track) => DropdownMenuItem(
                                                value: '${track['_id']}',
                                                child: Text(
                                                  '${track['trackType'] ?? track['TrackType'] ?? 'Track'}',
                                                  overflow:
                                                      TextOverflow.ellipsis,
                                                ),
                                              ),
                                            )
                                            .toList(),
                                        onChanged: (id) {
                                          final match = audioTracks.where(
                                            (item) => '${item['_id']}' == id,
                                          );
                                          if (match.isNotEmpty) {
                                            unawaited(
                                              selectTrackVariant(match.first),
                                            );
                                          }
                                        },
                                      ),
                                    ),
                                  ),
                                  IconButton(
                                    tooltip: 'ScoreFlow appearance',
                                    onPressed: showScoreFlowAppearance,
                                    icon: const Icon(Icons.palette_outlined),
                                  ),
                                  IconButton(
                                    tooltip: 'Collapse player',
                                    onPressed: () =>
                                        setState(() => playerCollapsed = true),
                                    icon: const Icon(Icons.expand_more_rounded),
                                  ),
                                ],
                              ),
                              if (guideTrack != null &&
                                  practiceTrack != null) ...[
                                Row(
                                  children: [
                                    const Text(
                                      'Guide',
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                    Expanded(
                                      child: Slider(
                                        value: trackBlend,
                                        activeColor: scoreFlowSecondary,
                                        inactiveColor: scoreFlowPrimary,
                                        onChanged: (value) {
                                          setState(() => trackBlend = value);
                                          applyMixerVolume();
                                        },
                                      ),
                                    ),
                                    const Text(
                                      'Practice',
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                              Row(
                                children: [
                                  const Icon(Icons.volume_down_rounded),
                                  Expanded(
                                    child: Slider(
                                      value: masterVolume,
                                      activeColor: scoreFlowPrimary,
                                      onChanged: (value) {
                                        setState(() => masterVolume = value);
                                        applyMixerVolume();
                                      },
                                    ),
                                  ),
                                  Text('${(masterVolume * 100).round()}%'),
                                ],
                              ),
                              if (audioLoading) ...[
                                LinearProgressIndicator(
                                  value: trackDownloadProgress > 0
                                      ? trackDownloadProgress
                                      : null,
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  trackLoadStatus,
                                  style: const TextStyle(fontSize: 11),
                                ),
                              ],
                              if (trackError != null)
                                MaterialBanner(
                                  backgroundColor: Colors.red.shade900,
                                  content: Text(
                                    trackError!,
                                    style: const TextStyle(color: Colors.white),
                                  ),
                                  actions: [
                                    TextButton(
                                      onPressed: prepareTrackPair,
                                      child: const Text('RETRY'),
                                    ),
                                  ],
                                ),
                              Slider(
                                value: positionMs,
                                max: maxMs,
                                onChanged: audioDuration > Duration.zero
                                    ? (value) => seekPair(
                                        Duration(milliseconds: value.round()),
                                      )
                                    : null,
                              ),
                              Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    clock(audioPosition),
                                    style: const TextStyle(fontSize: 11),
                                  ),
                                  Text(
                                    clock(audioDuration),
                                    style: const TextStyle(fontSize: 11),
                                  ),
                                ],
                              ),
                              Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceEvenly,
                                children: [
                                  IconButton(
                                    tooltip: 'Back 10 seconds',
                                    onPressed: () => seekPair(
                                      audioPosition -
                                          const Duration(seconds: 10),
                                    ),
                                    icon: const Icon(Icons.replay_10_rounded),
                                  ),
                                  StreamBuilder<bool>(
                                    stream: audio.playingStream,
                                    builder: (_, state) => IconButton.filled(
                                      onPressed: audioTracks.isEmpty
                                          ? null
                                          : () => state.data == true
                                                ? pausePair()
                                                : playPair(),
                                      iconSize: 30,
                                      icon: Icon(
                                        state.data == true
                                            ? Icons.pause_rounded
                                            : Icons.play_arrow_rounded,
                                      ),
                                    ),
                                  ),
                                  IconButton(
                                    tooltip: autoTrackFrames.isEmpty
                                        ? 'No AutoTrack map published'
                                        : autoTrackEnabled
                                        ? 'Pause AutoTrack'
                                        : 'Follow score with music',
                                    onPressed: autoTrackFrames.isEmpty
                                        ? null
                                        : () {
                                            setState(
                                              () => autoTrackEnabled =
                                                  !autoTrackEnabled,
                                            );
                                            autoTrackFrameIndex = -1;
                                            unawaited(saveReadingState());
                                            if (autoTrackEnabled)
                                              unawaited(
                                                followAutoTrack(audioPosition),
                                              );
                                          },
                                    icon: Icon(
                                      autoTrackEnabled
                                          ? Icons.auto_mode_rounded
                                          : Icons.sync_rounded,
                                      color: autoTrackEnabled
                                          ? Theme.of(context)
                                                .colorScheme
                                                .tertiary
                                          : null,
                                    ),
                                  ),
                                  IconButton(
                                    tooltip: 'Forward 10 seconds',
                                    onPressed: () => seekPair(
                                      audioPosition +
                                          const Duration(seconds: 10),
                                    ),
                                    icon: const Icon(Icons.forward_10_rounded),
                                  ),
                                  PopupMenuButton<double>(
                                    tooltip: 'Playback speed',
                                    initialValue: playbackSpeed,
                                    onSelected: (value) {
                                      setState(() => playbackSpeed = value);
                                      unawaited(audio.setSpeed(value));
                                      unawaited(companionAudio.setSpeed(value));
                                    },
                                    itemBuilder: (_) =>
                                        [.75, .85, 1.0, 1.15, 1.25]
                                            .map(
                                              (value) => PopupMenuItem(
                                                value: value,
                                                child: Text('${value}x'),
                                              ),
                                            )
                                            .toList(),
                                    child: Padding(
                                      padding: const EdgeInsets.all(10),
                                      child: Text(
                                        '${playbackSpeed}x',
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                                    ),
                                  ),
                                  IconButton(
                                    tooltip: loopA == null
                                        ? 'Set loop start'
                                        : loopB == null
                                        ? 'Set loop end'
                                        : 'Clear loop',
                                    onPressed: () {
                                      setState(() {
                                        if (loopA == null) {
                                          loopA = audioPosition;
                                        } else if (loopB == null &&
                                            audioPosition > loopA!) {
                                          loopB = audioPosition;
                                        } else {
                                          loopA = null;
                                          loopB = null;
                                        }
                                      });
                                    },
                                    icon: Icon(
                                      Icons.repeat_rounded,
                                      color: loopA != null
                                          ? Theme.of(context)
                                                .colorScheme
                                                .primary
                                          : null,
                                    ),
                                  ),
                                ],
                              ),
                              if (loopA != null)
                                Text(
                                  loopB == null
                                      ? 'Loop start ${clock(loopA!)} - move to the end and tap loop again'
                                      : 'Looping ${clock(loopA!)} - ${clock(loopB!)}',
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: Theme.of(context)
                                        .colorScheme
                                        .primary,
                                  ),
                                ),
                            ],
                          ),
                        ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      leading: IconButton(
        tooltip: 'Previous song',
        onPressed: (songNumber ?? 1) > 1
            ? () => moveSong(-1)
            : () => Navigator.maybePop(context),
        icon: Icon(
          (songNumber ?? 1) > 1
              ? Icons.skip_previous_rounded
              : Icons.arrow_back_rounded,
        ),
      ),
      title: InkWell(
        onTap: songNumber == null ? null : jumpToSong,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 5),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Flexible(
                child: Text(
                  widget.document.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (songNumber != null) const Icon(Icons.arrow_drop_down_rounded),
            ],
          ),
        ),
      ),
      actions: [
        IconButton(
          tooltip: annotationSyncError == null
              ? annotationSyncStatus
              : '$annotationSyncStatus\n$annotationSyncError',
          onPressed: annotationSyncError == null
              ? null
              : () => ScaffoldMessenger.of(
                  context,
                ).showSnackBar(SnackBar(content: Text(annotationSyncError!))),
          icon: Icon(
            annotationSyncError != null
                ? Icons.cloud_off_outlined
                : annotationSyncStatus == 'Synced'
                ? Icons.cloud_done_outlined
                : Icons.cloud_sync_outlined,
          ),
        ),
        if (administrator)
          IconButton(
            tooltip: widget.ownerName == null
                ? 'Review singer annotations'
                : 'Reviewing ${widget.ownerName}',
            onPressed: chooseAnnotationOwner,
            icon: const Icon(Icons.supervisor_account_outlined),
          ),
        if (songNumber != null)
          IconButton(
            tooltip: 'Next song',
            onPressed: songNumber! < scoreFlowSongTitles.length
                ? () => moveSong(1)
                : null,
            icon: const Icon(Icons.skip_next_rounded),
          ),
        if (readerMode == 'page')
          IconButton(
            tooltip: 'Previous page',
            onPressed: page > 1
                ? () => controller.goToPage(
                    pageNumber: page - 1,
                    duration: const Duration(milliseconds: 200),
                  )
                : null,
            icon: const Icon(Icons.chevron_left),
          ),
        if (readerMode == 'page')
          IconButton(
            tooltip: 'Next page',
            onPressed: page < pages
                ? () => controller.goToPage(
                    pageNumber: page + 1,
                    duration: const Duration(milliseconds: 200),
                  )
                : null,
            icon: const Icon(Icons.chevron_right),
          ),
        PopupMenuButton<String>(
          tooltip: 'Reader mode',
          icon: const Icon(Icons.chrome_reader_mode_outlined),
          onSelected: (value) async {
            setState(() => readerMode = value);
            await Future<void>.delayed(const Duration(milliseconds: 50));
            if (!controller.isReady) return;
            controller.invalidate();
            if (value == 'fit-page') {
              await controller.setZoom(
                controller.viewSize.center(Offset.zero),
                controller.alternativeFitScale ?? controller.minScale,
              );
            } else if (value == 'fit-width') {
              await controller.setZoom(
                controller.viewSize.center(Offset.zero),
                controller.coverScale,
              );
            } else if (value == 'page') {
              await controller.goToPage(
                pageNumber: page,
                duration: const Duration(milliseconds: 200),
              );
            }
          },
          itemBuilder: (_) => const [
            PopupMenuItem(
              value: 'continuous',
              child: ListTile(
                leading: Icon(Icons.view_stream),
                title: Text('Continuous Scroll'),
              ),
            ),
            PopupMenuItem(
              value: 'page',
              child: ListTile(
                leading: Icon(Icons.menu_book),
                title: Text('Page Turn'),
              ),
            ),
            PopupMenuItem(
              value: 'fit-width',
              child: ListTile(
                leading: Icon(Icons.fit_screen),
                title: Text('Fit Width'),
              ),
            ),
            PopupMenuItem(
              value: 'fit-page',
              child: ListTile(
                leading: Icon(Icons.fullscreen),
                title: Text('Fit Page'),
              ),
            ),
          ],
        ),
        IconButton(
          onPressed: navigator,
          tooltip: 'Annotation Navigator',
          icon: const Icon(Icons.map_outlined),
        ),
      ],
    ),
    bottomNavigationBar: rehearsalPlayer(),
    body: file == null
        ? Center(
            child: error != null
                ? Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(
                      'Could not prepare this rehearsal document.\n$error',
                      textAlign: TextAlign.center,
                    ),
                  )
                : Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      CircularProgressIndicator(
                        value: progress == 0 ? null : progress,
                      ),
                      const SizedBox(height: 14),
                      Text(
                        progress == 0
                            ? 'Preparing secure download…'
                            : 'Preparing ${(progress * 100).round()}%',
                      ),
                    ],
                  ),
          )
        : Column(
            children: [
              if (annotate) _toolbar(),
              Expanded(
                child: PdfViewer.file(
                  file!.path,
                  controller: controller,
                  initialPageNumber: page,
                  params: PdfViewerParams(
                    margin: 8,
                    backgroundColor: const Color(0xffd8d6d0),
                    layoutPages: readerMode == 'page'
                        ? horizontalPageLayout
                        : null,
                    textSelectionParams: PdfTextSelectionParams(
                      enabled: !annotate,
                    ),
                    onViewerReady: (document, _) {
                      if (mounted)
                        setState(() => pages = document.pages.length);
                    },
                    onPageChanged: (value) {
                      if (mounted && value != null) {
                        setState(() => page = value);
                        unawaited(saveReadingState());
                      }
                    },
                    pageOverlaysBuilder: (context, rect, pdfPage) => [
                      Positioned.fill(
                        child: ScoreAnnotationLayer(
                          enabled: annotate,
                          page: pdfPage.pageNumber,
                          marks: marks,
                          tool: tool,
                          color: color,
                          stamp: stamp,
                          activeLayerId: layer,
                          visibleLayers: visibleLayers,
                          widthFactor: width,
                          opacity: opacity,
                          stylusOnly: stylusOnly,
                          onMarksChanged: setMarks,
                          onTextRequested: requestText,
                          onEditStart: beginEdit,
                          selectedMarkId: selected.length == 1
                              ? selected.first
                              : null,
                          selectedMarkIds: selected,
                          onSelectionChanged: (id) {
                            if (mounted)
                              setState(() => selected = id == null ? {} : {id});
                          },
                          onSelectionSetChanged: (ids) {
                            if (mounted) setState(() => selected = ids);
                          },
                          onNavigateStart: beginAnnotationNavigation,
                          onNavigateUpdate: updateAnnotationNavigation,
                          onNavigateEnd: endAnnotationNavigation,
                          onSelectedTransformStart: transformStart,
                          onSelectedTransformUpdate: transformUpdate,
                          onSelectedTransformEnd: (_) =>
                              unawaited(store.saveInk(marks)),
                        ),
                      ),
                      if (!annotate && readerMode == 'page') ...[
                        Positioned(
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: 54,
                          child: Semantics(
                            button: true,
                            label: 'Previous page',
                            child: GestureDetector(
                              behavior: HitTestBehavior.translucent,
                              onTap: page > 1
                                  ? () => controller.goToPage(
                                      pageNumber: page - 1,
                                      duration: const Duration(
                                        milliseconds: 230,
                                      ),
                                    )
                                  : null,
                            ),
                          ),
                        ),
                        Positioned(
                          right: 0,
                          top: 0,
                          bottom: 0,
                          width: 54,
                          child: Semantics(
                            button: true,
                            label: 'Next page',
                            child: GestureDetector(
                              behavior: HitTestBehavior.translucent,
                              onTap: page < pages
                                  ? () => controller.goToPage(
                                      pageNumber: page + 1,
                                      duration: const Duration(
                                        milliseconds: 230,
                                      ),
                                    )
                                  : null,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
    floatingActionButton: file == null
        ? null
        : FloatingActionButton.small(
            onPressed: () async {
              if (annotate) {
                final result = await flushAnnotationSave();
                if (mounted && !result.serverConfirmed) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                        result.message ?? 'Saved on this device. Cloud sync is still pending.',
                      ),
                    ),
                  );
                }
              }
              if (mounted) setState(() => annotate = !annotate);
            },
            tooltip: annotate ? 'Finish annotating' : 'Annotate score',
            child: Icon(
              annotate ? Icons.visibility_rounded : Icons.edit_rounded,
            ),
          ),
  );

  Widget _toolbar() => Material(
    color: Theme.of(context).colorScheme.surface,
    child: SizedBox(
      height: 54,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        children: [
          _tool(ScoreInkTool.move, 'selector', 'Select'),
          _tool(ScoreInkTool.pen, 'pen', 'Pen'),
          _tool(ScoreInkTool.highlighter, 'highlighter', 'Highlighter'),
          _tool(ScoreInkTool.navigate, 'fit-view', 'Pan / fit view'),
          _tool(ScoreInkTool.lasso, 'lasso', 'Lasso'),
          _tool(ScoreInkTool.eraser, 'eraser', 'Eraser'),
          _tool(ScoreInkTool.line, 'line', 'Line'),
          _tool(ScoreInkTool.arrow, 'arrow', 'Arrow'),
          _tool(ScoreInkTool.rectangle, 'rectangle', 'Rectangle'),
          _tool(ScoreInkTool.ellipse, 'ellipse', 'Ellipse'),
          _tool(ScoreInkTool.text, 'text', 'Text'),
          IconButton.filledTonal(
            onPressed: chooseStamp,
            tooltip: 'Symbols',
            icon: const _AnnotationToolIcon(name: 'music-symbols'),
          ),
          IconButton(
            onPressed: chooseLayer,
            tooltip: 'Layers',
            icon: const _AnnotationToolIcon(name: 'layers'),
          ),
          IconButton(
            tooltip: 'Colour Studio',
            icon: Icon(Icons.palette, color: color),
            onPressed: chooseColor,
          ),
          IconButton(
            onPressed: undo.isEmpty ? null : undoEdit,
            tooltip: 'Undo',
            icon: const Icon(Icons.undo),
          ),
          IconButton(
            onPressed: redo.isEmpty ? null : redoEdit,
            tooltip: 'Redo',
            icon: const Icon(Icons.redo),
          ),
          IconButton(
            onPressed: () {
              beginEdit();
              setMarks(
                marks
                    .where((m) => m.page != page || m.layerId != layer)
                    .toList(),
              );
            },
            tooltip: 'Clear active layer on page',
            icon: const Icon(Icons.delete_sweep),
          ),
        ],
      ),
    ),
  );

  Widget _tool(ScoreInkTool value, String icon, String label) =>
      IconButton.filledTonal(
        onPressed: () => setState(() => tool = value),
        tooltip: label,
        isSelected: tool == value,
        icon: _AnnotationToolIcon(name: icon),
      );
}

class _AnnotationToolIcon extends StatelessWidget {
  const _AnnotationToolIcon({required this.name});
  final String name;

  @override
  Widget build(BuildContext context) => SvgPicture.asset(
    'assets/icons/annotation/$name.svg',
    width: 23,
    height: 23,
    colorFilter: ColorFilter.mode(
      IconTheme.of(context).color ?? Theme.of(context).colorScheme.onSurface,
      BlendMode.srcIn,
    ),
  );
}

class _SymbolSectionHeading extends StatelessWidget {
  const _SymbolSectionHeading({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(4, 16, 4, 8),
    child: Text(
      label,
      style: TextStyle(
        color: Theme.of(context).colorScheme.primary,
        fontWeight: FontWeight.w900,
        fontSize: 11,
        letterSpacing: .8,
      ),
    ),
  );
}
