import PDFDocument from "pdfkit";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
  AUDIO_EVENT_LABEL_KO,
  EMOTION_LABEL_KO,
  summarizeEmotions,
  type CoachingReport,
  type Emotion,
  type SpeechMetrics,
} from "@pitches/shared";

export interface PdfReportInput {
  title: string;
  report: CoachingReport;
  metrics: SpeechMetrics;
  generatedAt: Date;
}

// src/services 와 dist/services 모두 apps/api/assets 를 가리킨다 (워커 cwd 무관)
const fontPath = (file: string) =>
  fileURLToPath(new URL(`../../assets/fonts/${file}`, import.meta.url));

const FONT_REGULAR = "Pretendard";
const FONT_BOLD = "Pretendard-Bold";
const BRAND = "#4F46E5";
const MUTED = "#6B7280";

/**
 * 코칭 보고서 PDF. pdfkit 기본 폰트(Helvetica)는 한글이 없어서 Pretendard(OFL)를 임베드한다.
 */
export async function renderReportPdf(
  input: PdfReportInput,
  outPath: string
): Promise<void> {
  const { report, metrics } = input;
  const emotion = summarizeEmotions(metrics.emotionCounts);

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 56 });
    const stream = fs.createWriteStream(outPath);
    stream.on("finish", () => resolve());
    stream.on("error", reject);
    doc.pipe(stream);

    doc.registerFont(FONT_REGULAR, fontPath("Pretendard-Regular.ttf"));
    doc.registerFont(FONT_BOLD, fontPath("Pretendard-Bold.ttf"));

    doc.font(FONT_BOLD).fontSize(22).fillColor("#111827").text("스피치 코칭 보고서");
    doc.font(FONT_REGULAR).fontSize(13).fillColor(MUTED).text(input.title);
    doc.fontSize(10).text(`생성일: ${input.generatedAt.toLocaleString("ko-KR")}`);
    doc.moveDown();

    doc.font(FONT_BOLD).fontSize(16).fillColor(BRAND);
    doc.text(
      `종합 점수 ${report.overallScore}점` +
        (metrics.accuracy != null ? `   ·   스피치 정확도 ${metrics.accuracy}%` : "")
    );
    doc.font(FONT_REGULAR).fontSize(10).fillColor(MUTED);
    doc.text(
      [
        `발표 시간 ${formatDuration(metrics.durationSec)}`,
        `평균 속도 ${Math.round(metrics.avgWpm)}자/분`,
        `간투사 ${metrics.fillerCount}회`,
        `평균 음량 ${metrics.avgVolumeDb.toFixed(1)}dB`,
        ...(emotion
          ? [`주요 감정 ${EMOTION_LABEL_KO[emotion.dominant]} ${Math.round(emotion.ratio * 100)}%`]
          : []),
      ].join("   ·   ")
    );
    doc.moveDown();

    section(doc, "1. 발표 분석 요약");
    paragraph(doc, `주제: ${report.summary.mainTopic}`);
    report.summary.keyMessages.forEach((m) => bullet(doc, m));

    section(doc, "2. 음성 분석");
    labeled(doc, "목소리 톤", report.voiceAnalysis.tone);
    labeled(doc, "말하기 속도", report.voiceAnalysis.speed);
    labeled(doc, "명료성", report.voiceAnalysis.clarity);
    labeled(doc, "안정성", report.voiceAnalysis.stability);
    if (emotion) {
      const dist = (Object.entries(metrics.emotionCounts ?? {}) as [Emotion, number][])
        .sort((a, b) => b[1] - a[1])
        .map(([e, n]) => `${EMOTION_LABEL_KO[e]} ${Math.round((n / emotion.total) * 100)}%`)
        .join(", ");
      labeled(doc, "감정 분포", dist);
    }
    const events = Object.entries(metrics.audioEvents ?? {});
    if (events.length > 0) {
      labeled(
        doc,
        "소리 이벤트",
        events.map(([e, n]) => `${AUDIO_EVENT_LABEL_KO[e] ?? e} ${n}회`).join(", ")
      );
    }

    section(doc, "3. 내용 분석");
    labeled(doc, "논리성", report.contentAnalysis.logic);
    labeled(doc, "구조", report.contentAnalysis.structure);
    labeled(doc, "설득력", report.contentAnalysis.persuasiveness);

    section(doc, "4. 강점");
    report.strengths.forEach((s) => bullet(doc, s));

    section(doc, "5. 개선점");
    report.weaknesses.forEach((w) => bullet(doc, w));

    section(doc, "6. 개선 로드맵");
    paragraph(doc, "단기 (2주)", FONT_BOLD);
    report.roadmap.shortTerm.forEach((r) => bullet(doc, r));
    paragraph(doc, "장기 (3개월+)", FONT_BOLD);
    report.roadmap.longTerm.forEach((r) => bullet(doc, r));

    doc.end();
  });
}

function section(doc: PDFKit.PDFDocument, title: string) {
  doc.moveDown(0.8);
  doc.font(FONT_BOLD).fontSize(14).fillColor(BRAND).text(title);
  doc.moveDown(0.3);
}

function paragraph(doc: PDFKit.PDFDocument, text: string, font = FONT_REGULAR) {
  doc.font(font).fontSize(11).fillColor("#111827").text(text, { lineGap: 3 });
}

function labeled(doc: PDFKit.PDFDocument, label: string, text: string) {
  doc.font(FONT_BOLD).fontSize(11).fillColor("#111827").text(`${label}: `, {
    continued: true,
  });
  doc.font(FONT_REGULAR).text(text, { lineGap: 3 });
}

function bullet(doc: PDFKit.PDFDocument, text: string) {
  doc.font(FONT_REGULAR).fontSize(11).fillColor("#111827");
  doc.text(`•  ${text}`, { indent: 8, lineGap: 3 });
}

function formatDuration(sec: number): string {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}분 ${s % 60}초`;
}
