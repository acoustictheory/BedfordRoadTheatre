import 'dart:async';
import 'dart:convert';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:pdfrx/pdfrx.dart';

import 'annotation/document_reader.dart';
import 'portal_models.dart';

const site = 'https://bedfordroadtheatre.ca';
const appsScriptUrl =
    'https://script.google.com/macros/s/AKfycbw2hM9wqpgvlRlQVEUr-h19GpTeXoVe3fwZb2CsR0bjIDdi9idHEEUtgLPne0YJ0HtHMQ/exec';
const deviceEndpoint =
    'https://northamerica-northeast2-brpa-digital-hub-dev.cloudfunctions.net/registerCommunicationDevice';
const appSignInEndpoint =
    'https://northamerica-northeast2-brpa-digital-hub-dev.cloudfunctions.net/legacyAppSignIn';
const androidFirebaseOptions = FirebaseOptions(
  apiKey: 'AIzaSyB5eWavkOwFDop33rAZM0E2NLOQ_JxhYiY',
  appId: '1:499470162310:android:c6e16ca9b51cf73c37b407',
  messagingSenderId: '499470162310',
  projectId: 'brpa-digital-hub-dev',
  storageBucket: 'brpa-digital-hub-dev.firebasestorage.app',
);
const iosFirebaseOptions = FirebaseOptions(
  apiKey: 'AIzaSyD5wK9ZjENC93dgNUu423Yox6jovWIdla8',
  appId: '1:499470162310:ios:eeda44c7d5dcdfb537b407',
  messagingSenderId: '499470162310',
  projectId: 'brpa-digital-hub-dev',
  storageBucket: 'brpa-digital-hub-dev.firebasestorage.app',
  iosBundleId: 'ca.sk.bedfordroad.musical',
);
FirebaseOptions get firebaseOptions =>
    defaultTargetPlatform == TargetPlatform.iOS
    ? iosFirebaseOptions
    : androidFirebaseOptions;
final notifications = FlutterLocalNotificationsPlugin();
StreamSubscription<String>? pushTokenSubscription;

Future<void> configureNotificationChannels() async {
  final android = notifications
      .resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin
      >();
  if (android == null) return;
  for (final channel in const [
    AndroidNotificationChannel(
      'bedford_messages',
      'Messages',
      description: 'Production conversations',
      importance: Importance.high,
    ),
    AndroidNotificationChannel(
      'bedford_urgent',
      'Urgent Production Alerts',
      description: 'Time-critical production alerts',
      importance: Importance.max,
    ),
    AndroidNotificationChannel(
      'bedford_schedule',
      'Schedule Changes',
      description: 'Call-time and rehearsal schedule changes',
      importance: Importance.high,
    ),
    AndroidNotificationChannel(
      'bedford_downloads',
      'Downloads',
      description: 'Offline rehearsal material progress',
      importance: Importance.low,
    ),
  ]) {
    await android.createNotificationChannel(channel);
  }
}

Future<void> initializeScoreFlowRendering() async {
  await pdfrxFlutterInitialize();
  try {
    final loader = FontLoader('Bravura');
    loader.addFont(
      rootBundle.load('packages/flutter_notemus/assets/smufl/Bravura.otf'),
    );
    await loader.load();
  } catch (_) {}
}

@pragma('vm:entry-point')
Future<void> backgroundMessage(RemoteMessage m) async {
  await Firebase.initializeApp(options: firebaseOptions);
  final startupPreferences = await SharedPreferences.getInstance();
  if (startupPreferences.containsKey('brmTrustDevice') &&
      startupPreferences.getBool('brmTrustDevice') != true) {
    await FirebaseAuth.instance.signOut();
    await startupPreferences.remove('brmLegacyToken');
    await startupPreferences.remove('brmLegacyContext');
  }
  await initializeScoreFlowRendering();
  await showNotification(m);
}

Future<void> showNotification(RemoteMessage m) async {
  final type = '${m.data['type'] ?? 'communication'}';
  final channel = type == 'urgent'
      ? 'bedford_urgent'
      : type == 'schedule'
      ? 'bedford_schedule'
      : type == 'download'
      ? 'bedford_downloads'
      : 'bedford_messages';
  final channelName = type == 'urgent'
      ? 'Urgent Production Alerts'
      : type == 'schedule'
      ? 'Schedule Changes'
      : type == 'download'
      ? 'Downloads'
      : 'Messages';
  final d = NotificationDetails(
    android: AndroidNotificationDetails(
      channel,
      channelName,
      channelDescription: 'Bedford Road Musical updates',
      importance: type == 'urgent'
          ? Importance.max
          : type == 'download'
          ? Importance.low
          : Importance.high,
      priority: type == 'urgent'
          ? Priority.max
          : type == 'download'
          ? Priority.low
          : Priority.high,
      category: type == 'communication'
          ? AndroidNotificationCategory.message
          : AndroidNotificationCategory.reminder,
      groupKey: 'bedford_${type}_group',
    ),
    iOS: const DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    ),
  );
  await notifications.show(
    id: m.messageId.hashCode,
    title: m.data['senderName'] ?? 'Bedford Musical',
    body: m.data['body'] ?? 'New message',
    notificationDetails: d,
    payload: m.data['conversationId'],
  );
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeScoreFlowRendering();
  await Firebase.initializeApp(options: firebaseOptions);
  FirebaseFirestore.instance.settings = const Settings(
    persistenceEnabled: true,
    cacheSizeBytes: Settings.CACHE_SIZE_UNLIMITED,
  );
  await notifications.initialize(
    settings: const InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      iOS: DarwinInitializationSettings(),
    ),
  );
  await configureNotificationChannels();
  FirebaseMessaging.onBackgroundMessage(backgroundMessage);
  FirebaseMessaging.onMessage.listen(showNotification);
  runApp(const BedfordApp());
}

class BedfordApp extends StatelessWidget {
  const BedfordApp({super.key});
  @override
  Widget build(BuildContext c) => MaterialApp(
    debugShowCheckedModeBanner: false,
    title: 'Bedford Road Musical',
    themeMode: ThemeMode.dark,
    darkTheme: ThemeData(
      brightness: Brightness.dark,
      useMaterial3: true,
      scaffoldBackgroundColor: const Color(0xff09090d),
      colorScheme: ColorScheme.fromSeed(
        seedColor: const Color(0xffd2183b),
        brightness: Brightness.dark,
        primary: const Color(0xffff365b),
        surface: const Color(0xff15151d),
      ),
      cardTheme: const CardThemeData(
        color: Color(0xff15151d),
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(22)),
          side: BorderSide(color: Color(0xff292934)),
        ),
      ),
      inputDecorationTheme: const InputDecorationTheme(
        filled: true,
        fillColor: Color(0xff1d1d27),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.all(Radius.circular(16)),
          borderSide: BorderSide.none,
        ),
      ),
    ),
    home: const AuthGate(),
  );
}

class AuthGate extends StatelessWidget {
  const AuthGate({super.key});
  @override
  Widget build(BuildContext c) => StreamBuilder<User?>(
    stream: FirebaseAuth.instance.authStateChanges(),
    builder: (c, s) => s.connectionState == ConnectionState.waiting
        ? const Splash()
        : s.data == null
        ? const LoginScreen()
        : const PortalLoader(),
  );
}

class Splash extends StatelessWidget {
  const Splash({super.key});
  @override
  Widget build(BuildContext c) =>
      const Scaffold(body: Center(child: CircularProgressIndicator()));
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginState();
}

class _LoginState extends State<LoginScreen> {
  final username = TextEditingController(), password = TextEditingController();
  bool busy = false, obscure = true, trustDevice = true;
  String error = '';
  Future<void> login() async {
    setState(() {
      busy = true;
      error = '';
    });
    try {
      const syntheticSuffix = '@users.bedford-musical.invalid';
      var v = username.text.trim().toLowerCase();
      if (v.endsWith(syntheticSuffix)) {
        v = v.substring(0, v.length - syntheticSuffix.length);
      }
      if (v.isEmpty) {
        throw FirebaseAuthException(
          code: 'invalid-credential',
          message: 'Enter your username.',
        );
      }
      final bridgeResponse = await http
          .post(
            Uri.parse(appSignInEndpoint),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'username': v,
              'password': password.text,
              'trustedDevice': trustDevice,
            }),
          )
          .timeout(const Duration(seconds: 35));
      Map<String, dynamic> bridge;
      try {
        bridge = jsonDecode(bridgeResponse.body) as Map<String, dynamic>;
      } on FormatException {
        throw FirebaseAuthException(
          code: 'service-response',
          message:
              'The sign-in service returned an unreadable response (${bridgeResponse.statusCode}).',
        );
      }
      if (bridge['success'] != true ||
          '${bridge['customToken'] ?? ''}'.isEmpty) {
        throw FirebaseAuthException(
          code: 'app-account-unavailable',
          message:
              '${bridge['error'] ?? 'Your app account could not be connected.'}',
        );
      }
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('brmTrustDevice', trustDevice);
      await prefs.setString('brmLegacyToken', '${bridge['portalToken']}');
      await prefs.setString(
        'brmLegacyContext',
        jsonEncode(bridge['portalContext'] ?? const {}),
      );
      await FirebaseAuth.instance.signInWithCustomToken(
        '${bridge['customToken']}',
      );
    } on FirebaseAuthException catch (e) {
      if (mounted) {
        setState(
          () => error = e.code == 'invalid-credential'
              ? 'That username or password is not correct.'
              : e.message ?? 'Sign in failed.',
        );
      }
    } on TimeoutException {
      if (mounted) {
        setState(
          () =>
              error = 'Sign in timed out. Check your connection and try again.',
        );
      }
    } catch (e) {
      if (mounted) setState(() => error = 'Could not connect: $e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext c) => Scaffold(
    body: Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xff090b18), Color(0xff18112d), Color(0xff071d2a)],
        ),
      ),
      child: SafeArea(
        child: Stack(
          children: [
            Positioned(
              top: -90,
              right: -70,
              child: Container(
                width: 250,
                height: 250,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [Color(0x665c36d9), Color(0x005c36d9)],
                  ),
                ),
              ),
            ),
            Positioned(
              bottom: -120,
              left: -100,
              child: Container(
                width: 300,
                height: 300,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [Color(0x5541c7c7), Color(0x0041c7c7)],
                  ),
                ),
              ),
            ),
            Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(22, 30, 22, 30),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 450),
                  child: Card(
                    color: const Color(0xee171827),
                    elevation: 18,
                    shadowColor: const Color(0xaa000000),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(28),
                      side: const BorderSide(color: Color(0x335ddbd3)),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(28, 30, 28, 28),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Center(child: BrandMark(size: 86)),
                          const SizedBox(height: 18),
                          const Center(
                            child: Text(
                              'BEDFORD ROAD MUSICAL',
                              style: TextStyle(
                                color: Color(0xff70e0d8),
                                fontSize: 11,
                                letterSpacing: 2.4,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                          const SizedBox(height: 10),
                          Text(
                            'Your production.\nOne connected space.',
                            textAlign: TextAlign.center,
                            style: Theme.of(c).textTheme.headlineMedium
                                ?.copyWith(
                                  fontWeight: FontWeight.w900,
                                  height: 1.08,
                                ),
                          ),
                          const SizedBox(height: 10),
                          const Text(
                            'Messages, blocking, music and every department tool - ready for rehearsal.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: Colors.white60,
                              height: 1.45,
                            ),
                          ),
                          const SizedBox(height: 28),
                          TextField(
                            controller: username,
                            textInputAction: TextInputAction.next,
                            autocorrect: false,
                            decoration: const InputDecoration(
                              labelText: 'Username',
                              hintText: 'Your website username',
                              prefixIcon: Icon(Icons.person_outline_rounded),
                            ),
                          ),
                          TextField(
                            controller: password,
                            obscureText: obscure,
                            onSubmitted: (_) => login(),
                            decoration: InputDecoration(
                              labelText: 'Password',
                              prefixIcon: const Icon(
                                Icons.lock_outline_rounded,
                              ),
                              suffixIcon: IconButton(
                                onPressed: () =>
                                    setState(() => obscure = !obscure),
                                icon: Icon(
                                  obscure
                                      ? Icons.visibility
                                      : Icons.visibility_off,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 10),
                          CheckboxListTile(
                            contentPadding: EdgeInsets.zero,
                            controlAffinity: ListTileControlAffinity.leading,
                            value: trustDevice,
                            onChanged: busy
                                ? null
                                : (value) => setState(
                                    () => trustDevice = value ?? true,
                                  ),
                            title: const Text(
                              'Trust this device',
                              style: TextStyle(fontWeight: FontWeight.w800),
                            ),
                            subtitle: const Text(
                              'Stay signed in on this personal device. Do not use on a shared phone.',
                            ),
                          ),
                          if (error.isNotEmpty)
                            Container(
                              margin: const EdgeInsets.only(top: 14),
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: const Color(0x22ff647c),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: const Color(0x66ff647c),
                                ),
                              ),
                              child: Row(
                                children: [
                                  const Icon(
                                    Icons.error_outline_rounded,
                                    color: Color(0xffff8294),
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Text(
                                      error,
                                      style: TextStyle(
                                        color: Color(0xffffb3bd),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          const SizedBox(height: 20),
                          FilledButton(
                            onPressed: busy ? null : login,
                            child: Padding(
                              padding: const EdgeInsets.all(14),
                              child: busy
                                  ? const SizedBox.square(
                                      dimension: 20,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                      ),
                                    )
                                  : const Row(
                                      mainAxisAlignment:
                                          MainAxisAlignment.center,
                                      children: [
                                        Text('Enter the production'),
                                        SizedBox(width: 8),
                                        Icon(
                                          Icons.arrow_forward_rounded,
                                          size: 19,
                                        ),
                                      ],
                                    ),
                            ),
                          ),
                          const SizedBox(height: 14),
                          const Text(
                            'Use the same username and current password as the website.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: Colors.white38,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class PortalContext {
  const PortalContext(
    this.userId,
    this.productionId,
    this.title,
    this.name,
    this.admin,
    this.photoFileId,
    this.photoUrl,
    this.themeId,
    this.themePreferences,
  );
  final String userId, productionId, title, name;
  final String photoFileId, photoUrl, themeId;
  final Map<String, dynamic> themePreferences;
  final bool admin;
}

class AppPalette {
  const AppPalette(
    this.primary,
    this.secondary,
    this.background,
    this.surface, {
    this.text,
    this.radius = 18,
    this.typeScale = 1,
    this.depth = 3,
  });
  final Color primary, secondary, background, surface;
  final Color? text;
  final double radius, typeScale, depth;

  static Color color(dynamic value, Color fallback) {
    final hex = '$value'.replaceAll('#', '');
    if (hex.length != 6) return fallback;
    return Color(int.tryParse('ff$hex', radix: 16) ?? fallback.toARGB32());
  }

  static AppPalette custom(Map<String, dynamic> p) => AppPalette(
    color(p['primary'], const Color(0xffd71e2b)),
    color(p['secondary'], const Color(0xff6f7cff)),
    color(p['background'], const Color(0xff090a10)),
    color(p['surface'], const Color(0xff1b1c24)),
    text: color(p['text'], const Color(0xfff7f7fa)),
    radius: (p['radius'] as num?)?.toDouble() ?? 18,
    typeScale: (p['typeScale'] as num?)?.toDouble() ?? 1,
    depth: (p['depth'] as num?)?.toDouble() ?? 3,
  );

  static AppPalette fromTheme(
    String id, [
    Map<String, dynamic> preferences = const {},
  ]) => id.toLowerCase() == 'custom-aesthetic'
      ? custom(preferences)
      : switch (id.toLowerCase()) {
          'bedford-light' => const AppPalette(
            Color(0xffa20f29),
            Color(0xff33363c),
            Color(0xfff5f3f1),
            Color(0xffffffff),
          ),
          'auradon-royal' => const AppPalette(
            Color(0xfff3c75f),
            Color(0xff69aef8),
            Color(0xff061326),
            Color(0xff112b4f),
          ),
          'isle-lost' => const AppPalette(
            Color(0xffa8f12d),
            Color(0xffb85fff),
            Color(0xff0c1210),
            Color(0xff20251d),
          ),
          'vk-neon' => const AppPalette(
            Color(0xffff3ec9),
            Color(0xff00e9ff),
            Color(0xff090713),
            Color(0xff21162f),
          ),
          'dragon-fire' => const AppPalette(
            Color(0xffff7a2c),
            Color(0xff72f58e),
            Color(0xff100906),
            Color(0xff2a1710),
          ),
          _ => const AppPalette(
            Color(0xffff365b),
            Color(0xffb7bcc8),
            Color(0xff09090d),
            Color(0xff15151d),
          ),
        };

  ThemeData theme() {
    final brightness = ThemeData.estimateBrightnessForColor(background);
    var scheme = ColorScheme.fromSeed(
      seedColor: primary,
      brightness: brightness,
      primary: primary,
      secondary: secondary,
      surface: surface,
    );
    if (text != null)
      scheme = scheme.copyWith(
        onSurface: text,
        onSurfaceVariant: text!.withValues(alpha: .72),
      );
    final outline = scheme.onSurface.withValues(alpha: .16);
    return ThemeData(
      brightness: brightness,
      useMaterial3: true,
      scaffoldBackgroundColor: background,
      colorScheme: scheme,
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: Color.lerp(surface, background, .22),
        indicatorColor: primary.withValues(alpha: .24),
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => TextStyle(
            color: states.contains(WidgetState.selected)
                ? primary
                : scheme.onSurfaceVariant,
            fontSize: 11,
            fontWeight: states.contains(WidgetState.selected)
                ? FontWeight.w900
                : FontWeight.w700,
          ),
        ),
      ),
      cardTheme: CardThemeData(
        color: surface.withValues(alpha: .96),
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radius),
          side: BorderSide(color: outline),
        ),
      ),
      textTheme: ThemeData(brightness: brightness).textTheme
          .apply(fontSizeFactor: typeScale),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Color.lerp(surface, scheme.onSurface, .06),
        border: const OutlineInputBorder(
          borderRadius: BorderRadius.all(Radius.circular(16)),
          borderSide: BorderSide.none,
        ),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: background,
        foregroundColor: scheme.onSurface,
        surfaceTintColor: Colors.transparent,
      ),
    );
  }
}

final Map<String, Future<String>> _photoUrls = {};

Future<String> profilePhotoUrl(String fileId, String directUrl) {
  if (directUrl.startsWith('http')) return Future.value(directUrl);
  if (fileId.isEmpty) return Future.value('');
  return _photoUrls.putIfAbsent(fileId, () async {
    final result = await FirebaseStorage.instance
        .ref('legacy-drive/$fileId')
        .listAll();
    if (result.items.isEmpty) return '';
    return result.items.first.getDownloadURL();
  });
}

class ProfileAvatar extends StatelessWidget {
  const ProfileAvatar({
    super.key,
    required this.name,
    required this.fileId,
    required this.url,
    this.radius = 24,
  });
  final String name, fileId, url;
  final double radius;
  @override
  Widget build(BuildContext context) => FutureBuilder<String>(
    future: profilePhotoUrl(fileId, url),
    builder: (context, snapshot) {
      final resolved = snapshot.data ?? '';
      return CircleAvatar(
        radius: radius,
        backgroundColor: Theme.of(context).colorScheme.primaryContainer,
        foregroundColor: Theme.of(context).colorScheme.onPrimaryContainer,
        backgroundImage: resolved.isNotEmpty
            ? CachedNetworkImageProvider(resolved)
            : null,
        child: resolved.isEmpty
            ? Text(
                initials(name),
                style: TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: radius * .65,
                ),
              )
            : null,
      );
    },
  );
}

final Map<String, Future<Map<String, dynamic>>> _profiles = {};

class UserProfileAvatar extends StatelessWidget {
  const UserProfileAvatar({
    super.key,
    required this.userId,
    required this.name,
    this.radius = 18,
  });
  final String userId, name;
  final double radius;
  @override
  Widget build(BuildContext context) => FutureBuilder<Map<String, dynamic>>(
    future: _profiles.putIfAbsent(
      userId,
      () async =>
          (await FirebaseFirestore.instance
                  .collection('profiles')
                  .doc(userId)
                  .get())
              .data() ??
          {},
    ),
    builder: (context, snapshot) {
      final profile = snapshot.data ?? const <String, dynamic>{};
      return ProfileAvatar(
        name: '${profile['displayName'] ?? profile['DisplayName'] ?? name}',
        fileId: profilePhotoReference(profile),
        url: '${profile['photoURL'] ?? profile['PhotoURL'] ?? ''}',
        radius: radius,
      );
    },
  );
}

String initials(String name) => name
    .trim()
    .split(RegExp(r'\s+'))
    .where((x) => x.isNotEmpty)
    .take(2)
    .map((x) => x[0].toUpperCase())
    .join();

class PortalLoader extends StatelessWidget {
  const PortalLoader({super.key});
  Future<PortalContext> load() async {
    final a = FirebaseAuth.instance.currentUser!;
    final token = await a.getIdTokenResult();
    final userId = '${token.claims?['legacyUserId'] ?? a.uid}';
    final db = FirebaseFirestore.instance;
    final u = (await db.collection('users').doc(userId).get()).data() ?? {};
    DocumentSnapshot<Map<String, dynamic>>? production;
    final preferredProductionId =
        '${u['activeProductionId'] ?? u['ActiveProductionID'] ?? ''}'.trim();
    if (preferredProductionId.isNotEmpty) {
      final preferred = await db
          .collection('productions')
          .doc(preferredProductionId)
          .get();
      if (preferred.exists) production = preferred;
    }
    if (production == null) {
      const migratedProductionId = 'PROD-b0d6edc6-c518-404c-a0a8-29b8a7369ba1';
      final migrated = await db
          .collection('productions')
          .doc(migratedProductionId)
          .get();
      if (migrated.exists) production = migrated;
    }
    if (production == null) {
      for (final field in ['status', 'Status']) {
        for (final value in ['Active', 'active']) {
          final result = await db
              .collection('productions')
              .where(field, isEqualTo: value)
              .limit(1)
              .get();
          if (result.docs.isNotEmpty) {
            production = result.docs.first;
            break;
          }
        }
        if (production != null) break;
      }
    }
    if (production == null) {
      final anyProduction = await db.collection('productions').limit(1).get();
      if (anyProduction.docs.isNotEmpty) production = anyProduction.docs.first;
    }
    const migratedProductionId = 'PROD-b0d6edc6-c518-404c-a0a8-29b8a7369ba1';
    final productionId =
        production?.id ??
        (preferredProductionId.isNotEmpty
            ? preferredProductionId
            : migratedProductionId);
    final d = production?.data() ?? <String, dynamic>{};
    var profile =
        (await db.collection('profiles').doc(a.uid).get()).data() ?? {};
    if (profile.isEmpty) {
      for (final field in ['userId', 'userID', 'UserID']) {
        final profiles = await db
            .collection('profiles')
            .where(field, isEqualTo: a.uid)
            .limit(1)
            .get();
        if (profiles.docs.isNotEmpty) {
          profile = profiles.docs.first.data();
          break;
        }
      }
    }
    final av = u['isFullAdmin'] ?? u['IsFullAdmin'];
    unawaited(registerDevice(a));
    return PortalContext(
      userId,
      productionId,
      '${d['title'] ?? d['Title'] ?? 'Descendants: The Musical'}',
      '${profile['displayName'] ?? profile['DisplayName'] ?? a.displayName ?? u['username'] ?? 'Member'}',
      av == true || '$av'.toLowerCase() == 'true',
      profilePhotoReference(profile).isNotEmpty
          ? profilePhotoReference(profile)
          : profilePhotoReference(
              Map<String, dynamic>.from(
                u['profile'] is Map ? u['profile'] as Map : const {},
              ),
            ),
      '${profile['photoURL'] ?? profile['PhotoURL'] ?? u['profile']?['photoURL'] ?? ''}',
      '${profile['theme'] ?? profile['Theme'] ?? u['profile']?['theme'] ?? 'bedford-dark'}',
      profile['themePreferences'] is Map
          ? Map<String, dynamic>.from(profile['themePreferences'] as Map)
          : <String, dynamic>{},
    );
  }

  Future<void> registerDevice(User u) async {
    try {
      final permission = await FirebaseMessaging.instance.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      if (permission.authorizationStatus == AuthorizationStatus.denied) return;
      final token = await FirebaseMessaging.instance.getToken();
      if (token == null) return;
      final prefs = await SharedPreferences.getInstance();
      var id = prefs.getString('installId');
      id ??=
          '${DateTime.now().microsecondsSinceEpoch}-${u.uid.hashCode.abs()}-${defaultTargetPlatform.name}-install';
      await prefs.setString('installId', id);
      await http.post(
        Uri.parse(deviceEndpoint),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'installId': id,
          'token': token,
          'platform': defaultTargetPlatform.name,
        }),
      );
      await http.post(
        Uri.parse(deviceEndpoint),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${await u.getIdToken()}',
        },
        body: jsonEncode({
          'installId': id,
          'notifications': true,
          'bubbles': true,
        }),
      );
      pushTokenSubscription ??= FirebaseMessaging.instance.onTokenRefresh
          .listen((_) {
            final current = FirebaseAuth.instance.currentUser;
            if (current != null) unawaited(registerDevice(current));
          });
    } catch (_) {}
  }

  @override
  Widget build(BuildContext c) => FutureBuilder<PortalContext>(
    future: load(),
    builder: (c, s) => s.hasError
        ? Scaffold(
            body: Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text('${s.error}'),
              ),
            ),
          )
        : s.hasData
        ? PortalShell(portal: s.data!)
        : const Splash(),
  );
}

class PortalShell extends StatefulWidget {
  const PortalShell({super.key, required this.portal});
  final PortalContext portal;
  @override
  State<PortalShell> createState() => _ShellState();
}

class _ShellState extends State<PortalShell> {
  int index = 0;
  bool navigationVisible = true;
  late String themeId;
  late Map<String, dynamic> themePreferences;
  StreamSubscription<DocumentSnapshot<Map<String, dynamic>>>? themeSubscription;

  @override
  void initState() {
    super.initState();
    themeId = widget.portal.themeId;
    themePreferences = Map.of(widget.portal.themePreferences);
    final uid = widget.portal.userId;
    if (uid.isNotEmpty) {
      themeSubscription = FirebaseFirestore.instance
          .collection('profiles')
          .doc(uid)
          .snapshots()
          .listen((snapshot) {
            final data = snapshot.data();
            if (data == null || !mounted) return;
            final nextId = '${data['theme'] ?? data['Theme'] ?? themeId}';
            final nextPreferences = data['themePreferences'] is Map
                ? Map<String, dynamic>.from(data['themePreferences'] as Map)
                : themePreferences;
            if (nextId != themeId ||
                '$nextPreferences' != '$themePreferences') {
              setState(() {
                themeId = nextId;
                themePreferences = nextPreferences;
              });
            }
          });
    }
  }

  Future<void> saveTheme(String id, Map<String, dynamic> preferences) async {
    final uid = widget.portal.userId;
    if (uid.isEmpty) return;
    await FirebaseFirestore.instance.collection('profiles').doc(uid).set({
      'theme': id,
      'themePreferences': preferences,
      'updatedAt': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));
    if (mounted)
      setState(() {
        themeId = id;
        themePreferences = Map.of(preferences);
      });
  }

  @override
  void dispose() {
    themeSubscription?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext c) {
    final pages = [
      EnhancedDashboardScreen(widget.portal),
      EnhancedCommunityScreen(widget.portal),
      ScheduleScreen(widget.portal),
      MoreScreen(
        widget.portal,
        themeId: themeId,
        themePreferences: themePreferences,
        onSaveTheme: saveTheme,
      ),
      AccountScreen(
        widget.portal,
        themeId: themeId,
        themePreferences: themePreferences,
        onSaveTheme: saveTheme,
      ),
    ];
    final palette = AppPalette.fromTheme(themeId, themePreferences);
    return Theme(
      data: palette.theme(),
      child: Scaffold(
        body: IndexedStack(index: index, children: pages),
        bottomNavigationBar: AnimatedSwitcher(
          duration: const Duration(milliseconds: 220),
          child: navigationVisible
              ? GestureDetector(
                  key: const ValueKey('navigation'),
                  behavior: HitTestBehavior.translucent,
                  onVerticalDragEnd: (details) {
                    if ((details.primaryVelocity ?? 0) > 180) {
                      setState(() => navigationVisible = false);
                    }
                  },
                  child: NavigationBar(
                    selectedIndex: index,
                    onDestinationSelected: (v) => setState(() => index = v),
                    destinations: const [
                      NavigationDestination(
                        icon: Icon(Icons.space_dashboard_outlined),
                        selectedIcon: Icon(Icons.space_dashboard),
                        label: 'Home',
                      ),
                      NavigationDestination(
                        icon: Icon(Icons.forum_outlined),
                        selectedIcon: Icon(Icons.forum),
                        label: 'Community',
                      ),
                      NavigationDestination(
                        icon: Icon(Icons.calendar_month_outlined),
                        selectedIcon: Icon(Icons.calendar_month),
                        label: 'Schedule',
                      ),
                      NavigationDestination(
                        icon: Icon(Icons.grid_view_outlined),
                        selectedIcon: Icon(Icons.grid_view),
                        label: 'Hubs',
                      ),
                      NavigationDestination(
                        icon: Icon(Icons.person_outline),
                        selectedIcon: Icon(Icons.person),
                        label: 'Account',
                      ),
                    ],
                  ),
                )
              : SafeArea(
                  key: const ValueKey('navigation-handle'),
                  top: false,
                  minimum: const EdgeInsets.only(bottom: 5),
                  child: Center(
                    child: GestureDetector(
                      onVerticalDragEnd: (details) {
                        if ((details.primaryVelocity ?? 0) < -100) {
                          setState(() => navigationVisible = true);
                        }
                      },
                      child: Tooltip(
                        message: 'Show navigation',
                        child: IconButton.filledTonal(
                          onPressed: () =>
                              setState(() => navigationVisible = true),
                          icon: const Icon(Icons.keyboard_arrow_up),
                        ),
                      ),
                    ),
                  ),
                ),
        ),
      ),
    );
  }
}

class EnhancedDashboardScreen extends StatelessWidget {
  const EnhancedDashboardScreen(this.portal, {super.key});
  final PortalContext portal;

  @override
  Widget build(BuildContext context) {
    final eventPath = 'productions/${portal.productionId}/events';
    final announcementPath = 'productions/${portal.productionId}/announcements';
    return PortalPage(
      title: 'Hello, ${portal.name.split(' ').first}',
      subtitle: portal.title,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 30),
        children: [
          HeroCard(portal),
          const SizedBox(height: 18),
          StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
            stream: FirebaseFirestore.instance
                .collection(eventPath)
                .snapshots(),
            builder: (context, snapshot) {
              final events =
                  (snapshot.data?.docs ?? [])
                      .where((doc) => visibleRecord(doc.data()))
                      .map((doc) => PortalEvent(doc.reference, doc.data()))
                      .where((event) => event.upcoming)
                      .toList()
                    ..sort(
                      (a, b) => (a.start ?? DateTime(2100)).compareTo(
                        b.start ?? DateTime(2100),
                      ),
                    );
              if (events.isEmpty)
                return const _LoadStateCard(
                  icon: Icons.event_available,
                  title: 'Up next',
                  message: 'No upcoming call has been published.',
                );
              final event = events.first, when = event.start;
              final days = when == null
                  ? null
                  : DateUtils.dateOnly(when)
                        .difference(DateUtils.dateOnly(DateTime.now()))
                        .inDays;
              return Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(24),
                  gradient: LinearGradient(
                    colors: [
                      _eventColor(event.type).withValues(alpha: .82),
                      Theme.of(context).colorScheme.surface,
                    ],
                  ),
                ),
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.bolt),
                        const SizedBox(width: 7),
                        Text(
                          'UP NEXT${days == null
                              ? ''
                              : days == 0
                              ? ' · TODAY'
                              : days == 1
                              ? ' · TOMORROW'
                              : ' · IN $days DAYS'}',
                          style: const TextStyle(
                            fontWeight: FontWeight.w900,
                            letterSpacing: .8,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      event.title,
                      style: const TextStyle(
                        fontSize: 23,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    if (when != null)
                      Text(
                        '${DateFormat('EEEE, MMMM d').format(when)} · ${event.call != null ? 'Call ${DateFormat.jm().format(event.call!)} · ' : ''}${DateFormat.jm().format(when)}${event.end != null ? '–${DateFormat.jm().format(event.end!)}' : ''}',
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                    if (event.location.isNotEmpty) Text('⌖ ${event.location}'),
                    if (event.called.isNotEmpty)
                      Text('Called: ${event.called}'),
                    if (event.whatToBring.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text(
                          'Bring: ${event.whatToBring}',
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                      ),
                  ],
                ),
              );
            },
          ),
          const SizedBox(height: 18),
          const SectionTitle('Announcement spotlight'),
          StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
            stream: FirebaseFirestore.instance
                .collection(announcementPath)
                .snapshots(),
            builder: (context, snapshot) {
              final announcements =
                  (snapshot.data?.docs ?? [])
                      .where((doc) => visibleRecord(doc.data()))
                      .map(
                        (doc) => PortalAnnouncement(doc.reference, doc.data()),
                      )
                      .toList()
                    ..sort((a, b) {
                      if (a.urgent != b.urgent) return a.urgent ? -1 : 1;
                      if (a.pinned != b.pinned) return a.pinned ? -1 : 1;
                      return (b.publishedAt ?? DateTime(1970)).compareTo(
                        a.publishedAt ?? DateTime(1970),
                      );
                    });
              if (announcements.isEmpty)
                return const _LoadStateCard(
                  icon: Icons.campaign_outlined,
                  title: 'You are caught up',
                  message: 'New production announcements will appear here.',
                );
              final item = announcements.first;
              final accent = item.urgent
                  ? Colors.redAccent
                  : Theme.of(context).colorScheme.primary;
              return Card(
                child: Container(
                  decoration: BoxDecoration(
                    border: Border(left: BorderSide(color: accent, width: 6)),
                    borderRadius: BorderRadius.circular(18),
                  ),
                  padding: const EdgeInsets.all(17),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(
                            item.urgent
                                ? Icons.warning_amber_rounded
                                : Icons.campaign,
                            color: accent,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            item.priority.toUpperCase(),
                            style: TextStyle(
                              color: accent,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          if (item.pinned)
                            const Padding(
                              padding: EdgeInsets.only(left: 7),
                              child: Icon(Icons.push_pin, size: 16),
                            ),
                        ],
                      ),
                      const SizedBox(height: 9),
                      Text(
                        item.title,
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 5),
                      Text(item.body),
                      if (item.location.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text('⌖ ${item.location}'),
                        ),
                      if (item.deadlineAt != null)
                        Text(
                          'Deadline ${DateFormat('MMM d · h:mm a').format(item.deadlineAt!)}',
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                      const SizedBox(height: 8),
                      Text(
                        'Posted by ${item.author}',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
          const SizedBox(height: 18),
          _CommunityPreview(portal),
          const SizedBox(height: 14),
          const _ContinueCard(),
          if (portal.admin) ...[
            const SizedBox(height: 18),
            ExpansionTile(
              title: const Text(
                'Administrator commands',
                style: TextStyle(fontWeight: FontWeight.w900),
              ),
              leading: const Icon(Icons.admin_panel_settings),
              children: [
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    FilledButton.tonalIcon(
                      onPressed: () => editProductionItem(
                        context,
                        FirebaseFirestore.instance.collection(announcementPath),
                        kind: 'announcement',
                      ),
                      icon: const Icon(Icons.campaign),
                      label: const Text('Publish announcement'),
                    ),
                    FilledButton.tonalIcon(
                      onPressed: () => editProductionItem(
                        context,
                        FirebaseFirestore.instance.collection(eventPath),
                        kind: 'event',
                      ),
                      icon: const Icon(Icons.event),
                      label: const Text('Add schedule item'),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _CommunityPreview extends StatelessWidget {
  const _CommunityPreview(this.portal);
  final PortalContext portal;
  @override
  Widget build(BuildContext context) {
    var query = FirebaseFirestore.instance
        .collection(
          'productions/${portal.productionId}/communicationConversations',
        )
        .limit(12);
    if (!portal.admin)
      query = query.where('memberIds', arrayContains: portal.userId);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionTitle('Community'),
        SizedBox(
          height: 106,
          child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
            stream: query.snapshots(),
            builder: (context, snapshot) {
              final rooms = (snapshot.data?.docs ?? [])
                  .where((doc) => visibleRecord(doc.data()))
                  .take(3)
                  .toList();
              if (rooms.isEmpty)
                return const _LoadStateCard(
                  icon: Icons.forum_outlined,
                  title: 'No unread messages',
                  message: 'Your production conversations are caught up.',
                );
              return ListView(
                scrollDirection: Axis.horizontal,
                children: rooms.map((doc) {
                  final room = doc.data(),
                      color = hexColor('${room['groupColor'] ?? '#9b1c31'}');
                  return Container(
                    width: 245,
                    margin: const EdgeInsets.only(right: 9),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          color,
                          hexColor(
                            '${room['groupSecondaryColor'] ?? '#f0bf52'}',
                          ),
                        ],
                      ),
                      borderRadius: BorderRadius.circular(19),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${room['groupIcon'] ?? '🎭'}  ${room['title'] ?? 'Conversation'}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const Spacer(),
                        Text(
                          '${room['lastSenderName'] ?? ''}${room['lastSenderName'] != null ? ': ' : ''}${room['lastMessage'] ?? room['description'] ?? ''}',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: .88),
                          ),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _ContinueCard extends StatelessWidget {
  const _ContinueCard();
  @override
  Widget build(BuildContext context) => FutureBuilder<SharedPreferences>(
    future: SharedPreferences.getInstance(),
    builder: (context, snapshot) {
      final preferences = snapshot.data;
      final title = preferences?.getString('scoreFlow.lastTitle') ?? '';
      final page = preferences?.getInt('scoreFlow.lastPage') ?? 0;
      if (title.isEmpty) return const SizedBox.shrink();
      return Card(
        child: ListTile(
          leading: const CircleAvatar(child: Icon(Icons.menu_book)),
          title: const Text(
            'Continue in ScoreFlow',
            style: TextStyle(fontWeight: FontWeight.w900),
          ),
          subtitle: Text('$title${page > 0 ? ' · page $page' : ''}'),
        ),
      );
    },
  );
}

class DashboardScreen extends StatelessWidget {
  const DashboardScreen(this.portal, {super.key});
  final PortalContext portal;
  @override
  Widget build(BuildContext c) => PortalPage(
    title: 'Hello, ${portal.name.split(' ').first}',
    subtitle: portal.title,
    child: ListView(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 30),
      children: [
        HeroCard(portal),
        const SizedBox(height: 18),
        const SectionTitle('Latest announcements'),
        CollectionCards(
          'productions/${portal.productionId}/announcements',
          'No announcements yet.',
          admin: portal.admin,
          kind: 'announcement',
        ),
        const SizedBox(height: 18),
        const SectionTitle('Upcoming calls'),
        CollectionCards(
          'productions/${portal.productionId}/events',
          'No upcoming calls.',
          admin: portal.admin,
          kind: 'event',
        ),
      ],
    ),
  );
}

class HeroCard extends StatelessWidget {
  const HeroCard(this.portal, {super.key});
  final PortalContext portal;
  @override
  Widget build(BuildContext c) => Container(
    padding: const EdgeInsets.all(22),
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(26),
      gradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          Theme.of(c).colorScheme.primary.withValues(alpha: .92),
          Theme.of(c).colorScheme.secondary.withValues(alpha: .55),
          Theme.of(c).colorScheme.surface,
        ],
      ),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            ProfileAvatar(
              name: portal.name,
              fileId: portal.photoFileId,
              url: portal.photoUrl,
              radius: 31,
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'BEDFORD COMPANY',
                    style: TextStyle(
                      letterSpacing: 2,
                      fontSize: 11,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    portal.name,
                    style: const TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Text(
          portal.admin ? 'Production command centre' : 'Your rehearsal hub',
          style: Theme.of(c).textTheme.headlineSmall
              ?.copyWith(fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 8),
        Text(
          portal.admin
              ? 'Direct access to messages, calls, people, and production workspaces.'
              : 'Messages, calls, practice materials, and production spaces with offline caching.',
        ),
      ],
    ),
  );
}

Future<void> editProductionItem(
  BuildContext context,
  Object reference, {
  required String kind,
  Map<String, dynamic>? existing,
}) async {
  final title = TextEditingController(
    text: '${existing?['title'] ?? existing?['Title'] ?? ''}',
  );
  final details = TextEditingController(
    text:
        '${existing?['body'] ?? existing?['Body'] ?? existing?['description'] ?? existing?['Description'] ?? ''}',
  );
  final date = TextEditingController(
    text:
        '${existing?['date'] ?? existing?['Date'] ?? existing?['startAt'] ?? ''}',
  );
  final time = TextEditingController(
    text: '${existing?['time'] ?? existing?['Time'] ?? ''}',
  );
  final saved = await showDialog<bool>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: Text(
        existing == null
            ? 'Add ${kind == 'event' ? 'schedule item' : 'announcement'}'
            : 'Edit ${kind == 'event' ? 'schedule item' : 'announcement'}',
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: title,
              autofocus: true,
              decoration: const InputDecoration(labelText: 'Title'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: details,
              maxLines: 5,
              decoration: InputDecoration(
                labelText: kind == 'event' ? 'Details' : 'Message',
              ),
            ),
            if (kind == 'event') ...[
              const SizedBox(height: 12),
              TextField(
                controller: date,
                decoration: const InputDecoration(labelText: 'Date'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: time,
                decoration: const InputDecoration(labelText: 'Time'),
              ),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(dialogContext, false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(dialogContext, true),
          child: const Text('Save'),
        ),
      ],
    ),
  );
  if (saved != true || title.text.trim().isEmpty) return;
  final values = <String, dynamic>{
    'title': title.text.trim(),
    'status': 'Active',
    'updatedAt': FieldValue.serverTimestamp(),
  };
  if (kind == 'event') {
    values.addAll({
      'description': details.text.trim(),
      'date': date.text.trim(),
      'time': time.text.trim(),
    });
  } else {
    values['body'] = details.text.trim();
  }
  if (existing == null) {
    values['createdAt'] = FieldValue.serverTimestamp();
    await (reference as CollectionReference<Map<String, dynamic>>).add(values);
  } else {
    await (reference as DocumentReference<Map<String, dynamic>>).set(
      values,
      SetOptions(merge: true),
    );
  }
}

Future<void> deleteProductionItem(
  BuildContext context,
  DocumentReference<Map<String, dynamic>> reference,
  String label,
) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: const Text('Delete permanently?'),
      content: Text(
        '“$label” will be removed immediately. This cannot be undone.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(dialogContext, false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          style: FilledButton.styleFrom(
            backgroundColor: Colors.redAccent,
            foregroundColor: Colors.white,
          ),
          onPressed: () => Navigator.pop(dialogContext, true),
          child: const Text('Delete'),
        ),
      ],
    ),
  );
  if (confirmed == true) await reference.delete();
}

class CollectionCards extends StatelessWidget {
  const CollectionCards(
    this.path,
    this.empty, {
    super.key,
    this.admin = false,
    this.kind = 'item',
  });
  final String path, empty, kind;
  final bool admin;
  @override
  Widget build(
    BuildContext c,
  ) => StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
    stream: FirebaseFirestore.instance.collection(path).snapshots(),
    builder: (c, s) {
      if (s.hasError) {
        return _LoadStateCard(
          icon: Icons.cloud_off_rounded,
          title: 'Could not refresh',
          message:
              'Saved content remains available when the connection returns.',
        );
      }
      if (!s.hasData) {
        return const Padding(
          padding: EdgeInsets.all(24),
          child: Center(child: CircularProgressIndicator()),
        );
      }
      final docs = s.data!.docs.where((x) => visibleRecord(x.data())).toList();
      docs.sort((a, b) {
        if (kind == 'event') {
          final left =
              PortalEvent(a.reference, a.data()).start ?? DateTime(2100);
          final right =
              PortalEvent(b.reference, b.data()).start ?? DateTime(2100);
          return left.compareTo(right);
        }
        final left = PortalAnnouncement(a.reference, a.data());
        final right = PortalAnnouncement(b.reference, b.data());
        if (left.pinned != right.pinned) return left.pinned ? -1 : 1;
        return (right.publishedAt ?? DateTime(1970)).compareTo(
          left.publishedAt ?? DateTime(1970),
        );
      });
      final visibleDocs = docs
          .where(
            (x) =>
                kind != 'event' || PortalEvent(x.reference, x.data()).upcoming,
          )
          .take(5)
          .toList();
      if (visibleDocs.isEmpty && !admin) {
        return Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Text(
              empty,
              style: TextStyle(color: Theme.of(c).colorScheme.onSurfaceVariant),
            ),
          ),
        );
      }
      return Column(
        children: [
          if (admin)
            Align(
              alignment: Alignment.centerRight,
              child: FilledButton.tonalIcon(
                onPressed: () => editProductionItem(
                  c,
                  FirebaseFirestore.instance.collection(path),
                  kind: kind,
                ),
                icon: const Icon(Icons.add),
                label: Text(
                  kind == 'event' ? 'Add schedule item' : 'Add announcement',
                ),
              ),
            ),
          ...visibleDocs.map((x) {
            final i = x.data();
            return Card(
              child: ListTile(
                contentPadding: const EdgeInsets.all(15),
                leading: const CircleAvatar(child: Icon(Icons.campaign)),
                title: Text(
                  '${i['title'] ?? i['Title'] ?? i['event'] ?? i['Event'] ?? 'Production update'}',
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                subtitle: Text(
                  '${i['body'] ?? i['Body'] ?? i['description'] ?? i['Description'] ?? i['date'] ?? i['Date'] ?? ''}',
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                ),
                trailing: admin
                    ? PopupMenuButton<String>(
                        onSelected: (action) => action == 'edit'
                            ? editProductionItem(
                                c,
                                x.reference,
                                kind: kind,
                                existing: i,
                              )
                            : deleteProductionItem(
                                c,
                                x.reference,
                                '${i['title'] ?? i['Title'] ?? 'this item'}',
                              ),
                        itemBuilder: (_) => const [
                          PopupMenuItem(
                            value: 'edit',
                            child: ListTile(
                              leading: Icon(Icons.edit),
                              title: Text('Edit'),
                            ),
                          ),
                          PopupMenuItem(
                            value: 'delete',
                            child: ListTile(
                              leading: Icon(
                                Icons.delete_forever,
                                color: Colors.redAccent,
                              ),
                              title: Text('Delete permanently'),
                            ),
                          ),
                        ],
                      )
                    : null,
              ),
            );
          }),
        ],
      );
    },
  );
}

class _LoadStateCard extends StatelessWidget {
  const _LoadStateCard({
    required this.icon,
    required this.title,
    required this.message,
  });
  final IconData icon;
  final String title, message;
  @override
  Widget build(BuildContext context) => Card(
    child: ListTile(
      contentPadding: const EdgeInsets.all(18),
      leading: Icon(icon),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
      subtitle: Text(message),
    ),
  );
}

const _communityColours = <Color>[
  Color(0xff9b1c31),
  Color(0xffd2183b),
  Color(0xffff365b),
  Color(0xffff6b6b),
  Color(0xffc62828),
  Color(0xffef6c00),
  Color(0xffff9800),
  Color(0xfff0bf52),
  Color(0xffffd54f),
  Color(0xff8bc34a),
  Color(0xff2e7d32),
  Color(0xff00a86b),
  Color(0xff00897b),
  Color(0xff00bfa5),
  Color(0xff00b8d4),
  Color(0xff0277bd),
  Color(0xff1565c0),
  Color(0xff3949ab),
  Color(0xff5c36d9),
  Color(0xff6f4cff),
  Color(0xff7e57c2),
  Color(0xff8e24aa),
  Color(0xffc2185b),
  Color(0xffff4fa3),
  Color(0xff5d4037),
  Color(0xff455a64),
  Color(0xff263238),
  Color(0xff111827),
  Color(0xff374151),
  Color(0xff6b7280),
  Color(0xffd1d5db),
  Color(0xfff8fafc),
];

const _communityColourPairs = <(Color, Color)>[
  (Color(0xff9b1c31), Color(0xfff0bf52)),
  (Color(0xffd2183b), Color(0xff111827)),
  (Color(0xff5c36d9), Color(0xffff4fa3)),
  (Color(0xff1565c0), Color(0xff00b8d4)),
  (Color(0xff00897b), Color(0xff8bc34a)),
  (Color(0xffef6c00), Color(0xffffd54f)),
  (Color(0xff3949ab), Color(0xff7e57c2)),
  (Color(0xffc2185b), Color(0xffff9800)),
  (Color(0xff263238), Color(0xff6b7280)),
  (Color(0xff111827), Color(0xffd1d5db)),
];

Future<Color?> chooseCommunityColour(
  BuildContext context,
  String title,
  Color current,
) async {
  var selected = current;
  final hex = TextEditingController(
    text: selected.toARGB32().toRadixString(16).padLeft(8, '0').substring(2),
  );
  return showDialog<Color>(
    context: context,
    builder: (dialogContext) => StatefulBuilder(
      builder: (context, setPickerState) => AlertDialog(
        title: Text(title),
        content: SizedBox(
          width: 390,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: _communityColours.map((colour) {
                    final chosen = colour.toARGB32() == selected.toARGB32();
                    return InkWell(
                      onTap: () => setPickerState(() {
                        selected = colour;
                        hex.text = colour
                            .toARGB32()
                            .toRadixString(16)
                            .padLeft(8, '0')
                            .substring(2);
                      }),
                      borderRadius: BorderRadius.circular(30),
                      child: Container(
                        width: 42,
                        height: 42,
                        decoration: BoxDecoration(
                          color: colour,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: chosen ? Colors.white : Colors.white30,
                            width: chosen ? 4 : 1,
                          ),
                        ),
                        child: chosen
                            ? const Icon(Icons.check, color: Colors.white)
                            : null,
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 20),
                TextField(
                  controller: hex,
                  maxLength: 7,
                  textCapitalization: TextCapitalization.characters,
                  decoration: const InputDecoration(
                    labelText: 'Custom HEX colour',
                    prefixText: '#',
                    hintText: '9B1C31',
                  ),
                  onChanged: (value) {
                    final clean = value.replaceAll('#', '').trim();
                    if (RegExp(r'^[0-9a-fA-F]{6}$').hasMatch(clean)) {
                      setPickerState(
                        () =>
                            selected = Color(int.parse('ff$clean', radix: 16)),
                      );
                    }
                  },
                ),
                Container(
                  height: 52,
                  decoration: BoxDecoration(
                    color: selected,
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, selected),
            child: const Text('Use colour'),
          ),
        ],
      ),
    ),
  );
}

Future<void> editConversation(
  BuildContext context,
  Object reference, {
  required String userId,
  Map<String, dynamic>? existing,
}) async {
  final title = TextEditingController(text: '${existing?['title'] ?? ''}');
  final description = TextEditingController(
    text: '${existing?['description'] ?? ''}',
  );
  final icon = TextEditingController(text: '${existing?['groupIcon'] ?? '🎭'}');
  var primary = hexColor('${existing?['groupColor'] ?? '#9b1c31'}');
  var secondary = hexColor('${existing?['groupSecondaryColor'] ?? '#f0bf52'}');
  final photo = TextEditingController(
    text: '${existing?['groupPhotoURL'] ?? existing?['groupPhotoUrl'] ?? ''}',
  );
  var style = '${existing?['groupThemeStyle'] ?? 'gradient'}';
  var direction = '${existing?['gradientDirection'] ?? 'diagonal'}';
  var lightText = existing?['lightForeground'] != false;
  final saved = await showDialog<bool>(
    context: context,
    builder: (dialogContext) => StatefulBuilder(
      builder: (context, setDialogState) => AlertDialog(
        title: Text(
          existing == null ? 'Create conversation' : 'Edit conversation',
        ),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: title,
                decoration: const InputDecoration(labelText: 'Group name'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: description,
                maxLines: 3,
                decoration: const InputDecoration(labelText: 'Description'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: icon,
                maxLength: 4,
                decoration: const InputDecoration(labelText: 'Icon'),
              ),
              TextField(
                controller: photo,
                decoration: const InputDecoration(
                  labelText: 'Group image URL (optional)',
                ),
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                initialValue: style,
                decoration: const InputDecoration(labelText: 'Card style'),
                items: const [
                  DropdownMenuItem(value: 'gradient', child: Text('Gradient')),
                  DropdownMenuItem(value: 'solid', child: Text('Solid')),
                ],
                onChanged: (value) =>
                    setDialogState(() => style = value ?? 'gradient'),
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                initialValue: direction,
                decoration: const InputDecoration(
                  labelText: 'Gradient direction',
                ),
                items: const [
                  DropdownMenuItem(value: 'diagonal', child: Text('Diagonal')),
                  DropdownMenuItem(
                    value: 'horizontal',
                    child: Text('Horizontal'),
                  ),
                  DropdownMenuItem(value: 'vertical', child: Text('Vertical')),
                ],
                onChanged: (value) =>
                    setDialogState(() => direction = value ?? 'diagonal'),
              ),
              SwitchListTile(
                value: lightText,
                onChanged: (value) => setDialogState(() => lightText = value),
                title: const Text('Light foreground text'),
              ),
              const SizedBox(height: 8),
              const Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'Suggested combinations',
                  style: TextStyle(fontWeight: FontWeight.w800),
                ),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: _communityColourPairs.map((pair) {
                  return InkWell(
                    onTap: () => setDialogState(() {
                      primary = pair.$1;
                      secondary = pair.$2;
                    }),
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      width: 60,
                      height: 38,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(colors: [pair.$1, pair.$2]),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.white24),
                      ),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 8),
              ListTile(
                title: const Text('Primary colour'),
                subtitle: const Text('Choose from 32 colours or enter HEX'),
                trailing: CircleAvatar(backgroundColor: primary),
                onTap: () async {
                  final colour = await chooseCommunityColour(
                    dialogContext,
                    'Primary colour',
                    primary,
                  );
                  if (colour != null) setDialogState(() => primary = colour);
                },
              ),
              ListTile(
                title: const Text('Secondary colour'),
                subtitle: const Text('Choose from 32 colours or enter HEX'),
                trailing: CircleAvatar(backgroundColor: secondary),
                onTap: () async {
                  final colour = await chooseCommunityColour(
                    dialogContext,
                    'Secondary colour',
                    secondary,
                  );
                  if (colour != null) setDialogState(() => secondary = colour);
                },
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Save'),
          ),
        ],
      ),
    ),
  );
  if (saved != true || title.text.trim().isEmpty) return;
  String colorHex(Color value) =>
      '#${value.toARGB32().toRadixString(16).padLeft(8, '0').substring(2)}';
  final uid = userId;
  final values = <String, dynamic>{
    'title': title.text.trim(),
    'description': description.text.trim(),
    'groupIcon': icon.text.trim().isEmpty ? '🎭' : icon.text.trim(),
    'groupColor': colorHex(primary),
    'groupSecondaryColor': colorHex(secondary),
    'groupPhotoURL': photo.text.trim(),
    'groupThemeStyle': style,
    'gradientDirection': direction,
    'lightForeground': lightText,
    'status': 'Active',
    'updatedAt': FieldValue.serverTimestamp(),
  };
  if (existing == null) {
    values.addAll({
      'type': 'custom',
      'memberIds': [uid],
      'adminIds': [uid],
      'createdAt': FieldValue.serverTimestamp(),
    });
    await (reference as CollectionReference<Map<String, dynamic>>).add(values);
  } else {
    await (reference as DocumentReference<Map<String, dynamic>>).set(
      values,
      SetOptions(merge: true),
    );
  }
}

class CommunityScreen extends StatelessWidget {
  const CommunityScreen(this.portal, {super.key});
  final PortalContext portal;
  @override
  Widget build(BuildContext c) => PortalPage(
    title: 'Community',
    subtitle: 'Live production conversations',
    child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: portal.admin
          ? FirebaseFirestore.instance
                .collection(
                  'productions/${portal.productionId}/communicationConversations',
                )
                .snapshots()
          : FirebaseFirestore.instance
                .collection(
                  'productions/${portal.productionId}/communicationConversations',
                )
                .where('memberIds', arrayContains: portal.userId)
                .snapshots(),
      builder: (c, s) {
        if (!s.hasData) return const Center(child: CircularProgressIndicator());
        final rooms =
            s.data!.docs
                .where(
                  (x) =>
                      '${x.data()['status'] ?? 'Active'}'.toLowerCase() ==
                      'active',
                )
                .toList()
              ..sort(
                (a, b) =>
                    ((b.data()['lastMessageAt'] as Timestamp?)
                                ?.millisecondsSinceEpoch ??
                            0)
                        .compareTo(
                          (a.data()['lastMessageAt'] as Timestamp?)
                                  ?.millisecondsSinceEpoch ??
                              0,
                        ),
              );
        return ListView.builder(
          padding: const EdgeInsets.all(14),
          itemCount: rooms.length + (portal.admin ? 1 : 0),
          itemBuilder: (c, n) {
            if (portal.admin && n == 0)
              return Card(
                child: ListTile(
                  leading: const CircleAvatar(child: Icon(Icons.add_comment)),
                  title: const Text(
                    'Create conversation',
                    style: TextStyle(fontWeight: FontWeight.w900),
                  ),
                  subtitle: const Text('Administrator-controlled group'),
                  onTap: () => editConversation(
                    c,
                    FirebaseFirestore.instance.collection(
                      'productions/${portal.productionId}/communicationConversations',
                    ),
                    userId: portal.userId,
                  ),
                ),
              );
            final x = rooms[n - (portal.admin ? 1 : 0)],
                r = x.data(),
                color = hexColor('${r['groupColor'] ?? '#9b1c31'}');
            return Card(
              color: Color.lerp(Theme.of(c).colorScheme.surface, color, .14),
              child: ListTile(
                contentPadding: const EdgeInsets.all(13),
                leading: CircleAvatar(
                  backgroundColor: color,
                  child: Text('${r['groupIcon'] ?? '🎭'}'),
                ),
                title: Text(
                  '${r['title'] ?? 'Conversation'}',
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
                subtitle: Text(
                  '${r['lastMessage'] ?? r['description'] ?? 'Official production space'}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                trailing: portal.admin
                    ? PopupMenuButton<String>(
                        onSelected: (action) => action == 'edit'
                            ? editConversation(
                                c,
                                x.reference,
                                userId: portal.userId,
                                existing: r,
                              )
                            : deleteProductionItem(
                                c,
                                x.reference,
                                '${r['title'] ?? 'this conversation'}',
                              ),
                        itemBuilder: (_) => const [
                          PopupMenuItem(
                            value: 'edit',
                            child: ListTile(
                              leading: Icon(Icons.palette),
                              title: Text('Edit group'),
                            ),
                          ),
                          PopupMenuItem(
                            value: 'delete',
                            child: ListTile(
                              leading: Icon(
                                Icons.delete_forever,
                                color: Colors.redAccent,
                              ),
                              title: Text('Delete permanently'),
                            ),
                          ),
                        ],
                      )
                    : const Icon(Icons.chevron_right),
                onTap: () => Navigator.push(
                  c,
                  MaterialPageRoute(
                    builder: (_) => ChatScreen(portal, x.id, r),
                  ),
                ),
              ),
            );
          },
        );
      },
    ),
  );
}

class EnhancedCommunityScreen extends StatefulWidget {
  const EnhancedCommunityScreen(this.portal, {super.key});
  final PortalContext portal;
  @override
  State<EnhancedCommunityScreen> createState() => _EnhancedCommunityState();
}

class _EnhancedCommunityState extends State<EnhancedCommunityScreen>
    with SingleTickerProviderStateMixin {
  late final TabController tabs;
  String search = '';
  bool unreadOnly = false;
  static const categories = ['class', 'ensemble', 'production'];
  @override
  void initState() {
    super.initState();
    tabs = TabController(length: 3, vsync: this)
      ..addListener(() {
        if (mounted) setState(() {});
      });
  }

  @override
  void dispose() {
    tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final collection = FirebaseFirestore.instance.collection(
      'productions/${widget.portal.productionId}/communicationConversations',
    );
    return PortalPage(
      title: 'Community',
      subtitle: 'Classes, ensembles, and production teams',
      child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
        stream: widget.portal.admin
            ? collection.snapshots()
            : collection
                  .where('memberIds', arrayContains: widget.portal.userId)
                  .snapshots(),
        builder: (context, snapshot) {
          if (snapshot.hasError)
            return const Center(
              child: _LoadStateCard(
                icon: Icons.forum_outlined,
                title: 'Community unavailable',
                message: 'Check your connection and try again.',
              ),
            );
          if (!snapshot.hasData)
            return const Center(child: CircularProgressIndicator());
          final currentCategory = categories[tabs.index];
          final rooms =
              snapshot.data!.docs.where((doc) {
                final data = doc.data();
                final haystack =
                    '${data['title'] ?? ''} ${data['description'] ?? ''} ${data['lastMessage'] ?? ''}'
                        .toLowerCase();
                final unread = (data['unreadCount'] as num?)?.toInt() ?? 0;
                return visibleRecord(data) &&
                    conversationCategory(data) == currentCategory &&
                    (!unreadOnly || unread > 0) &&
                    (search.isEmpty || haystack.contains(search));
              }).toList()..sort((a, b) {
                final ap = boolField(a.data(), const ['pinned', 'Pinned']),
                    bp = boolField(b.data(), const ['pinned', 'Pinned']);
                if (ap != bp) return ap ? -1 : 1;
                final au = (a.data()['unreadCount'] as num?)?.toInt() ?? 0,
                    bu = (b.data()['unreadCount'] as num?)?.toInt() ?? 0;
                if ((au > 0) != (bu > 0)) return au > 0 ? -1 : 1;
                return (dateField(b.data(), const ['lastMessageAt']) ??
                        DateTime(1970))
                    .compareTo(
                      dateField(a.data(), const ['lastMessageAt']) ??
                          DateTime(1970),
                    );
              });
          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 8, 14, 5),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        onChanged: (value) =>
                            setState(() => search = value.trim().toLowerCase()),
                        decoration: const InputDecoration(
                          prefixIcon: Icon(Icons.search),
                          hintText: 'Search conversations',
                        ),
                      ),
                    ),
                    const SizedBox(width: 7),
                    FilterChip(
                      label: const Text('Unread'),
                      selected: unreadOnly,
                      onSelected: (value) => setState(() => unreadOnly = value),
                    ),
                    if (widget.portal.admin) ...[
                      const SizedBox(width: 5),
                      IconButton.filled(
                        onPressed: () => editConversation(
                          context,
                          collection,
                          userId: widget.portal.userId,
                        ),
                        tooltip: 'Create conversation',
                        icon: const Icon(Icons.add_comment),
                      ),
                    ],
                  ],
                ),
              ),
              TabBar(
                controller: tabs,
                tabs: const [
                  Tab(text: 'Classes'),
                  Tab(text: 'Ensembles'),
                  Tab(text: 'Production Team'),
                ],
              ),
              Expanded(
                child: rooms.isEmpty
                    ? const Center(
                        child: _LoadStateCard(
                          icon: Icons.mark_chat_unread_outlined,
                          title: 'No conversations here',
                          message: 'Assigned production spaces will appear in this tab.',
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.all(14),
                        itemCount: rooms.length,
                        itemBuilder: (context, index) {
                          final doc = rooms[index], room = doc.data();
                          final primary = hexColor(
                                '${room['groupColor'] ?? '#9b1c31'}',
                              ),
                              secondary = hexColor(
                                '${room['groupSecondaryColor'] ?? '#f0bf52'}',
                              );
                          final unread =
                              (room['unreadCount'] as num?)?.toInt() ?? 0;
                          final photo =
                              '${room['groupPhotoURL'] ?? room['groupPhotoUrl'] ?? ''}';
                          final solid =
                              '${room['groupThemeStyle'] ?? 'gradient'}' ==
                              'solid';
                          final direction =
                              '${room['gradientDirection'] ?? 'diagonal'}';
                          final foreground = room['lightForeground'] == false
                              ? Colors.black87
                              : Colors.white;
                          final begin = direction == 'vertical'
                              ? Alignment.topCenter
                              : Alignment.topLeft;
                          final end = direction == 'horizontal'
                              ? Alignment.centerRight
                              : direction == 'vertical'
                              ? Alignment.bottomCenter
                              : Alignment.bottomRight;
                          return Container(
                            margin: const EdgeInsets.only(bottom: 11),
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: [
                                  primary.withValues(alpha: .92),
                                  solid
                                      ? primary.withValues(alpha: .92)
                                      : secondary.withValues(alpha: .62),
                                ],
                                begin: begin,
                                end: end,
                              ),
                              borderRadius: BorderRadius.circular(21),
                              boxShadow: [
                                BoxShadow(
                                  color: primary.withValues(alpha: .18),
                                  blurRadius: 18,
                                  offset: const Offset(0, 8),
                                ),
                              ],
                            ),
                            child: ListTile(
                              contentPadding: const EdgeInsets.all(14),
                              leading: CircleAvatar(
                                radius: 26,
                                backgroundColor: Colors.black26,
                                backgroundImage: photo.startsWith('http')
                                    ? CachedNetworkImageProvider(photo)
                                    : null,
                                child: photo.startsWith('http')
                                    ? null
                                    : Text(
                                        '${room['groupIcon'] ?? '🎭'}',
                                        style: const TextStyle(fontSize: 22),
                                      ),
                              ),
                              title: Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      '${room['title'] ?? 'Conversation'}',
                                      style: TextStyle(
                                        fontWeight: FontWeight.w900,
                                        color: foreground,
                                      ),
                                    ),
                                  ),
                                  if (boolField(room, const [
                                    'pinned',
                                    'Pinned',
                                  ]))
                                    Icon(
                                      Icons.push_pin,
                                      size: 16,
                                      color: foreground,
                                    ),
                                  if (boolField(room, const ['muted', 'Muted']))
                                    Icon(
                                      Icons.notifications_off,
                                      size: 16,
                                      color: foreground.withValues(alpha: .72),
                                    ),
                                ],
                              ),
                              subtitle: Text(
                                '${room['lastSenderName'] != null ? '${room['lastSenderName']}: ' : ''}${room['lastMessage'] ?? room['description'] ?? 'Official production space'}',
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  color: foreground.withValues(alpha: .88),
                                ),
                              ),
                              trailing: widget.portal.admin
                                  ? PopupMenuButton<String>(
                                      onSelected: (action) => action == 'edit'
                                          ? editConversation(
                                              context,
                                              doc.reference,
                                              userId: widget.portal.userId,
                                              existing: room,
                                            )
                                          : deleteProductionItem(
                                              context,
                                              doc.reference,
                                              '${room['title'] ?? 'this conversation'}',
                                            ),
                                      itemBuilder: (_) => const [
                                        PopupMenuItem(
                                          value: 'edit',
                                          child: Text('Edit group'),
                                        ),
                                        PopupMenuItem(
                                          value: 'delete',
                                          child: Text('Delete permanently'),
                                        ),
                                      ],
                                    )
                                  : unread > 0
                                  ? Badge(
                                      label: Text('$unread'),
                                      child: const Icon(
                                        Icons.chevron_right,
                                        color: Colors.white,
                                      ),
                                    )
                                  : const Icon(
                                      Icons.chevron_right,
                                      color: Colors.white,
                                    ),
                              onTap: () => Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) =>
                                      ChatScreen(widget.portal, doc.id, room),
                                ),
                              ),
                            ),
                          );
                        },
                      ),
              ),
            ],
          );
        },
      ),
    );
  }
}

const _chatBackgrounds = <(String, String, IconData, String?, String)>[
  (
    'royal-villain',
    'Royal Villain',
    Icons.auto_awesome,
    'assets/images/chat-backgrounds/royal-villain.jpg',
    'Theatre & fantasy',
  ),
  (
    'enchanted-stage',
    'Enchanted Stage',
    Icons.theater_comedy,
    'assets/images/chat-backgrounds/enchanted-stage.jpg',
    'Theatre & fantasy',
  ),
  (
    'dragon-fire',
    'Dragon Fire',
    Icons.local_fire_department,
    'assets/images/chat-backgrounds/dragon-fire.jpg',
    'Theatre & fantasy',
  ),
  (
    'auradon-castle',
    'Royal Academy',
    Icons.castle,
    'assets/images/chat-backgrounds/auradon-castle.jpg',
    'Theatre & fantasy',
  ),
  (
    'isle-graffiti',
    'Island Graffiti',
    Icons.brush,
    'assets/images/chat-backgrounds/isle-graffiti.jpg',
    'Theatre & fantasy',
  ),
  (
    'magic-mirror',
    'Magic Mirror',
    Icons.blur_on,
    'assets/images/chat-backgrounds/magic-mirror.jpg',
    'Theatre & fantasy',
  ),
  (
    'spotlight-score',
    'Spotlight Score',
    Icons.light_mode,
    'assets/images/chat-backgrounds/spotlight-score.jpg',
    'Theatre & fantasy',
  ),
  (
    'red-curtain',
    'Red Curtain',
    Icons.curtains,
    'assets/images/chat-backgrounds/red-curtain.jpg',
    'Theatre & fantasy',
  ),
  (
    'spring-opening-night',
    'Spring Opening Night',
    Icons.local_florist,
    'assets/images/chat-backgrounds/spring-opening-night.jpg',
    'Seasonal celebrations',
  ),
  (
    'summer-showtime',
    'Summer Showtime',
    Icons.sunny,
    'assets/images/chat-backgrounds/summer-showtime.jpg',
    'Seasonal celebrations',
  ),
  (
    'autumn-playbill',
    'Autumn Playbill',
    Icons.park,
    'assets/images/chat-backgrounds/autumn-playbill.jpg',
    'Seasonal celebrations',
  ),
  (
    'winter-gala',
    'Winter Gala',
    Icons.ac_unit,
    'assets/images/chat-backgrounds/winter-gala.jpg',
    'Seasonal celebrations',
  ),
  (
    'symphony-night',
    'Symphony Night',
    Icons.queue_music,
    'assets/images/chat-backgrounds/symphony-night.jpg',
    'Music collection',
  ),
  (
    'piano-nocturne',
    'Piano Nocturne',
    Icons.piano,
    'assets/images/chat-backgrounds/piano-nocturne.jpg',
    'Music collection',
  ),
  (
    'jazz-stage',
    'Jazz Stage',
    Icons.music_note,
    'assets/images/chat-backgrounds/jazz-stage.jpg',
    'Music collection',
  ),
  (
    'choral-harmony',
    'Choral Harmony',
    Icons.graphic_eq,
    'assets/images/chat-backgrounds/choral-harmony.jpg',
    'Music collection',
  ),
  ('classic', 'Classic', Icons.chat_bubble_outline, null, 'Simple'),
];

BoxDecoration chatBackgroundDecoration(String id, Color accent) {
  final image = _chatBackgrounds.where((item) => item.$1 == id).firstOrNull?.$4;
  if (image != null) {
    return BoxDecoration(
      color: const Color(0xff090a0f),
      image: DecorationImage(
        image: AssetImage(image),
        fit: BoxFit.cover,
        colorFilter: const ColorFilter.mode(
          Color(0x44000000),
          BlendMode.darken,
        ),
      ),
    );
  }
  return switch (id) {
    'curtain' => const BoxDecoration(
      gradient: LinearGradient(
        colors: [Color(0xff25040b), Color(0xff710d23), Color(0xff25040b)],
        stops: [0, .5, 1],
      ),
    ),
    'aurora' => BoxDecoration(
      gradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          const Color(0xff071521),
          accent.withValues(alpha: .42),
          const Color(0xff22102b),
        ],
      ),
    ),
    'score' => const BoxDecoration(
      color: Color(0xff171510),
      gradient: LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [Color(0xff262218), Color(0xff11100d)],
      ),
    ),
    'spotlight' => BoxDecoration(
      gradient: RadialGradient(
        center: const Alignment(0, -.85),
        radius: 1.25,
        colors: [accent.withValues(alpha: .38), const Color(0xff07070a)],
      ),
    ),
    'classic' => const BoxDecoration(color: Color(0xff101116)),
    _ => const BoxDecoration(
      gradient: LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [Color(0xff0b1020), Color(0xff08090d)],
      ),
    ),
  };
}

class ChatScreen extends StatefulWidget {
  const ChatScreen(this.portal, this.roomId, this.room, {super.key});
  final PortalContext portal;
  final String roomId;
  final Map<String, dynamic> room;
  @override
  State<ChatScreen> createState() => _ChatState();
}

class _ChatState extends State<ChatScreen> {
  final text = TextEditingController();
  Map<String, dynamic>? replyingTo;
  Map<String, List<Map<String, dynamic>>> messageReactions = {};
  StreamSubscription<QuerySnapshot<Map<String, dynamic>>>? reactionSubscription;
  bool sending = false;
  String background = 'midnight';

  @override
  void initState() {
    super.initState();
    reactionSubscription = reactions.snapshots().listen((snapshot) {
      final grouped = <String, List<Map<String, dynamic>>>{};
      for (final document in snapshot.docs) {
        final value = document.data();
        (grouped['${value['messageId'] ?? ''}'] ??= []).add(value);
      }
      if (mounted) setState(() => messageReactions = grouped);
    });
    SharedPreferences.getInstance().then((preferences) {
      if (!mounted) return;
      setState(
        () => background =
            preferences.getString('chatBackground.${widget.roomId}') ??
            '${widget.room['chatBackground'] ?? 'midnight'}',
      );
    });
  }

  @override
  void dispose() {
    reactionSubscription?.cancel();
    text.dispose();
    super.dispose();
  }

  Future<void> chooseBackground() async {
    final selected = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (sheetContext) => SafeArea(
        child: SizedBox(
          height: MediaQuery.sizeOf(sheetContext).height * .82,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 0, 18, 0),
                child: Text(
                  'Chat background',
                  style: Theme.of(context).textTheme.titleLarge
                      ?.copyWith(fontWeight: FontWeight.w900),
                ),
              ),
              const SizedBox(height: 6),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 18),
                child: Text(
                  'Preview a style below. Your choice is private to this device.',
                ),
              ),
              const SizedBox(height: 14),
              Expanded(
                child: GridView.builder(
                  padding: const EdgeInsets.fromLTRB(18, 0, 18, 24),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    childAspectRatio: 1.05,
                    crossAxisSpacing: 10,
                    mainAxisSpacing: 10,
                  ),
                  itemCount: _chatBackgrounds.length,
                  itemBuilder: (_, index) {
                    final item = _chatBackgrounds[index],
                        active = item.$1 == background;
                    return InkWell(
                      onTap: () => Navigator.pop(sheetContext, item.$1),
                      borderRadius: BorderRadius.circular(20),
                      child: Container(
                        clipBehavior: Clip.antiAlias,
                        decoration:
                            chatBackgroundDecoration(
                              item.$1,
                              Theme.of(context).colorScheme.primary,
                            ).copyWith(
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: active
                                    ? Theme.of(context).colorScheme.primary
                                    : Colors.white24,
                                width: active ? 3 : 1,
                              ),
                            ),
                        child: Stack(
                          children: [
                            Positioned(
                              top: 12,
                              left: 10,
                              child: Container(
                                constraints: const BoxConstraints(
                                  maxWidth: 118,
                                ),
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                  vertical: 7,
                                ),
                                decoration: BoxDecoration(
                                  color: const Color(0xdd252630),
                                  borderRadius: const BorderRadius.only(
                                    topLeft: Radius.circular(6),
                                    topRight: Radius.circular(15),
                                    bottomRight: Radius.circular(15),
                                    bottomLeft: Radius.circular(15),
                                  ),
                                  boxShadow: const [
                                    BoxShadow(
                                      color: Colors.black38,
                                      blurRadius: 8,
                                    ),
                                  ],
                                ),
                                child: const Text(
                                  'See you at rehearsal!',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 10,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ),
                            Positioned(
                              right: 10,
                              top: 54,
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                  vertical: 7,
                                ),
                                decoration: BoxDecoration(
                                  color: Theme.of(context).colorScheme.primary
                                      .withValues(alpha: .94),
                                  borderRadius: const BorderRadius.only(
                                    topLeft: Radius.circular(15),
                                    topRight: Radius.circular(6),
                                    bottomRight: Radius.circular(15),
                                    bottomLeft: Radius.circular(15),
                                  ),
                                ),
                                child: const Text(
                                  'Perfect! 🎭',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                            ),
                            Positioned(
                              left: 0,
                              right: 0,
                              bottom: 0,
                              child: Container(
                                padding: const EdgeInsets.fromLTRB(
                                  10,
                                  18,
                                  10,
                                  9,
                                ),
                                decoration: const BoxDecoration(
                                  gradient: LinearGradient(
                                    begin: Alignment.topCenter,
                                    end: Alignment.bottomCenter,
                                    colors: [
                                      Colors.transparent,
                                      Color(0xee08090d),
                                    ],
                                  ),
                                ),
                                child: Row(
                                  children: [
                                    Icon(
                                      item.$3,
                                      size: 16,
                                      color: Colors.white,
                                    ),
                                    const SizedBox(width: 6),
                                    Expanded(
                                      child: Text(
                                        item.$2,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 11,
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                                    ),
                                    if (active)
                                      const Icon(
                                        Icons.check_circle,
                                        size: 17,
                                        color: Colors.white,
                                      ),
                                  ],
                                ),
                              ),
                            ),
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
    );
    if (selected == null) return;
    final preferences = await SharedPreferences.getInstance();
    await preferences.setString('chatBackground.${widget.roomId}', selected);
    if (mounted) setState(() => background = selected);
  }

  CollectionReference<Map<String, dynamic>>
  get messages => FirebaseFirestore.instance.collection(
    'productions/${widget.portal.productionId}/communicationConversations/${widget.roomId}/messages',
  );
  CollectionReference<Map<String, dynamic>> get reactions =>
      messages.parent!.collection('reactions');

  Future<void> reactToMessage(String messageId, String emoji) async {
    final reference = reactions.doc('${messageId}_${widget.portal.userId}');
    final prior = await reference.get();
    if (prior.exists && prior.data()?['emoji'] == emoji) {
      await reference.delete();
    } else {
      await reference.set({
        'messageId': messageId,
        'userId': widget.portal.userId,
        'emoji': emoji,
        'createdAt': FieldValue.serverTimestamp(),
      });
    }
  }

  Future<void> showMessageActions(
    Map<String, dynamic> message,
    DocumentReference<Map<String, dynamic>> reference,
  ) async {
    final mine = message['senderId'] == widget.portal.userId;
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Wrap(
              spacing: 5,
              children: ['👍', '❤️', '😂', '😮', '👏', '🎭']
                  .map(
                    (emoji) => IconButton.filledTonal(
                      onPressed: () {
                        Navigator.pop(sheetContext);
                        reactToMessage('${message['_id']}', emoji);
                      },
                      icon: Text(emoji, style: const TextStyle(fontSize: 20)),
                    ),
                  )
                  .toList(),
            ),
            ListTile(
              leading: const Icon(Icons.reply),
              title: const Text('Reply'),
              onTap: () {
                Navigator.pop(sheetContext);
                setState(() => replyingTo = message);
              },
            ),
            if (mine || widget.portal.admin)
              ListTile(
                leading: const Icon(Icons.edit_outlined),
                title: const Text('Edit message'),
                onTap: () {
                  Navigator.pop(sheetContext);
                  editMessage(reference, '${message['text'] ?? ''}');
                },
              ),
          ],
        ),
      ),
    );
  }

  Future<void> send() async {
    final v = text.text.trim();
    if (v.isEmpty || sending) return;
    final reply = replyingTo;
    text.clear();
    setState(() {
      sending = true;
      replyingTo = null;
    });
    try {
      await messages.add({
        'senderId': widget.portal.userId,
        'senderName': widget.portal.name,
        'text': v,
        'createdAt': FieldValue.serverTimestamp(),
        'clientCreatedAt': DateTime.now().toIso8601String(),
        if (reply != null)
          'replyTo': {
            'messageId': '${reply['_id'] ?? ''}',
            'senderId': '${reply['senderId'] ?? ''}',
            'senderName': '${reply['senderName'] ?? 'Member'}',
            'text': '${reply['text'] ?? ''}'.substring(
              0,
              '${reply['text'] ?? ''}'.length.clamp(0, 180),
            ),
          },
      });
    } catch (_) {
      text.text = v;
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Message queued—tap send again when connected.'),
          ),
        );
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }

  Future<void> editMessage(
    DocumentReference<Map<String, dynamic>> reference,
    String current,
  ) async {
    final input = TextEditingController(text: current);
    final saved = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Edit message'),
        content: TextField(
          controller: input,
          autofocus: true,
          maxLines: 6,
          maxLength: 4000,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Save'),
          ),
        ],
      ),
    );
    if (saved == true && input.text.trim().isNotEmpty)
      await reference.update({
        'text': input.text.trim(),
        'editedAt': FieldValue.serverTimestamp(),
        'editedBy': widget.portal.userId,
      });
  }

  @override
  Widget build(BuildContext c) {
    final color = hexColor('${widget.room['groupColor'] ?? '#9b1c31'}');
    final isApple = defaultTargetPlatform == TargetPlatform.iOS;
    return Scaffold(
      appBar: AppBar(
        title: Text('${widget.room['title'] ?? 'Conversation'}'),
        actions: [
          IconButton(
            onPressed: chooseBackground,
            tooltip: 'Chat background',
            icon: const Icon(Icons.wallpaper),
          ),
        ],
      ),
      body: Container(
        decoration: chatBackgroundDecoration(background, color),
        child: Column(
          children: [
            Expanded(
              child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
                stream: messages
                    .orderBy('createdAt', descending: true)
                    .limit(150)
                    .snapshots(),
                builder: (c, s) {
                  if (s.hasError)
                    return const Center(
                      child: _LoadStateCard(
                        icon: Icons.cloud_off,
                        title: 'Messages unavailable',
                        message: 'Check your connection and retry.',
                      ),
                    );
                  if (!s.hasData) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  unawaited(
                    messages.parent!
                        .collection('reads')
                        .doc(widget.portal.userId)
                        .set({
                          'lastReadAt': FieldValue.serverTimestamp(),
                          if (s.data!.docs.isNotEmpty)
                            'lastMessageId': s.data!.docs.first.id,
                        }, SetOptions(merge: true)),
                  );
                  return ListView.builder(
                    reverse: true,
                    padding: const EdgeInsets.all(14),
                    itemCount: s.data!.docs.length,
                    itemBuilder: (c, n) {
                      final messageDocument = s.data!.docs[n],
                          i = {
                            ...messageDocument.data(),
                            '_id': messageDocument.id,
                          },
                          mine = i['senderId'] == widget.portal.userId;
                      final senderId = '${i['senderId'] ?? ''}';
                      final senderName = '${i['senderName'] ?? 'Member'}';
                      final bubble = Container(
                        margin: const EdgeInsets.symmetric(vertical: 4),
                        padding: const EdgeInsets.all(12),
                        constraints: BoxConstraints(
                          maxWidth: MediaQuery.sizeOf(c).width * .78,
                        ),
                        decoration: BoxDecoration(
                          color: mine
                              ? color
                              : Color.lerp(
                                  Theme.of(c).colorScheme.surface,
                                  color,
                                  .10,
                                ),
                          borderRadius: BorderRadius.only(
                            topLeft: Radius.circular(isApple ? 20 : 16),
                            topRight: Radius.circular(isApple ? 20 : 16),
                            bottomLeft: Radius.circular(
                              mine ? (isApple ? 20 : 16) : 5,
                            ),
                            bottomRight: Radius.circular(
                              mine ? 5 : (isApple ? 20 : 16),
                            ),
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (i['replyTo'] is Map)
                              Container(
                                width: double.infinity,
                                margin: const EdgeInsets.only(bottom: 7),
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: Colors.black12,
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Text(
                                  '${(i['replyTo'] as Map)['senderName'] ?? 'Member'} · ${(i['replyTo'] as Map)['text'] ?? ''}',
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Flexible(
                                  child: Text(
                                    senderName,
                                    style: const TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                ),
                                if (i['editedAt'] != null)
                                  const Padding(
                                    padding: EdgeInsets.only(left: 5),
                                    child: Text(
                                      'edited',
                                      style: TextStyle(fontSize: 9),
                                    ),
                                  ),
                                if (widget.portal.admin)
                                  PopupMenuButton<String>(
                                    padding: EdgeInsets.zero,
                                    iconSize: 18,
                                    onSelected: (action) => action == 'edit'
                                        ? editMessage(
                                            messageDocument.reference,
                                            '${i['text'] ?? ''}',
                                          )
                                        : deleteProductionItem(
                                            context,
                                            messageDocument.reference,
                                            'this message',
                                          ),
                                    itemBuilder: (_) => const [
                                      PopupMenuItem(
                                        value: 'edit',
                                        child: Text('Edit message'),
                                      ),
                                      PopupMenuItem(
                                        value: 'delete',
                                        child: Text('Delete permanently'),
                                      ),
                                    ],
                                  ),
                              ],
                            ),
                            const SizedBox(height: 3),
                            Text('${i['text'] ?? ''}'),
                            if ((messageReactions[messageDocument.id] ?? [])
                                .isNotEmpty)
                              Padding(
                                padding: const EdgeInsets.only(top: 7),
                                child: Wrap(
                                  spacing: 5,
                                  runSpacing: 4,
                                  children:
                                      messageReactions[messageDocument.id]!
                                          .fold<Map<String, int>>({}, (
                                            counts,
                                            item,
                                          ) {
                                            final emoji =
                                                '${item['emoji'] ?? ''}';
                                            counts[emoji] =
                                                (counts[emoji] ?? 0) + 1;
                                            return counts;
                                          })
                                          .entries
                                          .map(
                                            (entry) => Container(
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                    horizontal: 7,
                                                    vertical: 3,
                                                  ),
                                              decoration: BoxDecoration(
                                                color: Colors.black26,
                                                borderRadius:
                                                    BorderRadius.circular(12),
                                              ),
                                              child: Text(
                                                '${entry.key} ${entry.value}',
                                                style: const TextStyle(
                                                  fontSize: 11,
                                                ),
                                              ),
                                            ),
                                          )
                                          .toList(),
                                ),
                              ),
                            if (dateField(i, const ['createdAt']) != null)
                              Align(
                                alignment: Alignment.centerRight,
                                child: Text(
                                  DateFormat.jm().format(
                                    dateField(i, const ['createdAt'])!,
                                  ),
                                  style: const TextStyle(
                                    fontSize: 9,
                                    color: Colors.white60,
                                  ),
                                ),
                              ),
                            if (mine)
                              Align(
                                alignment: Alignment.centerRight,
                                child: Text(
                                  messageDocument.metadata.hasPendingWrites
                                      ? 'Sending…'
                                      : 'Sent',
                                  style: const TextStyle(fontSize: 9),
                                ),
                              ),
                          ],
                        ),
                      );
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 2),
                        child: Row(
                          mainAxisAlignment: mine
                              ? MainAxisAlignment.end
                              : MainAxisAlignment.start,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            if (!mine) ...[
                              UserProfileAvatar(
                                userId: senderId,
                                name: senderName,
                              ),
                              const SizedBox(width: 8),
                            ],
                            Flexible(
                              child: GestureDetector(
                                onLongPress: () => showMessageActions(
                                  i,
                                  messageDocument.reference,
                                ),
                                child: bubble,
                              ),
                            ),
                            if (mine) ...[
                              const SizedBox(width: 8),
                              ProfileAvatar(
                                name: widget.portal.name,
                                fileId: widget.portal.photoFileId,
                                url: widget.portal.photoUrl,
                                radius: 18,
                              ),
                            ],
                          ],
                        ),
                      );
                    },
                  );
                },
              ),
            ),
            Container(
              color: Theme.of(context).scaffoldBackgroundColor
                  .withValues(alpha: .96),
              child: SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.all(10),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (replyingTo != null)
                        Container(
                          margin: const EdgeInsets.only(bottom: 7),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: Theme.of(context)
                                .colorScheme
                                .surfaceContainerHighest,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.reply, size: 17),
                              const SizedBox(width: 7),
                              Expanded(
                                child: Text(
                                  'Replying to ${replyingTo!['senderName'] ?? 'Member'}: ${replyingTo!['text'] ?? ''}',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              IconButton(
                                onPressed: () =>
                                    setState(() => replyingTo = null),
                                icon: const Icon(Icons.close),
                                visualDensity: VisualDensity.compact,
                              ),
                            ],
                          ),
                        ),
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: text,
                              maxLines: 4,
                              minLines: 1,
                              onSubmitted: (_) => send(),
                              decoration: const InputDecoration(
                                hintText: 'Message this space…',
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          IconButton.filled(
                            onPressed: sending ? null : send,
                            icon: Icon(
                              sending ? Icons.hourglass_top : Icons.send,
                            ),
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
      ),
    );
  }
}

class ScheduleScreen extends StatefulWidget {
  const ScheduleScreen(this.portal, {super.key});
  final PortalContext portal;
  @override
  State<ScheduleScreen> createState() => _ScheduleScreenState();
}

class _ScheduleScreenState extends State<ScheduleScreen> {
  int mode = 1;
  DateTime month = DateTime(DateTime.now().year, DateTime.now().month);

  @override
  Widget build(BuildContext c) => PortalPage(
    title: 'Schedule',
    subtitle: 'Calendar, upcoming calls, and full production list',
    child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance
          .collection('productions/${widget.portal.productionId}/events')
          .snapshots(),
      builder: (context, snapshot) {
        if (snapshot.hasError)
          return const Center(
            child: _LoadStateCard(
              icon: Icons.cloud_off,
              title: 'Schedule unavailable',
              message: 'Check your connection and try again.',
            ),
          );
        if (!snapshot.hasData)
          return const Center(child: CircularProgressIndicator());
        final events =
            snapshot.data!.docs
                .where((doc) => visibleRecord(doc.data()))
                .map((doc) => PortalEvent(doc.reference, doc.data()))
                .toList()
              ..sort(
                (a, b) => (a.start ?? DateTime(2100)).compareTo(
                  b.start ?? DateTime(2100),
                ),
              );
        final upcoming = events.where((event) => event.upcoming).toList();
        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
              child: Row(
                children: [
                  Expanded(
                    child: SegmentedButton<int>(
                      segments: const [
                        ButtonSegment(
                          value: 0,
                          icon: Icon(Icons.calendar_month),
                          label: Text('Calendar'),
                        ),
                        ButtonSegment(
                          value: 1,
                          icon: Icon(Icons.upcoming),
                          label: Text('Upcoming'),
                        ),
                        ButtonSegment(
                          value: 2,
                          icon: Icon(Icons.view_agenda),
                          label: Text('List'),
                        ),
                      ],
                      selected: {mode},
                      onSelectionChanged: (value) =>
                          setState(() => mode = value.first),
                    ),
                  ),
                  if (widget.portal.admin) ...[
                    const SizedBox(width: 8),
                    IconButton.filled(
                      onPressed: () => editProductionItem(
                        context,
                        FirebaseFirestore.instance.collection(
                          'productions/${widget.portal.productionId}/events',
                        ),
                        kind: 'event',
                      ),
                      tooltip: 'Add schedule item',
                      icon: const Icon(Icons.add),
                    ),
                  ],
                ],
              ),
            ),
            Expanded(
              child: mode == 0
                  ? _calendar(events)
                  : _agenda(mode == 1 ? upcoming : events, grouped: mode == 1),
            ),
          ],
        );
      },
    ),
  );

  Widget _agenda(List<PortalEvent> events, {required bool grouped}) {
    if (events.isEmpty)
      return const Center(
        child: _LoadStateCard(
          icon: Icons.event_available,
          title: 'Nothing scheduled',
          message: 'Published production calls will appear here.',
        ),
      );
    String section(PortalEvent event) {
      if (!grouped || event.start == null) return '';
      final difference = DateUtils.dateOnly(event.start!)
          .difference(DateUtils.dateOnly(DateTime.now()))
          .inDays;
      if (difference <= 0) return 'TODAY';
      if (difference == 1) return 'TOMORROW';
      if (difference <= 7) return 'THIS WEEK';
      return 'LATER';
    }

    String previous = '';
    final children = <Widget>[];
    for (final event in events) {
      final heading = section(event);
      if (heading.isNotEmpty && heading != previous) {
        children.add(
          Padding(
            padding: const EdgeInsets.fromLTRB(6, 20, 6, 8),
            child: Text(
              heading,
              style: TextStyle(
                color: Theme.of(context).colorScheme.primary,
                fontWeight: FontWeight.w900,
                letterSpacing: 1,
              ),
            ),
          ),
        );
        previous = heading;
      }
      children.add(_EventCard(event: event, admin: widget.portal.admin));
    }
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 28),
      children: children,
    );
  }

  Widget _calendar(List<PortalEvent> events) {
    final first = DateTime(month.year, month.month, 1);
    final gridStart = first.subtract(Duration(days: first.weekday % 7));
    return ListView(
      padding: const EdgeInsets.fromLTRB(12, 4, 12, 28),
      children: [
        Row(
          children: [
            IconButton(
              onPressed: () =>
                  setState(() => month = DateTime(month.year, month.month - 1)),
              icon: const Icon(Icons.chevron_left),
            ),
            Expanded(
              child: Text(
                DateFormat('MMMM yyyy').format(month),
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
            IconButton(
              onPressed: () =>
                  setState(() => month = DateTime(month.year, month.month + 1)),
              icon: const Icon(Icons.chevron_right),
            ),
          ],
        ),
        Row(
          children: [
            for (final day in const ['S', 'M', 'T', 'W', 'T', 'F', 'S'])
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(8),
                  child: Text(
                    day,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontWeight: FontWeight.w900),
                  ),
                ),
              ),
          ],
        ),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: 42,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 7,
            childAspectRatio: .82,
          ),
          itemBuilder: (context, index) {
            final day = gridStart.add(Duration(days: index));
            final rows = events
                .where(
                  (event) =>
                      event.start != null &&
                      DateUtils.isSameDay(event.start, day),
                )
                .toList();
            final selectedMonth = day.month == month.month;
            return InkWell(
              onTap: rows.isEmpty
                  ? null
                  : () {
                      showModalBottomSheet<void>(
                        context: context,
                        showDragHandle: true,
                        builder: (_) => SafeArea(
                          child: ListView(
                            padding: const EdgeInsets.all(16),
                            shrinkWrap: true,
                            children: [
                              Text(
                                DateFormat('EEEE, MMMM d').format(day),
                                style: const TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                              const SizedBox(height: 8),
                              ...rows.map(
                                (event) => _EventCard(
                                  event: event,
                                  admin: widget.portal.admin,
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
              borderRadius: BorderRadius.circular(12),
              child: Container(
                margin: const EdgeInsets.all(2),
                padding: const EdgeInsets.all(5),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  color: DateUtils.isSameDay(day, DateTime.now())
                      ? Theme.of(context).colorScheme.primaryContainer
                      : null,
                  border: Border.all(
                    color: rows.isEmpty
                        ? Colors.transparent
                        : Theme.of(context).colorScheme.outlineVariant,
                  ),
                ),
                child: Column(
                  children: [
                    Text(
                      '${day.day}',
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        color: selectedMonth
                            ? null
                            : Theme.of(context).colorScheme.onSurface
                                  .withValues(alpha: .3),
                      ),
                    ),
                    const Spacer(),
                    Wrap(
                      spacing: 2,
                      runSpacing: 2,
                      children: rows
                          .take(4)
                          .map(
                            (e) => Container(
                              width: 6,
                              height: 6,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: _eventColor(e.type),
                              ),
                            ),
                          )
                          .toList(),
                    ),
                    const Spacer(),
                  ],
                ),
              ),
            );
          },
        ),
        const SizedBox(height: 12),
        ...events
            .where(
              (event) =>
                  event.start?.year == month.year &&
                  event.start?.month == month.month,
            )
            .map(
              (event) => _EventCard(event: event, admin: widget.portal.admin),
            ),
      ],
    );
  }
}

Color _eventColor(String type) => switch (type.toLowerCase()) {
  final value when value.contains('performance') => const Color(0xffc61f46),
  final value when value.contains('music') => const Color(0xff00a7a7),
  final value when value.contains('costume') || value.contains('fitting') =>
    const Color(0xffd65a9e),
  final value when value.contains('work') || value.contains('production') =>
    const Color(0xffd99119),
  final value when value.contains('meeting') => const Color(0xff4085dd),
  final value when value.contains('deadline') => const Color(0xffe45826),
  _ => const Color(0xff7652d6),
};

class _EventCard extends StatelessWidget {
  const _EventCard({required this.event, required this.admin});
  final PortalEvent event;
  final bool admin;
  @override
  Widget build(BuildContext context) {
    final date = event.start;
    return Card(
      child: IntrinsicHeight(
        child: Row(
          children: [
            Container(
              width: 6,
              decoration: BoxDecoration(
                color: _eventColor(event.type),
                borderRadius: const BorderRadius.horizontal(
                  left: Radius.circular(18),
                ),
              ),
            ),
            if (date != null)
              Container(
                width: 64,
                padding: const EdgeInsets.symmetric(vertical: 14),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      DateFormat('MMM').format(date).toUpperCase(),
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    Text(
                      '${date.day}',
                      style: const TextStyle(
                        fontSize: 25,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    Text(
                      DateFormat('EEE').format(date),
                      style: const TextStyle(fontSize: 11),
                    ),
                  ],
                ),
              ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(8, 13, 8, 13),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: 6,
                      children: [
                        Chip(
                          label: Text(event.type),
                          visualDensity: VisualDensity.compact,
                        ),
                        if (event.changed)
                          const Chip(
                            label: Text('CHANGED'),
                            avatar: Icon(Icons.update, size: 15),
                          ),
                      ],
                    ),
                    Text(
                      event.title,
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    if (date != null)
                      Text(
                        '${event.call != null ? 'Call ${DateFormat.jm().format(event.call!)} · ' : ''}${DateFormat.jm().format(date)}${event.end != null ? '–${DateFormat.jm().format(event.end!)}' : ''}',
                      ),
                    if (event.location.isNotEmpty) Text('⌖ ${event.location}'),
                    if (event.called.isNotEmpty)
                      Text('Called: ${event.called}'),
                    if (event.whatToBring.isNotEmpty)
                      Text(
                        'Bring: ${event.whatToBring}',
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                    if (event.description.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 5),
                        child: Text(event.description),
                      ),
                  ],
                ),
              ),
            ),
            if (admin)
              PopupMenuButton<String>(
                onSelected: (action) => action == 'edit'
                    ? editProductionItem(
                        context,
                        event.reference,
                        kind: 'event',
                        existing: event.data,
                      )
                    : deleteProductionItem(
                        context,
                        event.reference,
                        event.title,
                      ),
                itemBuilder: (_) => const [
                  PopupMenuItem(value: 'edit', child: Text('Edit')),
                  PopupMenuItem(
                    value: 'delete',
                    child: Text('Delete permanently'),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}

class ThemeStudioScreen extends StatefulWidget {
  const ThemeStudioScreen({
    super.key,
    required this.initialThemeId,
    required this.initialPreferences,
    required this.onSave,
  });
  final String initialThemeId;
  final Map<String, dynamic> initialPreferences;
  final Future<void> Function(String, Map<String, dynamic>) onSave;
  @override
  State<ThemeStudioScreen> createState() => _ThemeStudioScreenState();
}

class _ThemeStudioScreenState extends State<ThemeStudioScreen> {
  static const defaults = <String, dynamic>{
    'mode': 'dark',
    'primary': '#d71e2b',
    'secondary': '#6f7cff',
    'accent': '#f0bf52',
    'background': '#090a10',
    'surface': '#1b1c24',
    'text': '#f7f7fa',
    'muted': '#a9acb6',
    'success': '#42c981',
    'warning': '#ffbf47',
    'danger': '#ff5d67',
    'radius': 18.0,
    'typeScale': 1.0,
    'spaceScale': 1.0,
    'depth': 3.0,
    'glow': 2.0,
    'texture': 'grid',
    'textureOpacity': 0.2,
  };
  static const themePresets = <String, String>{
    'Bedford Dark': 'bedford-dark',
    'Bedford Light': 'bedford-light',
    'Auradon Royal': 'auradon-royal',
    'Isle of the Lost': 'isle-lost',
    'VK Neon': 'vk-neon',
    'Dragon Fire': 'dragon-fire',
  };
  static const starters = <String, Map<String, dynamic>>{
    'Bedford Remix': {
      'primary': '#d71e2b',
      'secondary': '#ffffff',
      'accent': '#b7bcc8',
      'background': '#09090c',
      'surface': '#1b1c22',
      'text': '#f7f7f8',
      'muted': '#a9acb6',
    },
    'Midnight Royal': {
      'primary': '#f3c75f',
      'secondary': '#69aef8',
      'accent': '#fff0ba',
      'background': '#061326',
      'surface': '#112b4f',
      'text': '#fffaf0',
      'muted': '#c8d5e8',
    },
    'Forest Atelier': {
      'primary': '#7ee787',
      'secondary': '#5cc8ff',
      'accent': '#e8c66a',
      'background': '#07110d',
      'surface': '#163326',
      'text': '#f3fff8',
      'muted': '#afd0bd',
    },
    'Velvet Stage': {
      'primary': '#ff5f91',
      'secondary': '#a67cff',
      'accent': '#ffd166',
      'background': '#130812',
      'surface': '#35152e',
      'text': '#fff5fb',
      'muted': '#d5afc8',
    },
    'Ocean Glass': {
      'primary': '#28d7c0',
      'secondary': '#4f8cff',
      'accent': '#b7f5ed',
      'background': '#06141a',
      'surface': '#11323b',
      'text': '#f2ffff',
      'muted': '#a9ced3',
    },
    'Warm Paper': {
      'mode': 'light',
      'primary': '#a62b3d',
      'secondary': '#365f91',
      'accent': '#b67a22',
      'background': '#f3eadc',
      'surface': '#fffaf2',
      'text': '#241e19',
      'muted': '#6f6258',
    },
    'Soft Lavender': {
      'mode': 'light',
      'primary': '#7657c8',
      'secondary': '#d05291',
      'accent': '#537ca6',
      'background': '#f2effa',
      'surface': '#ffffff',
      'text': '#251f31',
      'muted': '#6d637b',
    },
    'High Contrast': {
      'primary': '#ffe600',
      'secondary': '#40c4ff',
      'accent': '#ffffff',
      'background': '#000000',
      'surface': '#171717',
      'text': '#ffffff',
      'muted': '#d2d2d2',
      'radius': 8.0,
      'depth': 1.0,
      'glow': 0.0,
      'texture': 'none',
    },
  };
  static const colorKeys = [
    'primary',
    'secondary',
    'accent',
    'background',
    'surface',
    'text',
    'muted',
    'success',
    'warning',
    'danger',
  ];
  static const swatches = [
    '#d71e2b',
    '#ff365b',
    '#ff5f91',
    '#ff7a2c',
    '#f0bf52',
    '#ffe600',
    '#7ee787',
    '#42c981',
    '#28d7c0',
    '#00e9ff',
    '#4f8cff',
    '#6f7cff',
    '#7657c8',
    '#a67cff',
    '#ffffff',
    '#d2d2d2',
    '#a9acb6',
    '#33363c',
    '#171717',
    '#090a10',
  ];
  late String themeId;
  late Map<String, dynamic> state;
  bool saving = false;

  @override
  void initState() {
    super.initState();
    themeId = widget.initialThemeId;
    state = {...defaults, ...widget.initialPreferences};
  }

  void custom(void Function() change) {
    setState(() {
      change();
      themeId = 'custom-aesthetic';
    });
  }

  Future<void> chooseColor(String key) async {
    final selected = await showDialog<String>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text('${key[0].toUpperCase()}${key.substring(1)} colour'),
        content: SizedBox(
          width: 320,
          child: Wrap(
            spacing: 10,
            runSpacing: 10,
            children: swatches
                .map(
                  (hex) => InkWell(
                    onTap: () => Navigator.pop(c, hex),
                    borderRadius: BorderRadius.circular(99),
                    child: Container(
                      width: 42,
                      height: 42,
                      decoration: BoxDecoration(
                        color: AppPalette.color(hex, Colors.black),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: Theme.of(c).colorScheme.onSurface,
                          width: state[key] == hex ? 3 : 1,
                        ),
                      ),
                    ),
                  ),
                )
                .toList(),
          ),
        ),
      ),
    );
    if (selected != null) custom(() => state[key] = selected);
  }

  @override
  Widget build(BuildContext context) {
    final palette = AppPalette.fromTheme(themeId, state);
    return Theme(
      data: palette.theme(),
      child: Builder(
        builder: (c) => Scaffold(
          appBar: AppBar(
            title: const Text('Theme Studio'),
            actions: [
              TextButton.icon(
                onPressed: saving
                    ? null
                    : () async {
                        setState(() => saving = true);
                        try {
                          await widget.onSave(themeId, state);
                          if (mounted)
                            ScaffoldMessenger.of(c).showSnackBar(
                              const SnackBar(
                                content: Text(
                                  'Theme saved to your account and website.',
                                ),
                              ),
                            );
                        } finally {
                          if (mounted) setState(() => saving = false);
                        }
                      },
                icon: saving
                    ? const SizedBox.square(
                        dimension: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.cloud_done_outlined),
                label: const Text('Save'),
              ),
            ],
          ),
          body: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 36),
            children: [
              Container(
                padding: const EdgeInsets.all(22),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(
                    (state['radius'] as num).toDouble(),
                  ),
                  gradient: LinearGradient(
                    colors: [
                      palette.primary,
                      palette.secondary,
                      palette.surface,
                    ],
                  ),
                  boxShadow: (state['depth'] as num) == 0
                      ? null
                      : [
                          BoxShadow(
                            color: palette.primary.withValues(
                              alpha:
                                  .12 + (state['glow'] as num).toDouble() * .04,
                            ),
                            blurRadius:
                                12 + (state['depth'] as num).toDouble() * 8,
                            offset: const Offset(0, 12),
                          ),
                        ],
                ),
                child: const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.auto_awesome, size: 32),
                    SizedBox(height: 24),
                    Text(
                      'Your production. Your aesthetic.',
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    SizedBox(height: 6),
                    Text(
                      'Every change previews instantly and follows your account.',
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              _studioHeading(
                'Simple themes',
                'Choose a complete look in one tap.',
              ),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: themePresets.entries
                    .map(
                      (e) => ChoiceChip(
                        label: Text(e.key),
                        selected: themeId == e.value,
                        onSelected: (_) => setState(() => themeId = e.value),
                      ),
                    )
                    .toList(),
              ),
              const SizedBox(height: 20),
              _studioHeading(
                'Custom starters',
                'Start here, then refine every element.',
              ),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: starters.entries
                    .map(
                      (e) => ActionChip(
                        avatar: CircleAvatar(
                          backgroundColor: AppPalette.color(
                            e.value['primary'],
                            Colors.red,
                          ),
                        ),
                        label: Text(e.key),
                        onPressed: () =>
                            custom(() => state = {...defaults, ...e.value}),
                      ),
                    )
                    .toList(),
              ),
              const SizedBox(height: 20),
              _studioHeading('Palette', 'Tap any role to choose its colour.'),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    children: colorKeys
                        .map(
                          (key) => ListTile(
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 6,
                            ),
                            leading: CircleAvatar(
                              backgroundColor: AppPalette.color(
                                state[key],
                                Colors.black,
                              ),
                            ),
                            title: Text(
                              '${key[0].toUpperCase()}${key.substring(1)}',
                              style: const TextStyle(
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            subtitle: Text('${state[key]}'),
                            trailing: const Icon(Icons.colorize),
                            onTap: () => chooseColor(key),
                          ),
                        )
                        .toList(),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              _studioHeading(
                'Foundation',
                'Light, dark, texture and atmosphere.',
              ),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      SegmentedButton<String>(
                        segments: const [
                          ButtonSegment(
                            value: 'dark',
                            label: Text('Dark'),
                            icon: Icon(Icons.dark_mode),
                          ),
                          ButtonSegment(
                            value: 'light',
                            label: Text('Light'),
                            icon: Icon(Icons.light_mode),
                          ),
                        ],
                        selected: {'${state['mode']}'},
                        onSelectionChanged: (v) =>
                            custom(() => state['mode'] = v.first),
                      ),
                      const SizedBox(height: 16),
                      DropdownButtonFormField<String>(
                        initialValue: '${state['texture']}',
                        decoration: const InputDecoration(labelText: 'Texture'),
                        items: ['grid', 'grain', 'spotlight', 'none']
                            .map(
                              (v) => DropdownMenuItem(value: v, child: Text(v)),
                            )
                            .toList(),
                        onChanged: (v) => custom(() => state['texture'] = v),
                      ),
                      _slider(
                        'Texture strength',
                        'textureOpacity',
                        0,
                        0.5,
                        divisions: 10,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 14),
              _studioHeading(
                'Shape & rhythm',
                'Tune density and visual character.',
              ),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      _slider('Corner radius', 'radius', 6, 32, divisions: 26),
                      _slider(
                        'Type scale',
                        'typeScale',
                        0.85,
                        1.2,
                        divisions: 14,
                      ),
                      _slider(
                        'Spacing scale',
                        'spaceScale',
                        0.8,
                        1.3,
                        divisions: 10,
                      ),
                      _slider('Depth', 'depth', 0, 5, divisions: 5),
                      _slider('Glow', 'glow', 0, 5, divisions: 5),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _studioHeading(String title, String subtitle) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w900),
        ),
        Text(subtitle, style: const TextStyle(fontSize: 13)),
      ],
    ),
  );
  Widget _slider(
    String label,
    String key,
    double min,
    double max, {
    required int divisions,
  }) {
    final value = ((state[key] as num?)?.toDouble() ?? min).clamp(min, max);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 12),
          child: Text(
            '$label  ${value.toStringAsFixed(key == 'radius' || key == 'depth' || key == 'glow' ? 0 : 2)}',
            style: const TextStyle(fontWeight: FontWeight.w800),
          ),
        ),
        Slider(
          value: value,
          min: min,
          max: max,
          divisions: divisions,
          onChanged: (v) => custom(() => state[key] = v),
        ),
      ],
    );
  }
}

class AccountScreen extends StatelessWidget {
  const AccountScreen(
    this.portal, {
    super.key,
    required this.themeId,
    required this.themePreferences,
    required this.onSaveTheme,
  });
  final PortalContext portal;
  final String themeId;
  final Map<String, dynamic> themePreferences;
  final Future<void> Function(String, Map<String, dynamic>) onSaveTheme;

  @override
  Widget build(BuildContext context) => PortalPage(
    title: 'Your account',
    subtitle: 'Profile, appearance and access',
    child: ListView(
      padding: const EdgeInsets.all(14),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Row(
              children: [
                ProfileAvatar(
                  name: portal.name,
                  fileId: portal.photoFileId,
                  url: portal.photoUrl,
                  radius: 32,
                ),
                const SizedBox(width: 15),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        portal.name,
                        style: const TextStyle(
                          fontSize: 19,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      Text(
                        portal.admin ? 'Administrator' : 'Production member',
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.primary,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        Card(
          child: ListTile(
            leading: const Icon(Icons.palette_outlined),
            title: const Text(
              'Theme Studio',
              style: TextStyle(fontWeight: FontWeight.w800),
            ),
            subtitle: Text(
              '${themeId.replaceAll('-', ' ')} · synced with website',
            ),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => ThemeStudioScreen(
                  initialThemeId: themeId,
                  initialPreferences: themePreferences,
                  onSave: onSaveTheme,
                ),
              ),
            ),
          ),
        ),
        Card(
          child: ListTile(
            leading: const Icon(Icons.manage_accounts_outlined),
            title: const Text(
              'Website profile',
              style: TextStyle(fontWeight: FontWeight.w800),
            ),
            subtitle: const Text('Photo, contact details and preferences'),
            trailing: const Icon(Icons.open_in_new),
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) =>
                    const WebWorkspace('Your profile', 'profile.html'),
              ),
            ),
          ),
        ),
        Card(
          child: ListTile(
            leading: const Icon(Icons.logout, color: Colors.redAccent),
            title: const Text('Sign out'),
            onTap: () async {
              final prefs = await SharedPreferences.getInstance();
              await prefs.remove('brmLegacyToken');
              await prefs.remove('brmLegacyContext');
              await prefs.remove('brmTrustDevice');
              await FirebaseAuth.instance.signOut();
            },
          ),
        ),
      ],
    ),
  );
}

class MoreScreen extends StatefulWidget {
  const MoreScreen(
    this.portal, {
    super.key,
    required this.themeId,
    required this.themePreferences,
    required this.onSaveTheme,
  });
  final PortalContext portal;
  final String themeId;
  final Map<String, dynamic> themePreferences;
  final Future<void> Function(String, Map<String, dynamic>) onSaveTheme;
  @override
  State<MoreScreen> createState() => _MoreScreenState();
}

class _MoreScreenState extends State<MoreScreen> {
  Set<String> pinned = {};
  List<String> recent = [];
  Map<String, String> signals = {};
  String query = '', adminMode = 'production';

  @override
  void initState() {
    super.initState();
    _loadPreferences();
    _loadSignals();
  }

  Future<void> _loadSignals() async {
    try {
      final productionId = widget.portal.productionId;
      final announcements = await FirebaseFirestore.instance
          .collection('productions')
          .doc(productionId)
          .collection('announcements')
          .limit(20)
          .get();
      QuerySnapshot<Map<String, dynamic>>? tasks;
      if (widget.portal.admin)
        tasks = await FirebaseFirestore.instance
            .collection('productions')
            .doc(productionId)
            .collection('tasks')
            .limit(100)
            .get();
      if (!mounted) return;
      setState(() {
        if (announcements.docs.isNotEmpty)
          signals['announcements.html'] = '${announcements.docs.length} recent';
        final open =
            tasks?.docs
                .where(
                  (doc) => ![
                    'Completed',
                    'Cancelled',
                  ].contains('${doc.data()['status'] ?? doc.data()['Status']}'),
                )
                .length ??
            0;
        if (open > 0) signals['tasks.html'] = '$open open';
      });
    } catch (_) {}
  }

  Future<void> _loadPreferences() async {
    final prefs = await SharedPreferences.getInstance();
    if (!mounted) return;
    setState(() {
      pinned = (prefs.getStringList('brmPinnedHubsNative') ?? []).toSet();
      recent = prefs.getStringList('brmRecentHubsNative') ?? [];
      adminMode = prefs.getString('brmHubModeNative') ?? 'production';
    });
  }

  Future<void> _togglePin(String path) async {
    setState(
      () => pinned.contains(path) ? pinned.remove(path) : pinned.add(path),
    );
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList('brmPinnedHubsNative', pinned.toList());
  }

  Future<void> _openHub(BuildContext context, String name, String path) async {
    setState(
      () => recent = [
        path,
        ...recent.where((item) => item != path),
      ].take(5).toList(),
    );
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList('brmRecentHubsNative', recent);
    if (context.mounted)
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => WebWorkspace(name, path)),
      );
  }

  @override
  Widget build(BuildContext c) {
    final portal = widget.portal;
    final tools =
        <({String category, String name, String path, IconData icon})>[
          if (portal.admin)
            (
              category: 'Administration',
              name: 'People & Access',
              path: 'admin.html',
              icon: Icons.admin_panel_settings,
            ),
          if (portal.admin)
            (
              category: 'Administration',
              name: 'Casting',
              path: 'casting.html',
              icon: Icons.theater_comedy,
            ),
          if (portal.admin)
            (
              category: 'Administration',
              name: 'Auditions & Interest',
              path: 'recruitment-review.html',
              icon: Icons.how_to_reg,
            ),
          if (portal.admin)
            (
              category: 'Administration',
              name: 'Journal Review',
              path: 'journal-review.html',
              icon: Icons.rate_review,
            ),
          (
            category: 'Production',
            name: 'Announcements',
            path: 'announcements.html',
            icon: Icons.campaign,
          ),
          (
            category: 'Production',
            name: 'Tasks',
            path: 'tasks.html',
            icon: Icons.task_alt,
          ),
          (
            category: 'Production',
            name: 'Music & Tracks',
            path: 'tracks.html',
            icon: Icons.library_music,
          ),
          (
            category: 'Production',
            name: 'Blocking Viewer',
            path: 'blocking-viewer.html',
            icon: Icons.theater_comedy,
          ),
          if (portal.admin)
            (
              category: 'Production',
              name: 'Blocking Studio',
              path: 'blocking.html',
              icon: Icons.architecture,
            ),
          (
            category: 'Departments',
            name: 'Props',
            path: 'props.html',
            icon: Icons.inventory_2,
          ),
          (
            category: 'Departments',
            name: 'Costumes',
            path: 'costumes.html',
            icon: Icons.checkroom,
          ),
          (
            category: 'Departments',
            name: 'Sets & Scenic',
            path: 'sets.html',
            icon: Icons.carpenter,
          ),
          (
            category: 'Departments',
            name: 'Stage Management',
            path: 'stage-management.html',
            icon: Icons.assignment,
          ),
          (
            category: 'Departments',
            name: 'Lighting',
            path: 'lighting.html',
            icon: Icons.lightbulb,
          ),
          (
            category: 'Departments',
            name: 'Sound',
            path: 'sound.html',
            icon: Icons.speaker,
          ),
          (
            category: 'Departments',
            name: 'Pit Orchestra',
            path: 'pit-orchestra.html',
            icon: Icons.music_note,
          ),
          (
            category: 'Departments',
            name: 'Publicity',
            path: 'publicity.html',
            icon: Icons.photo_camera,
          ),
          (
            category: 'Resources',
            name: 'Production Resources',
            path: 'resources.html',
            icon: Icons.folder,
          ),
          (
            category: 'Resources',
            name: 'Company Directory',
            path: 'directory.html',
            icon: Icons.groups,
          ),
          (
            category: 'Resources',
            name: 'Offline & Storage',
            path: 'storage.html',
            icon: Icons.offline_pin,
          ),
        ];
    final categories = [
      'Administration',
      'Production',
      'Departments',
      'Resources',
    ];
    final visibleTools = tools.where((tool) {
      if (portal.admin &&
          adminMode == 'production' &&
          tool.category == 'Administration')
        return false;
      if (portal.admin &&
          adminMode == 'admin' &&
          tool.category != 'Administration')
        return false;
      final needle = query.trim().toLowerCase();
      return needle.isEmpty ||
          '${tool.name} ${tool.category}'.toLowerCase().contains(needle);
    }).toList();
    final shortcuts =
        <({String category, String name, String path, IconData icon})>[];
    for (final path in [
      ...pinned,
      ...recent.where((item) => !pinned.contains(item)),
    ]) {
      final matches = tools.where((tool) => tool.path == path);
      if (matches.isNotEmpty) shortcuts.add(matches.first);
      if (shortcuts.length == 8) break;
    }
    return PortalPage(
      title: 'Hubs & tools',
      subtitle: 'Department workspaces · production resources',
      child: ListView(
        padding: const EdgeInsets.all(14),
        children: [
          if (portal.admin)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Workspace mode',
                      style: TextStyle(fontWeight: FontWeight.w900),
                    ),
                    const SizedBox(height: 3),
                    const Text(
                      'Keep daily production work separate from administrative controls.',
                      style: TextStyle(fontSize: 12),
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: SegmentedButton<String>(
                        expandedInsets: EdgeInsets.zero,
                        segments: const [
                          ButtonSegment(
                            value: 'production',
                            label: Text('Production'),
                            icon: Icon(Icons.theater_comedy_outlined),
                          ),
                          ButtonSegment(
                            value: 'admin',
                            label: Text('Administration'),
                            icon: Icon(Icons.shield_outlined),
                          ),
                        ],
                        selected: {adminMode},
                        onSelectionChanged: (value) async {
                          setState(() => adminMode = value.first);
                          final prefs = await SharedPreferences.getInstance();
                          await prefs.setString('brmHubModeNative', adminMode);
                        },
                      ),
                    ),
                  ],
                ),
              ),
            ),
          if (portal.admin) const SizedBox(height: 12),
          TextField(
            decoration: const InputDecoration(
              prefixIcon: Icon(Icons.search),
              hintText: 'Search hubs and tools',
            ),
            onChanged: (value) => setState(() => query = value),
          ),
          if (shortcuts.isNotEmpty) ...[
            const SizedBox(height: 16),
            const SectionTitle('Pinned & recent'),
            SizedBox(
              height: 72,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: shortcuts
                    .map(
                      (tool) => Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: ActionChip(
                          avatar: Icon(tool.icon, size: 18),
                          label: Text(tool.name),
                          onPressed: () => _openHub(c, tool.name, tool.path),
                        ),
                      ),
                    )
                    .toList(),
              ),
            ),
          ],
          const SizedBox(height: 12),
          const SectionTitle('Production library'),
          Card(
            child: ListTile(
              leading: const Icon(Icons.library_books),
              title: const Text(
                'Script & Sheet Music',
                style: TextStyle(fontWeight: FontWeight.w800),
              ),
              subtitle: const Text('Offline reader · Annotation Studio'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.push(
                c,
                MaterialPageRoute(
                  builder: (_) => const DocumentLibraryScreen(),
                ),
              ),
            ),
          ),
          const SizedBox(height: 14),
          ...categories
              .where(
                (category) =>
                    visibleTools.any((tool) => tool.category == category),
              )
              .map((category) {
                final group = visibleTools
                    .where((tool) => tool.category == category)
                    .toList();
                return Card(
                  clipBehavior: Clip.antiAlias,
                  child: ExpansionTile(
                    initiallyExpanded:
                        category == 'Production' || category == 'Departments',
                    leading: Icon(switch (category) {
                      'Administration' => Icons.shield_outlined,
                      'Production' => Icons.theater_comedy_outlined,
                      'Departments' => Icons.groups_outlined,
                      _ => Icons.folder_outlined,
                    }),
                    title: Text(
                      category,
                      style: const TextStyle(fontWeight: FontWeight.w900),
                    ),
                    subtitle: Text(
                      '${group.length} ${group.length == 1 ? 'workspace' : 'workspaces'}',
                    ),
                    children: group
                        .map(
                          (t) => ListTile(
                            leading: Icon(t.icon),
                            title: Text(
                              t.name,
                              style: const TextStyle(
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                if (signals[t.path] != null)
                                  Padding(
                                    padding: const EdgeInsets.only(right: 4),
                                    child: Badge(label: Text(signals[t.path]!)),
                                  ),
                                IconButton(
                                  tooltip: pinned.contains(t.path)
                                      ? 'Unpin'
                                      : 'Pin',
                                  onPressed: () => _togglePin(t.path),
                                  icon: Icon(
                                    pinned.contains(t.path)
                                        ? Icons.star
                                        : Icons.star_border,
                                    color: pinned.contains(t.path)
                                        ? Colors.amber
                                        : null,
                                  ),
                                ),
                                const Icon(Icons.chevron_right),
                              ],
                            ),
                            onTap: () => _openHub(c, t.name, t.path),
                          ),
                        )
                        .toList(),
                  ),
                );
              }),
        ],
      ),
    );
  }
}

class WebWorkspace extends StatefulWidget {
  const WebWorkspace(this.title, this.path, {super.key});
  final String title, path;
  @override
  State<WebWorkspace> createState() => _WebState();
}

class _WebState extends State<WebWorkspace> {
  late final WebViewController controller;
  int progress = 0;
  bool ready = false, needsSignIn = false;
  @override
  void initState() {
    super.initState();
    controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (v) {
            if (mounted) setState(() => progress = v);
          },
          onNavigationRequest: (request) {
            final uri = Uri.tryParse(request.url);
            if (uri != null &&
                uri.path.startsWith('/song-pdfs/') &&
                uri.path.toLowerCase().endsWith('.pdf')) {
              final filename = Uri.decodeComponent(uri.pathSegments.last);
              final match = RegExp(
                r'^(\d{2})\s+(.+)\.pdf$',
                caseSensitive: false,
              ).firstMatch(filename);
              if (match != null) {
                final number = int.parse(match.group(1)!);
                final title = match.group(2)!;
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => AnnotatedDocumentScreen(
                      document: productionSongDocument(number, title),
                    ),
                  ),
                );
                return NavigationDecision.prevent;
              }
            }
            if (uri != null &&
                uri.path.toLowerCase() ==
                    '/libretto/descendants-libretto.pdf') {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => AnnotatedDocumentScreen(
                    document: productionDocuments.firstWhere(
                      (document) => document.id == 'descendants-libretto',
                    ),
                  ),
                ),
              );
              return NavigationDecision.prevent;
            }
            return NavigationDecision.navigate;
          },
        ),
      );
    _openAuthenticatedWorkspace();
  }

  Future<void> _openAuthenticatedWorkspace() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('brmLegacyToken') ?? '';
    final portalContext = prefs.getString('brmLegacyContext') ?? '{}';
    final firebaseIdToken =
        await FirebaseAuth.instance.currentUser?.getIdToken() ?? '';
    if (token.isEmpty) {
      if (mounted) setState(() => needsSignIn = true);
      return;
    }
    final destination = '$site/${widget.path}?source=flutter';
    final bootstrap =
        '''<!doctype html><meta name="viewport" content="width=device-width"><script>
localStorage.setItem('brmToken', ${jsonEncode(token)});
localStorage.setItem('brmContext', ${jsonEncode(portalContext)});
localStorage.setItem('brmAppInstall', 'flutter');
sessionStorage.setItem('brmFirebaseUid', ${jsonEncode(FirebaseAuth.instance.currentUser?.uid ?? '')});
sessionStorage.setItem('brmFirebaseIdToken', ${jsonEncode(firebaseIdToken)});
location.replace(${jsonEncode(destination)});
</script>''';
    await controller.loadHtmlString(bootstrap, baseUrl: site);
    if (mounted) setState(() => ready = true);
  }

  @override
  Widget build(BuildContext c) => Scaffold(
    appBar: AppBar(
      title: Text(widget.title),
      bottom: progress < 100
          ? PreferredSize(
              preferredSize: const Size.fromHeight(2),
              child: LinearProgressIndicator(value: progress / 100),
            )
          : null,
    ),
    body: needsSignIn
        ? Center(
            child: Padding(
              padding: const EdgeInsets.all(28),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.lock_reset, size: 48),
                  const SizedBox(height: 16),
                  const Text(
                    'Reconnect production tools',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Your existing app session predates the hub connection update. Sign in once more to connect these workspaces.',
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 18),
                  FilledButton.icon(
                    onPressed: () async {
                      await FirebaseAuth.instance.signOut();
                      if (mounted) Navigator.pop(context);
                    },
                    icon: const Icon(Icons.login),
                    label: const Text('Sign in again'),
                  ),
                ],
              ),
            ),
          )
        : ready
        ? WebViewWidget(controller: controller)
        : const Center(child: CircularProgressIndicator()),
  );
}

class PortalPage extends StatelessWidget {
  const PortalPage({
    super.key,
    required this.title,
    required this.subtitle,
    required this.child,
  });
  final String title, subtitle;
  final Widget child;
  @override
  Widget build(BuildContext c) => SafeArea(
    child: Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 15, 18, 8),
          child: Row(
            children: [
              const BrandMark(size: 45),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 21,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    Text(
                      subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: Theme.of(c).colorScheme.onSurfaceVariant,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              const ConnectionIndicator(),
            ],
          ),
        ),
        Expanded(child: child),
      ],
    ),
  );
}

class ConnectionIndicator extends StatelessWidget {
  const ConnectionIndicator({super.key});
  @override
  Widget build(BuildContext c) => StreamBuilder<List<ConnectivityResult>>(
    stream: Connectivity().onConnectivityChanged,
    initialData: const [],
    builder: (c, s) {
      final off = s.data?.contains(ConnectivityResult.none) ?? false;
      return Tooltip(
        message: off ? 'Offline—showing saved data' : 'Connected',
        child: Icon(
          off ? Icons.cloud_off : Icons.cloud_done,
          color: off ? Colors.orange : Colors.greenAccent,
          size: 20,
        ),
      );
    },
  );
}

class BrandMark extends StatelessWidget {
  const BrandMark({super.key, required this.size});
  final double size;
  @override
  Widget build(BuildContext c) => DecoratedBox(
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(size * .24),
      color: const Color(0xff09090b),
      border: Border.all(color: const Color(0x66ff3155)),
      boxShadow: const [BoxShadow(color: Color(0x66d0002a), blurRadius: 18)],
    ),
    child: ClipRRect(
      borderRadius: BorderRadius.circular(size * .24),
      child: Image.asset(
        'assets/images/bedford-road-theatre-logo.png',
        width: size,
        height: size,
        fit: BoxFit.cover,
        filterQuality: FilterQuality.high,
      ),
    ),
  );
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key});
  final String text;
  @override
  Widget build(BuildContext c) => Padding(
    padding: const EdgeInsets.only(left: 4, bottom: 8),
    child: Text(
      text,
      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
    ),
  );
}

Color hexColor(String value) {
  final v = value.replaceFirst('#', '');
  return Color(int.parse('ff${v.length == 6 ? v : '9b1c31'}', radix: 16));
}
