import 'dart:convert';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:musical/profile_api.dart';
import 'package:musical/profile_screen.dart';

Map<String, dynamic> fixture() => {
  'success': true,
  'context': {
    'username': 'member',
    'email': 'member@example.org',
    'profile': {
      'FirstName': 'Original',
      'LastName': 'Member',
      'DisplayName': 'Original Member',
      'Phone': '123',
      'Visibility': 'Production',
    },
  },
  'departmentAccess': {'availableDepartments': [], 'assigned': []},
};

void main() {
  testWidgets('Discard prompt protects unsaved profile details', (
    tester,
  ) async {
    final api = ProfileApi(
      tokenProvider: () async => 'token',
      client: MockClient(
        (_) async => http.Response(jsonEncode(fixture()), 200),
      ),
    );
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => ProfileScreen(
                    api: api,
                    avatarBuilder: (_, _, _) => const Icon(Icons.person),
                  ),
                ),
              ),
              child: const Text('Open profile'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Open profile'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const ValueKey('firstName')), 'Unsaved');
    await tester.pump();
    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(find.text('Discard unsaved edits?'), findsOneWidget);
    await tester.tap(find.text('Keep editing'));
    await tester.pumpAndSettle();
    expect(find.text('Unsaved'), findsOneWidget);
    await tester.pump();
    await tester.pageBack();
    await tester.pumpAndSettle();
    await tester.tap(find.text('Discard'));
    await tester.pumpAndSettle();
    expect(find.text('Open profile'), findsOneWidget);
    api.close();
  });
  testWidgets(
    'Removing a photo updates the shared account without losing edits',
    (tester) async {
      final actions = <String>[];
      final api = ProfileApi(
        tokenProvider: () async => 'token',
        client: MockClient((request) async {
          final action = jsonDecode(request.body)['action'] as String;
          actions.add(action);
          if (action == 'getProfile') {
            final data = fixture();
            data['context']['profile']['PhotoURL'] =
                'https://example.org/avatar.png';
            return http.Response(jsonEncode(data), 200);
          }
          return http.Response('{"success":true}', 200);
        }),
      );
      await tester.pumpWidget(
        MaterialApp(
          home: ProfileScreen(
            api: api,
            avatarBuilder: (_, _, url) => Text('Avatar: $url'),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byKey(const ValueKey('firstName')),
        'Still editing',
      );
      await tester.tap(find.text('Remove photo'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Remove'));
      await tester.pumpAndSettle();
      expect(actions, ['getProfile', 'removeProfilePhoto']);
      expect(find.text('Avatar: '), findsOneWidget);
      expect(find.text('Still editing'), findsOneWidget);
      expect(find.text('Remove photo'), findsNothing);
      await tester.pumpWidget(const SizedBox());
      api.close();
    },
  );
  test('Profile API authenticates and reports server errors', () async {
    final api = ProfileApi(
      tokenProvider: () async => 'fresh-token',
      client: MockClient((request) async {
        expect(request.headers['Authorization'], 'Bearer fresh-token');
        expect(jsonDecode(request.body), {
          'action': 'updateProfile',
          'displayName': 'New Name',
        });
        return http.Response(
          jsonEncode({'success': false, 'error': 'Profile not found.'}),
          403,
        );
      }),
    );
    await expectLater(
      api.request('updateProfile', {'displayName': 'New Name'}),
      throwsA(
        isA<ProfileException>().having(
          (e) => e.message,
          'message',
          'Profile not found.',
        ),
      ),
    );
    api.close();
  });
  test('Signed out profile requests do not reach the server', () async {
    final api = ProfileApi(
      tokenProvider: () async => null,
      client: MockClient((_) async {
        fail('No request without authentication');
      }),
    );
    await expectLater(
      api.request('getProfile'),
      throwsA(isA<ProfileException>()),
    );
    api.close();
  });
  testWidgets(
    'Native form retains failed edits and saves to shared profile endpoint',
    (tester) async {
      var failSave = true;
      Map<String, dynamic>? saved;
      final api = ProfileApi(
        tokenProvider: () async => 'token',
        client: MockClient((request) async {
          final data = jsonDecode(request.body) as Map<String, dynamic>;
          if (data['action'] == 'getProfile')
            return http.Response(jsonEncode(fixture()), 200);
          saved = data;
          if (failSave)
            return http.Response(
              jsonEncode({'success': false, 'error': 'Try again later'}),
              403,
            );
          return http.Response(
            jsonEncode({
              'success': true,
              'profile': {'DisplayName': data['displayName']},
            }),
            200,
          );
        }),
      );
      await tester.pumpWidget(
        MaterialApp(
          home: ProfileScreen(
            api: api,
            avatarBuilder: (_, _, _) => const Icon(Icons.person),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Original'), findsOneWidget);
      await tester.enterText(
        find.byKey(const ValueKey('displayName')),
        'Updated Member',
      );
      await tester.scrollUntilVisible(
        find.text('Save profile'),
        300,
        scrollable: find
            .descendant(
              of: find.byType(ListView),
              matching: find.byType(Scrollable),
            )
            .first,
      );
      await tester.tap(find.text('Save profile'));
      await tester.pumpAndSettle();
      expect(find.text('Try again later'), findsOneWidget);
      expect(saved!['displayName'], 'Updated Member');
      expect(saved!['phone'], '123');
      expect(saved!.containsKey('theme'), isFalse);
      failSave = false;
      await tester.tap(find.text('Save profile'));
      await tester.pumpAndSettle();
      expect(
        find.text('Profile saved. Your website profile is updated too.'),
        findsOneWidget,
      );
      expect(saved!['displayName'], 'Updated Member');
      await tester.pumpWidget(const SizedBox());
      api.close();
    },
  );
  testWidgets('Photo preparation limits dimensions and returns supported PNG', (
    tester,
  ) async {
    await tester.runAsync(() async {
      final recorder = ui.PictureRecorder();
      final canvas = Canvas(recorder);
      canvas.drawColor(Colors.blue, BlendMode.src);
      final picture = recorder.endRecording();
      final image = await picture.toImage(2048, 1024);
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      final url = await prepareProfilePhoto(bytes!.buffer.asUint8List());
      expect(url.startsWith('data:image/png;base64,'), isTrue);
      final codec = await ui.instantiateImageCodec(
        base64Decode(url.split(',').last),
      );
      final frame = await codec.getNextFrame();
      expect(frame.image.width, 1024);
      expect(frame.image.height, 512);
      frame.image.dispose();
      codec.dispose();
      image.dispose();
      picture.dispose();
    });
  });
}
