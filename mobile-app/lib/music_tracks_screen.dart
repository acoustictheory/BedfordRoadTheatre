import 'dart:async';

import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';

import 'annotation/document_reader.dart';
import 'offline_media.dart';

class MusicTracksScreen extends StatefulWidget {
  const MusicTracksScreen({super.key});
  @override
  State<MusicTracksScreen> createState() => _MusicTracksScreenState();
}

class _MusicTracksScreenState extends State<MusicTracksScreen> {
  final player = AudioPlayer();
  final media = OfflineMedia.instance;
  List<BundledTrack> tracks = [];
  BundledTrack? current;
  StreamSubscription<PlayerState>? stateSubscription;
  String search = '', type = 'All';
  String? error;
  bool loading = true, preparing = false, repeat = false;
  double speed = 1;
  @override
  void initState() {
    super.initState();
    load();
    stateSubscription = player.playerStateStream.listen((_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    stateSubscription?.cancel();
    unawaited(player.dispose());
    super.dispose();
  }

  Future<void> load() async {
    try {
      final rows = await media.tracks();
      if (mounted) {
        setState(() {
          tracks = rows;
          loading = false;
          error = null;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          error = '$e';
          loading = false;
        });
      }
    }
  }

  List<BundledTrack> get visible => tracks
      .where(
        (track) =>
            (type == 'All' || track.type == type) &&
            '${track.title} ${track.type} ${track.order}'
                .toLowerCase()
                .contains(search.toLowerCase()),
      )
      .toList();

  Future<void> choose(BundledTrack track) async {
    if (preparing) return;
    setState(() {
      preparing = true;
      error = null;
      current = track;
    });
    try {
      await player.pause();
      final file = await media.file(track.assetKey);
      if (!mounted) return;
      await player.setFilePath(file.path);
      await player.setSpeed(speed);
      await player.setLoopMode(repeat ? LoopMode.one : LoopMode.off);
      if (!mounted) return;
      play();
    } catch (e) {
      if (mounted) {
        setState(() {
          error = 'Could not open this bundled track: $e';
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          preparing = false;
        });
      }
    }
  }

  void play() {
    unawaited(
      player.play().catchError((Object e) {
        if (mounted) {
          setState(() {
            error = 'Playback failed: $e';
          });
        }
      }),
    );
  }

  Future<void> toggle() async {
    if (current == null || preparing) return;
    if (player.playing) {
      await player.pause();
    } else {
      if (player.processingState == ProcessingState.completed) {
        await player.seek(Duration.zero);
      }
      play();
    }
  }

  Future<void> seek(Duration value) async {
    final maximum = player.duration ?? Duration.zero;
    await player.seek(
      value < Duration.zero
          ? Duration.zero
          : value > maximum
          ? maximum
          : value,
    );
  }

  void move(int delta) {
    final rows = tracks.where((t) => t.type == current?.type).toList();
    final index = rows.indexWhere((t) => t.id == current?.id) + delta;
    if (index >= 0 && index < rows.length) unawaited(choose(rows[index]));
  }

  Future<void> openScore(BundledTrack track) async {
    await player.pause();
    if (!mounted) return;
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => AnnotatedDocumentScreen(
          document: productionSongDocument(track.order, track.title),
        ),
      ),
    );
  }

  String clock(Duration value) =>
      '${value.inMinutes}:${(value.inSeconds % 60).toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Music & Tracks'),
      actions: [
        IconButton(
          tooltip: 'ScoreFlow library',
          icon: const Icon(Icons.menu_book_outlined),
          onPressed: () async {
            await player.pause();
            if (context.mounted) {
              await Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => const DocumentLibraryScreen(),
                ),
              );
            }
          },
        ),
      ],
    ),
    body: loading
        ? const Center(child: CircularProgressIndicator())
        : Column(
            children: [
              if (error != null)
                MaterialBanner(
                  content: Text(error!),
                  actions: [
                    TextButton(
                      onPressed: tracks.isEmpty
                          ? load
                          : () {
                              final track = current;
                              if (track != null) choose(track);
                            },
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${tracks.length} tracks included • Ready offline',
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      decoration: const InputDecoration(
                        prefixIcon: Icon(Icons.search),
                        hintText: 'Search songs',
                      ),
                      onChanged: (text) => setState(() {
                        search = text;
                      }),
                    ),
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: [
                          for (final label in [
                            'All',
                            ...tracks.map((t) => t.type).toSet(),
                          ])
                            Padding(
                              padding: const EdgeInsets.only(right: 8),
                              child: ChoiceChip(
                                label: Text(label),
                                selected: type == label,
                                onSelected: (_) => setState(() {
                                  type = label;
                                }),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: visible.isEmpty
                    ? const Center(child: Text('No matching tracks.'))
                    : ListView.builder(
                        itemCount: visible.length,
                        itemBuilder: (context, index) {
                          final track = visible[index];
                          return ListTile(
                            selected: current?.id == track.id,
                            leading: CircleAvatar(
                              child: Text('${track.order}'),
                            ),
                            title: Text(track.title),
                            subtitle: Text('${track.type} • Included in app'),
                            trailing: IconButton(
                              tooltip: 'Open in ScoreFlow',
                              icon: const Icon(Icons.library_music_outlined),
                              onPressed: preparing
                                  ? null
                                  : () => openScore(track),
                            ),
                            onTap: preparing ? null : () => choose(track),
                          );
                        },
                      ),
              ),
              if (current != null)
                SafeArea(
                  top: false,
                  child: Card(
                    margin: const EdgeInsets.fromLTRB(12, 4, 12, 8),
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child:
                          MediaQuery.sizeOf(context).height -
                                  MediaQuery.viewInsetsOf(context).bottom <
                              600
                          ? Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    '${current!.title} ? ${current!.type}',
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                if (preparing)
                                  const SizedBox(
                                    width: 24,
                                    height: 24,
                                    child: CircularProgressIndicator(),
                                  )
                                else
                                  IconButton(
                                    tooltip: player.playing ? 'Pause' : 'Play',
                                    onPressed: toggle,
                                    icon: Icon(
                                      player.playing
                                          ? Icons.pause
                                          : Icons.play_arrow,
                                    ),
                                  ),
                                IconButton(
                                  tooltip: 'Open ScoreFlow',
                                  onPressed: preparing
                                      ? null
                                      : () => openScore(current!),
                                  icon: const Icon(Icons.menu_book),
                                ),
                              ],
                            )
                          : Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  '${current!.title} — ${current!.type}',
                                  textAlign: TextAlign.center,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                if (preparing) const LinearProgressIndicator(),
                                StreamBuilder<Duration>(
                                  stream: player.positionStream,
                                  initialData: Duration.zero,
                                  builder: (context, snapshot) {
                                    final duration =
                                        player.duration ?? Duration.zero;
                                    final position =
                                        snapshot.data ?? Duration.zero;
                                    return Column(
                                      children: [
                                        Slider(
                                          value: position.inMilliseconds
                                              .toDouble()
                                              .clamp(
                                                0,
                                                duration.inMilliseconds
                                                    .toDouble(),
                                              ),
                                          max: duration.inMilliseconds > 0
                                              ? duration.inMilliseconds
                                                    .toDouble()
                                              : 1,
                                          onChanged:
                                              preparing ||
                                                  duration == Duration.zero
                                              ? null
                                              : (v) => seek(
                                                  Duration(
                                                    milliseconds: v.round(),
                                                  ),
                                                ),
                                        ),
                                        Row(
                                          mainAxisAlignment:
                                              MainAxisAlignment.spaceBetween,
                                          children: [
                                            Text(clock(position)),
                                            Text(clock(duration)),
                                          ],
                                        ),
                                      ],
                                    );
                                  },
                                ),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    IconButton(
                                      tooltip: 'Previous song',
                                      onPressed: preparing
                                          ? null
                                          : () => move(-1),
                                      icon: const Icon(Icons.skip_previous),
                                    ),
                                    IconButton(
                                      tooltip: 'Back 10 seconds',
                                      onPressed: preparing
                                          ? null
                                          : () => seek(
                                              player.position -
                                                  const Duration(seconds: 10),
                                            ),
                                      icon: const Icon(Icons.replay_10),
                                    ),
                                    IconButton.filled(
                                      tooltip: player.playing
                                          ? 'Pause'
                                          : 'Play',
                                      onPressed: preparing ? null : toggle,
                                      icon: Icon(
                                        player.playing
                                            ? Icons.pause
                                            : Icons.play_arrow,
                                      ),
                                    ),
                                    IconButton(
                                      tooltip: 'Forward 10 seconds',
                                      onPressed: preparing
                                          ? null
                                          : () => seek(
                                              player.position +
                                                  const Duration(seconds: 10),
                                            ),
                                      icon: const Icon(Icons.forward_10),
                                    ),
                                    IconButton(
                                      tooltip: 'Next song',
                                      onPressed: preparing
                                          ? null
                                          : () => move(1),
                                      icon: const Icon(Icons.skip_next),
                                    ),
                                  ],
                                ),
                                Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceEvenly,
                                  children: [
                                    DropdownButton<double>(
                                      value: speed,
                                      items: [.5, .75, 1.0, 1.25, 1.5, 2.0]
                                          .map(
                                            (v) => DropdownMenuItem(
                                              value: v,
                                              child: Text('${v}x'),
                                            ),
                                          )
                                          .toList(),
                                      onChanged: preparing
                                          ? null
                                          : (v) async {
                                              await player.setSpeed(v!);
                                              if (mounted) {
                                                setState(() {
                                                  speed = v;
                                                });
                                              }
                                            },
                                    ),
                                    IconButton(
                                      tooltip: 'Repeat track',
                                      isSelected: repeat,
                                      icon: const Icon(Icons.repeat_one),
                                      onPressed: preparing
                                          ? null
                                          : () async {
                                              final next = !repeat;
                                              await player.setLoopMode(
                                                next
                                                    ? LoopMode.one
                                                    : LoopMode.off,
                                              );
                                              if (mounted) {
                                                setState(() {
                                                  repeat = next;
                                                });
                                              }
                                            },
                                    ),
                                    TextButton.icon(
                                      onPressed: preparing
                                          ? null
                                          : () => openScore(current!),
                                      icon: const Icon(Icons.menu_book),
                                      label: const Text('ScoreFlow'),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                    ),
                  ),
                ),
            ],
          ),
  );
}
