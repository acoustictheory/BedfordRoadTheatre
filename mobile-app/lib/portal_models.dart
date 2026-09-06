import 'package:cloud_firestore/cloud_firestore.dart';

dynamic field(Map<String, dynamic> data, List<String> names) {
  for (final name in names) {
    final value = data[name];
    if (value != null && '$value'.trim().isNotEmpty) return value;
  }
  return null;
}

String textField(
  Map<String, dynamic> data,
  List<String> names, [
  String fallback = '',
]) => '${field(data, names) ?? fallback}'.trim();

bool boolField(
  Map<String, dynamic> data,
  List<String> names, [
  bool fallback = false,
]) {
  final value = field(data, names);
  if (value == null) return fallback;
  if (value is bool) return value;
  return const {'true', 'yes', '1', 'on'}.contains('$value'.toLowerCase());
}

DateTime? dateField(Map<String, dynamic> data, List<String> names) {
  final value = field(data, names);
  if (value is Timestamp) return value.toDate();
  if (value is DateTime) return value;
  if (value is num) return DateTime.fromMillisecondsSinceEpoch(value.toInt());
  return DateTime.tryParse('$value');
}

bool visibleRecord(Map<String, dynamic> data) {
  final status = textField(data, const [
    'status',
    'Status',
  ], 'Active').toLowerCase();
  return const {
    'active',
    'published',
    'open',
    'ready',
    'scheduled',
  }.contains(status);
}

class PortalAnnouncement {
  PortalAnnouncement(this.reference, this.data)
    : title = textField(data, const ['title', 'Title'], 'Production update'),
      body = textField(data, const [
        'body',
        'Body',
        'bodyText',
        'BodyText',
        'description',
        'Description',
      ]),
      priority = textField(data, const ['priority', 'Priority'], 'Normal'),
      author = textField(data, const [
        'authorName',
        'AuthorName',
      ], 'Production Team'),
      location = textField(data, const ['location', 'Location']),
      publishedAt = dateField(data, const [
        'publishAt',
        'PublishAt',
        'createdAt',
        'CreatedAt',
      ]),
      deadlineAt = dateField(data, const ['deadlineAt', 'DeadlineAt']),
      pinned = boolField(data, const ['pinned', 'Pinned']),
      acknowledgementRequired = boolField(data, const [
        'acknowledgementRequired',
        'AcknowledgementRequired',
      ]),
      acknowledged = boolField(data, const [
        'isAcknowledged',
        'IsAcknowledged',
      ]);

  final DocumentReference<Map<String, dynamic>> reference;
  final Map<String, dynamic> data;
  final String title, body, priority, author, location;
  final DateTime? publishedAt, deadlineAt;
  final bool pinned, acknowledgementRequired, acknowledged;
  bool get urgent => priority.toLowerCase() == 'urgent';
}

class PortalEvent {
  PortalEvent(this.reference, this.data)
    : title = textField(data, const [
        'title',
        'Title',
        'event',
        'Event',
      ], 'Production event'),
      description = textField(data, const [
        'description',
        'Description',
        'body',
        'Body',
      ]),
      type = textField(data, const [
        'eventType',
        'EventType',
        'type',
        'Type',
      ], 'Rehearsal'),
      location = textField(data, const ['location', 'Location']),
      whatToBring = textField(data, const ['whatToBring', 'WhatToBring']),
      called = textField(data, const [
        'whoIsCalled',
        'WhoIsCalled',
        'audience',
        'Audience',
      ], 'Company'),
      start = dateField(data, const ['startAt', 'StartAt', 'date', 'Date']),
      end = dateField(data, const ['endAt', 'EndAt']),
      call = dateField(data, const ['callTime', 'CallTime']),
      changed = boolField(data, const [
        'scheduleChanged',
        'ScheduleChanged',
        'changed',
        'Changed',
      ]);

  final DocumentReference<Map<String, dynamic>> reference;
  final Map<String, dynamic> data;
  final String title, description, type, location, whatToBring, called;
  final DateTime? start, end, call;
  final bool changed;
  bool get upcoming =>
      (end ?? start)?.isAfter(
        DateTime.now().subtract(const Duration(hours: 12)),
      ) ??
      true;
}

String profilePhotoReference(Map<String, dynamic> profile) =>
    textField(profile, const [
      'photoFileId',
      'photoFileID',
      'PhotoFileID',
      'photoFileId',
      'PhotoFileId',
    ]);

String conversationCategory(Map<String, dynamic> data) {
  final raw = textField(data, const [
    'category',
    'Category',
    'groupCategory',
  ], '').toLowerCase();
  if (raw.contains('class')) return 'class';
  if (raw.contains('ensemble') ||
      raw.contains('cast') ||
      raw.contains('orchestra') ||
      raw.contains('dance') ||
      raw.contains('choreo'))
    return 'ensemble';
  return 'production';
}
