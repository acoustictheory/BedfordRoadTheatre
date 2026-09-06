import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart' show Size;
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart' show PdfPageFormat;
import 'package:pdf/widgets.dart' as pw;
import 'package:pdfrx/pdfrx.dart';

import 'practice_notes_store.dart';
import 'score_annotation_layer.dart';

class AnnotatedPdfExportResult {
  const AnnotatedPdfExportResult({required this.file, required this.pageCount});

  final File file;
  final int pageCount;
}

class AnnotatedPdfExporter {
  static Future<AnnotatedPdfExportResult> export({
    required Uint8List sourceBytes,
    required String sourceName,
    required String songTitle,
    required List<ScoreInkMark> marks,
    required Set<String> visibleLayers,
    required void Function(int current, int total) onProgress,
    bool saveToDownloads = true,
  }) async {
    final document = await PdfDocument.openData(
      sourceBytes,
      sourceName: 'annotation-export-$sourceName',
      useProgressiveLoading: false,
    );
    final out = pw.Document(compress: true);

    try {
      final pages = document.pages;
      for (var index = 0; index < pages.length; index++) {
        final page = pages[index];
        onProgress(index, pages.length);

        // 2x / 144-dpi equivalent render keeps notation crisp while avoiding
        // enormous memory use on long scores.
        final pixelWidth = (page.width * 2).round().clamp(800, 2200).toInt();
        final pixelHeight = (page.height * pixelWidth / page.width).round();
        final rendered = await page.render(
          width: pixelWidth,
          height: pixelHeight,
          fullWidth: pixelWidth.toDouble(),
          fullHeight: pixelHeight.toDouble(),
          backgroundColor: 0xFFFFFFFF,
          flags: PdfPageRenderFlags.printing,
        );
        if (rendered == null) {
          throw StateError('Could not render page ${index + 1}.');
        }

        ui.Image? pageImage;
        ui.Image? flattened;
        try {
          final sourceImage = await rendered.createImage();
          pageImage = sourceImage;
          final recorder = ui.PictureRecorder();
          final canvas = ui.Canvas(recorder);
          canvas.drawImageRect(
            sourceImage,
            ui.Rect.fromLTWH(
              0,
              0,
              sourceImage.width.toDouble(),
              sourceImage.height.toDouble(),
            ),
            ui.Rect.fromLTWH(
              0,
              0,
              pixelWidth.toDouble(),
              pixelHeight.toDouble(),
            ),
            ui.Paint(),
          );

          final pageMarks = marks
              .where(
                (m) => m.page == index + 1 && visibleLayers.contains(m.layerId),
              )
              .toList(growable: false);
          for (final mark in pageMarks) {
            paintScoreMark(
              canvas,
              Size(pixelWidth.toDouble(), pixelHeight.toDouble()),
              mark,
            );
          }

          final picture = recorder.endRecording();
          flattened = await picture.toImage(pixelWidth, pixelHeight);
          picture.dispose();
          final pngData = await flattened.toByteData(
            format: ui.ImageByteFormat.png,
          );
          if (pngData == null) {
            throw StateError('Could not encode annotated page ${index + 1}.');
          }
          final image = pw.MemoryImage(pngData.buffer.asUint8List());
          out.addPage(
            pw.Page(
              pageFormat: PdfPageFormat(page.width, page.height),
              margin: pw.EdgeInsets.zero,
              build: (_) => pw.Image(
                image,
                width: page.width,
                height: page.height,
                fit: pw.BoxFit.fill,
              ),
            ),
          );
        } finally {
          pageImage?.dispose();
          flattened?.dispose();
          rendered.dispose();
        }
      }

      onProgress(pages.length, pages.length);
      final bytes = await out.save();
      final safeTitle = songTitle
          .replaceAll(RegExp(r'[^A-Za-z0-9 _\-]+'), '')
          .trim()
          .replaceAll(RegExp(r'\s+'), '_');
      final filename =
          '${safeTitle.isEmpty ? 'Annotated_Score' : safeTitle}_Annotated.pdf';

      Directory? directory;
      if (saveToDownloads) {
        try {
          directory = await getDownloadsDirectory();
        } catch (_) {
          directory = null;
        }
      }
      directory ??= await getApplicationDocumentsDirectory();
      await directory.create(recursive: true);
      final file = File('${directory.path}${Platform.pathSeparator}$filename');
      await file.writeAsBytes(bytes, flush: true);
      return AnnotatedPdfExportResult(file: file, pageCount: pages.length);
    } finally {
      await document.dispose();
    }
  }
}
