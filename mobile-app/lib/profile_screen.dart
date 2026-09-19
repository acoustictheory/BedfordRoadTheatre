import 'dart:convert';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import 'profile_api.dart';

Future<Uint8List?> chooseProfilePhoto() async {
  final file = await FilePicker.pickFile(
    type: FileType.image,
    darwinOptions: const DarwinOptions(
      assetRepresentationMode: DarwinAssetRepresentationMode.compatible,
    ),
  );
  if (file == null) return null;
  if (await file.length() > 25 * 1024 * 1024) {
    throw const ProfileException('Choose a photo smaller than 25 MB.');
  }
  return file.readAsBytes();
}

Future<String> prepareProfilePhoto(Uint8List bytes) async {
  if (bytes.isEmpty || bytes.length > 25 * 1024 * 1024) {
    throw const ProfileException('Choose a photo smaller than 25 MB.');
  }
  final buffer = await ui.ImmutableBuffer.fromUint8List(bytes);
  final codec = await ui.instantiateImageCodecWithSize(
    buffer,
    getTargetSize: (width, height) {
      final scale = 1024 / (width > height ? width : height);
      return ui.TargetImageSize(
        width: scale < 1 ? (width * scale).round().clamp(1, 1024) : width,
        height: scale < 1 ? (height * scale).round().clamp(1, 1024) : height,
      );
    },
  );
  try {
    final frame = await codec.getNextFrame();
    try {
      final png = await frame.image.toByteData(format: ui.ImageByteFormat.png);
      if (png == null || png.lengthInBytes > 5 * 1024 * 1024) {
        throw const ProfileException(
          'This photo could not be prepared. Choose a smaller image.',
        );
      }
      return 'data:image/png;base64,${base64Encode(png.buffer.asUint8List(png.offsetInBytes, png.lengthInBytes))}';
    } finally {
      frame.image.dispose();
    }
  } finally {
    codec.dispose();
  }
}

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({
    super.key,
    this.api,
    required this.avatarBuilder,
    this.onOpenTheme,
    this.photoPicker = chooseProfilePhoto,
  });
  final ProfileApi? api;
  final Widget Function(String name, String fileId, String url) avatarBuilder;
  final VoidCallback? onOpenTheme;
  final Future<Uint8List?> Function() photoPicker;
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  static const fields = <String, (String, int)>{
    'firstName': ('First name', 80),
    'lastName': ('Last name', 80),
    'displayName': ('Display name', 120),
    'pronouns': ('Pronouns', 60),
    'grade': ('Grade / role', 30),
    'bio': ('About you', 1000),
    'phone': ('Phone', 50),
    'emergencyContact': ('Emergency contact', 250),
  };
  final formKey = GlobalKey<FormState>();
  late final api = widget.api ?? ProfileApi();
  final controllers = {
    for (final key in fields.keys) key: TextEditingController(),
  };
  final note = TextEditingController();
  Map<String, dynamic> profile = {}, account = {}, access = {};
  Set<String> selected = {};
  String visibility = 'Production';
  String? error;
  bool loading = true, busy = false, dirty = false, accessDirty = false;

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    for (final controller in controllers.values) {
      controller.dispose();
    }
    note.dispose();
    if (widget.api == null) api.close();
    super.dispose();
  }

  String value(Map<String, dynamic> row, String key) =>
      '${row[key] ?? row['${key[0].toUpperCase()}${key.substring(1)}'] ?? ''}';
  List<Map<String, dynamic>> rows(String key) => (access[key] as List? ?? [])
      .map((row) => Map<String, dynamic>.from(row as Map))
      .toList();
  Set<String> get assigned =>
      rows('assigned').map((row) => '${row['DepartmentID']}').toSet();
  void applyAccess(Map<String, dynamic> data) {
    access = Map<String, dynamic>.from(data['departmentAccess'] as Map? ?? {});
    selected = {
      ...assigned,
      ...rows('availableDepartments')
          .where((row) => row['latestStatus'] == 'Pending')
          .map((row) => '${row['DepartmentID']}'),
    };
  }

  Future<void> load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final data = await api.request('getProfile');
      if (!mounted) return;
      account = Map<String, dynamic>.from(data['context'] as Map);
      profile = Map<String, dynamic>.from(account['profile'] as Map? ?? {});
      for (final entry in controllers.entries) {
        entry.value.text = value(profile, entry.key);
      }
      final savedVisibility = value(profile, 'visibility');
      visibility =
          ['Production', 'Departments', 'Staff'].contains(savedVisibility)
          ? savedVisibility
          : 'Production';
      applyAccess(data);
    } catch (e) {
      if (mounted) error = '$e';
    }
    if (mounted) {
      setState(() {
        loading = false;
      });
    }
  }

  void message(String text) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  Future<void> save() async {
    if (!formKey.currentState!.validate()) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final data = await api.request('updateProfile', {
        for (final entry in controllers.entries)
          entry.key: entry.value.text.trim(),
        'visibility': visibility,
      });
      if (!mounted) return;
      profile = Map<String, dynamic>.from(data['profile'] as Map);
      dirty = false;
      message('Profile saved. Your website profile is updated too.');
    } catch (e) {
      if (mounted) error = '$e';
    }
    if (mounted) {
      setState(() {
        busy = false;
      });
    }
  }

  Future<void> photo(bool remove) async {
    if (remove) {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Remove profile photo?'),
          content: const Text(
            'This removes your photo from the app and website.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Remove'),
            ),
          ],
        ),
      );
      if (confirmed != true || !mounted) return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      if (remove) {
        await api.request('removeProfilePhoto');
        if (!mounted) return;
        profile = {...profile, 'PhotoURL': '', 'PhotoFileID': ''};
      } else {
        final bytes = await widget.photoPicker();
        if (bytes == null || !mounted) return;
        final dataUrl = await prepareProfilePhoto(bytes);
        final data = await api.request('uploadProfilePhoto', {
          'dataUrl': dataUrl,
        });
        if (!mounted) return;
        profile = Map<String, dynamic>.from(data['profile'] as Map);
      }
      message(
        remove
            ? 'Photo removed from your app and website.'
            : 'Photo updated in your app and website.',
      );
    } catch (e) {
      if (mounted) {
        error = e is ProfileException
            ? '$e'
            : 'Could not update this photo. Try a JPEG or PNG image.';
      }
    } finally {
      if (mounted) {
        setState(() {
          busy = false;
        });
      }
    }
  }

  Future<void> saveAccess() async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await api.request('saveMyDepartmentRequests', {
        'departmentIds': selected.difference(assigned).toList(),
        'requestNote': note.text.trim(),
      });
      if (!mounted) return;
      accessDirty = false;
      note.clear();
      message('Department requests saved for administrator review.');
      final data = await api.request('getProfile');
      if (!mounted) return;
      applyAccess(data);
    } catch (e) {
      if (mounted) error = '$e';
    }
    if (mounted) {
      setState(() {
        busy = false;
      });
    }
  }

  Future<void> confirmExit() async {
    if (busy) return;
    final discard = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Discard unsaved edits?'),
        content: const Text(
          'Your unsaved profile or department edits will be lost.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Keep editing'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Discard'),
          ),
        ],
      ),
    );
    if (discard == true && mounted) {
      setState(() {
        dirty = false;
        accessDirty = false;
      });
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) Navigator.pop(context);
      });
    }
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: !busy && !dirty && !accessDirty,
    onPopInvokedWithResult: (didPop, _) {
      if (!didPop) confirmExit();
    },
    child: Scaffold(
      appBar: AppBar(title: const Text('Edit profile')),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : account.isEmpty
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Padding(
                    padding: const EdgeInsets.all(20),
                    child: Text(error ?? 'Unable to load profile.'),
                  ),
                  FilledButton(onPressed: load, child: const Text('Try again')),
                ],
              ),
            )
          : Column(
              children: [
                if (busy) const LinearProgressIndicator(),
                if (error != null)
                  MaterialBanner(
                    content: Text(error!),
                    actions: [
                      TextButton(
                        onPressed: () => setState(() {
                          error = null;
                        }),
                        child: const Text('Dismiss'),
                      ),
                    ],
                  ),
                Expanded(
                  child: AbsorbPointer(
                    absorbing: busy,
                    child: Form(
                      key: formKey,
                      child: ListView(
                        padding: const EdgeInsets.all(20),
                        children: [
                          Center(
                            child: widget.avatarBuilder(
                              value(profile, 'displayName'),
                              '${profile['PhotoFileID'] ?? ''}',
                              '${profile['PhotoURL'] ?? ''}',
                            ),
                          ),
                          Wrap(
                            alignment: WrapAlignment.center,
                            children: [
                              TextButton.icon(
                                onPressed: busy ? null : () => photo(false),
                                icon: const Icon(Icons.add_a_photo_outlined),
                                label: const Text('Change photo'),
                              ),
                              if ('${profile['PhotoURL'] ?? ''}${profile['PhotoFileID'] ?? ''}'
                                  .isNotEmpty)
                                TextButton(
                                  onPressed: busy ? null : () => photo(true),
                                  child: const Text('Remove photo'),
                                ),
                            ],
                          ),
                          Text('Username: ${account['username'] ?? ''}'),
                          if ('${account['email'] ?? ''}'.isNotEmpty)
                            Text('Account email: ${account['email']}'),
                          const SizedBox(height: 20),
                          for (final entry in fields.entries)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 14),
                              child: TextFormField(
                                enabled: !busy,
                                key: ValueKey(entry.key),
                                controller: controllers[entry.key],
                                maxLength: entry.value.$2,
                                minLines: entry.key == 'bio' ? 3 : 1,
                                maxLines:
                                    entry.key == 'bio' ||
                                        entry.key == 'emergencyContact'
                                    ? 5
                                    : 1,
                                textCapitalization: entry.key == 'phone'
                                    ? TextCapitalization.none
                                    : TextCapitalization.sentences,
                                keyboardType: entry.key == 'phone'
                                    ? TextInputType.phone
                                    : entry.key == 'bio' ||
                                          entry.key == 'emergencyContact'
                                    ? TextInputType.multiline
                                    : TextInputType.text,
                                decoration: InputDecoration(
                                  labelText: entry.value.$1,
                                  border: const OutlineInputBorder(),
                                  helperText:
                                      entry.key == 'phone' ||
                                          entry.key == 'emergencyContact'
                                      ? 'For production staff'
                                      : null,
                                ),
                                validator: (text) =>
                                    [
                                          'firstName',
                                          'lastName',
                                          'displayName',
                                        ].contains(entry.key) &&
                                        (text ?? '').trim().isEmpty
                                    ? 'Enter your ${entry.value.$1.toLowerCase()}.'
                                    : null,
                                onChanged: (_) => setState(() {
                                  dirty = true;
                                }),
                              ),
                            ),
                          DropdownButtonFormField<String>(
                            initialValue: visibility,
                            decoration: const InputDecoration(
                              labelText: 'Profile visibility',
                              border: OutlineInputBorder(),
                            ),
                            items: ['Production', 'Departments', 'Staff']
                                .map(
                                  (v) => DropdownMenuItem(
                                    value: v,
                                    child: Text(v),
                                  ),
                                )
                                .toList(),
                            onChanged: (v) => setState(() {
                              visibility = v!;
                              dirty = true;
                            }),
                          ),
                          const SizedBox(height: 16),
                          FilledButton.icon(
                            onPressed: busy ? null : save,
                            icon: const Icon(Icons.save_outlined),
                            label: const Text('Save profile'),
                          ),
                          if (widget.onOpenTheme != null)
                            ListTile(
                              leading: const Icon(Icons.palette_outlined),
                              title: const Text('Theme Studio'),
                              subtitle: const Text(
                                'Edit your app and website appearance',
                              ),
                              trailing: const Icon(Icons.chevron_right),
                              onTap: widget.onOpenTheme,
                            ),
                          const Divider(height: 32),
                          Text(
                            'Production areas',
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                          if (account['isAdmin'] == true)
                            const Text(
                              'Administrators have access to all departments.',
                            )
                          else ...[
                            const Text(
                              'New requests need administrator approval. Uncheck a pending request to withdraw it.',
                            ),
                            for (final row in rows('availableDepartments'))
                              CheckboxListTile(
                                contentPadding: EdgeInsets.zero,
                                title: Text('${row['Name'] ?? ''}'),
                                subtitle: Text(
                                  assigned.contains('${row['DepartmentID']}')
                                      ? 'Approved'
                                      : '${row['latestStatus'] ?? ''}',
                                ),
                                value: selected.contains(
                                  '${row['DepartmentID']}',
                                ),
                                onChanged:
                                    assigned.contains('${row['DepartmentID']}')
                                    ? null
                                    : (checked) => setState(() {
                                        if (checked == true) {
                                          selected.add(
                                            '${row['DepartmentID']}',
                                          );
                                        } else {
                                          selected.remove(
                                            '${row['DepartmentID']}',
                                          );
                                        }
                                        accessDirty = true;
                                      }),
                              ),
                            TextField(
                              enabled: !busy,
                              controller: note,
                              maxLength: 500,
                              maxLines: 3,
                              decoration: const InputDecoration(
                                labelText: 'Request note',
                                border: OutlineInputBorder(),
                              ),
                              onChanged: (_) => setState(() {
                                accessDirty = true;
                              }),
                            ),
                            OutlinedButton(
                              onPressed: busy || !accessDirty
                                  ? null
                                  : saveAccess,
                              child: const Text('Save department requests'),
                            ),
                          ],
                          const SizedBox(height: 24),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
    ),
  );
}
