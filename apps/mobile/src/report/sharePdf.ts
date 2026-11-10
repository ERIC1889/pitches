import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { apiBaseUrl } from "../api/client";
import { useAuthStore } from "../store/auth";

/**
 * 보고서 PDF 를 캐시 폴더로 내려받아(인증 헤더 필요) iOS/Android 공유 시트를 띄운다.
 * 공유 시트에서 "파일에 저장"을 고르면 기기에 저장된다.
 */
export async function sharePdf(reportId: string, title: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("이 기기에서는 공유 기능을 쓸 수 없어요");
  }
  const token = useAuthStore.getState().token;
  const file = await File.downloadFileAsync(
    `${apiBaseUrl}/reports/${reportId}/pdf`,
    new File(Paths.cache, `pitches-report-${reportId}.pdf`),
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      idempotent: true,
    }
  );
  await Sharing.shareAsync(file.uri, {
    mimeType: "application/pdf",
    UTI: "com.adobe.pdf",
    dialogTitle: title,
  });
}
