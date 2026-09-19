import 'dart:async';
import 'dart:convert';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;

class ProfileApi {
  ProfileApi({http.Client? client, Future<String?> Function()? tokenProvider})
    : _client = client ?? http.Client(),
      _tokenProvider =
          tokenProvider ??
          (() async => FirebaseAuth.instance.currentUser?.getIdToken());
  final http.Client _client;
  final Future<String?> Function() _tokenProvider;

  Future<Map<String, dynamic>> request(
    String action, [
    Map<String, dynamic> fields = const {},
  ]) async {
    try {
      final token = await _tokenProvider().timeout(const Duration(seconds: 20));
      if (token == null) {
        throw const ProfileException('Sign in again to edit your profile.');
      }
      final response = await _client
          .post(
            Uri.parse(
              'https://northamerica-northeast2-brpa-digital-hub-dev.cloudfunctions.net/portalData',
            ),
            headers: {
              'Authorization': 'Bearer $token',
              'Content-Type': 'application/json',
            },
            body: jsonEncode({...fields, 'action': action}),
          )
          .timeout(const Duration(seconds: 60));
      final body = jsonDecode(response.body);
      if (body is! Map<String, dynamic>) throw const FormatException();
      if (response.statusCode != 200 || body['success'] != true) {
        throw ProfileException(
          body['error']?.toString() ??
              'Your changes could not be saved. Please try again.',
        );
      }
      return body;
    } on TimeoutException {
      throw const ProfileException(
        'The connection timed out. Check your connection and try again.',
      );
    } on http.ClientException {
      throw const ProfileException(
        'Could not connect. Your edits are still here; please try again.',
      );
    } on FormatException {
      throw const ProfileException(
        'The server returned an unexpected response. Please try again.',
      );
    }
  }

  void close() => _client.close();
}

class ProfileException implements Exception {
  const ProfileException(this.message);
  final String message;
  @override
  String toString() => message;
}
