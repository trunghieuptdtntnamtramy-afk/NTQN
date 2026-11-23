import { FIREBASE_PROJECT_ID } from "./firebase";

export class WorkspaceApiError extends Error {
  status: number;
  isChatConfigError: boolean;
  consoleUrl?: string;

  constructor(message: string, status: number, isChatConfigError = false, consoleUrl?: string) {
    super(message);
    this.status = status;
    this.isChatConfigError = isChatConfigError;
    this.consoleUrl = consoleUrl;
  }
}

async function workspaceFetch<T>(
  url: string,
  accessToken: string,
  options: RequestInit = {},
  isChatApi = false
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    let errText = `HTTP ${res.status}`;
    try {
      const json = await res.json();
      errText = json?.error?.message || JSON.stringify(json);
    } catch {
      errText = await res.text();
    }

    const consoleUrl = `https://console.cloud.google.com/apis/api/chat.googleapis.com/hangouts-chat?project=${FIREBASE_PROJECT_ID}`;
    if (
      isChatApi &&
      (res.status === 404 || errText.includes("Chat app not found"))
    ) {
      throw new WorkspaceApiError(
        "Google Chat yêu cầu tài khoản Google Workspace (trường học/tổ chức) và cấu hình Chat App trong Google Cloud Console.",
        res.status,
        true,
        consoleUrl
      );
    }
    throw new WorkspaceApiError(errText, res.status, false);
  }

  if (res.status === 204) {
    return {} as T;
  }
  return (await res.json()) as T;
}

// 1. GOOGLE DRIVE
export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export async function listDriveFiles(
  accessToken: string,
  query?: string
): Promise<DriveFileItem[]> {
  const qParts = ["trashed = false"];
  if (query && query.trim()) {
    const escaped = query.trim().replace(/'/g, "\\'");
    qParts.push(`name contains '${escaped}'`);
  }
  const params = new URLSearchParams({
    pageSize: "12",
    orderBy: "modifiedTime desc",
    q: qParts.join(" and "),
    fields: "files(id,name,mimeType,modifiedTime,webViewLink)",
  });
  const data = await workspaceFetch<{ files?: DriveFileItem[] }>(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    accessToken
  );
  return data.files ?? [];
}

export async function deleteDriveFile(accessToken: string, fileId: string): Promise<void> {
  const safeId = encodeURIComponent(fileId.trim());
  await workspaceFetch<Record<string, never>>(
    `https://www.googleapis.com/drive/v3/files/${safeId}`,
    accessToken,
    { method: "DELETE" }
  );
}

// 2. GOOGLE SHEETS
export interface CreatedSpreadsheet {
  spreadsheetId: string;
  spreadsheetUrl: string;
  firstSheetTitle: string;
}

export async function createStudyPlanSheet(
  accessToken: string,
  title: string,
  rows: (string | number)[][]
): Promise<CreatedSpreadsheet> {
  const created = await workspaceFetch<{
    spreadsheetId: string;
    spreadsheetUrl: string;
    sheets?: { properties?: { title?: string } }[];
  }>("https://sheets.googleapis.com/v4/spreadsheets", accessToken, {
    method: "POST",
    body: JSON.stringify({
      properties: { title },
      sheets: [{ properties: { title: "KeHoachHocTap" } }],
    }),
  });

  const firstSheetTitle = created.sheets?.[0]?.properties?.title || "KeHoachHocTap";
  const range = encodeURIComponent(`${firstSheetTitle}!A1`);

  await workspaceFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(created.spreadsheetId)}/values/${range}?valueInputOption=USER_ENTERED`,
    accessToken,
    {
      method: "PUT",
      body: JSON.stringify({ values: rows }),
    }
  );

  return {
    spreadsheetId: created.spreadsheetId,
    spreadsheetUrl: created.spreadsheetUrl,
    firstSheetTitle,
  };
}

export async function readSpreadsheetPreview(
  accessToken: string,
  spreadsheetId: string
): Promise<{ title: string; sheetName: string; values: string[][] }> {
  const safeId = encodeURIComponent(spreadsheetId.trim());
  const meta = await workspaceFetch<{
    properties?: { title?: string };
    sheets?: { properties?: { title?: string } }[];
  }>(`https://sheets.googleapis.com/v4/spreadsheets/${safeId}`, accessToken);

  const sheetName = meta.sheets?.[0]?.properties?.title;
  if (!sheetName) {
    return {
      title: meta.properties?.title || "Bảng tính",
      sheetName: "",
      values: [],
    };
  }

  const range = encodeURIComponent(`${sheetName}!A1:F15`);
  const data = await workspaceFetch<{ values?: string[][] }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${safeId}/values/${range}`,
    accessToken
  );

  return {
    title: meta.properties?.title || "Bảng tính",
    sheetName,
    values: data.values ?? [],
  };
}

// 3. GMAIL
export interface GmailMessageSummary {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
}

export async function listRecentEmails(accessToken: string): Promise<GmailMessageSummary[]> {
  const listData = await workspaceFetch<{ messages?: { id: string }[] }>(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=6",
    accessToken
  );
  const ids = listData.messages ?? [];
  if (!ids.length) return [];

  const details = await Promise.all(
    ids.map((m) =>
      workspaceFetch<{
        id: string;
        snippet?: string;
        payload?: { headers?: { name: string; value: string }[] };
      }>(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(m.id)}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        accessToken
      )
    )
  );

  return details.map((d) => {
    const headers = d.payload?.headers ?? [];
    const getHeader = (name: string) =>
      headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
    return {
      id: d.id,
      subject: getHeader("Subject") || "(Không có tiêu đề)",
      from: getHeader("From") || "Không rõ người gửi",
      date: getHeader("Date") || "",
      snippet: d.snippet || "",
    };
  });
}

function encodeBase64UrlUtf8(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sendGmailReport(
  accessToken: string,
  to: string,
  subject: string,
  bodyText: string
): Promise<{ id: string }> {
  const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const rawMime = [
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "MIME-Version: 1.0",
    "",
    bodyText,
  ].join("\r\n");

  return workspaceFetch<{ id: string }>(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({ raw: encodeBase64UrlUtf8(rawMime) }),
    }
  );
}

// 4. GOOGLE DOCS
export async function createStudyDoc(
  accessToken: string,
  title: string,
  content: string
): Promise<{ documentId: string; url: string }> {
  const doc = await workspaceFetch<{ documentId: string }>(
    "https://docs.googleapis.com/v1/documents",
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({ title }),
    }
  );

  await workspaceFetch(
    `https://docs.googleapis.com/v1/documents/${encodeURIComponent(doc.documentId)}:batchUpdate`,
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: content,
            },
          },
        ],
      }),
    }
  );

  return {
    documentId: doc.documentId,
    url: `https://docs.google.com/document/d/${doc.documentId}/edit`,
  };
}

// 5. GOOGLE SLIDES
export async function createStudyPresentation(
  accessToken: string,
  title: string,
  subtitle: string,
  bulletSummary: string
): Promise<{ presentationId: string; url: string }> {
  const pres = await workspaceFetch<{
    presentationId: string;
    slides?: { objectId: string; pageElements?: { objectId: string; shape?: { placeholder?: { type?: string } } }[] }[];
  }>("https://slides.googleapis.com/v1/presentations", accessToken, {
    method: "POST",
    body: JSON.stringify({ title }),
  });

  const firstSlide = pres.slides?.[0];
  const requests: Record<string, unknown>[] = [];

  if (firstSlide) {
    const titleEl = firstSlide.pageElements?.find(
      (el) => el.shape?.placeholder?.type === "CENTERED_TITLE" || el.shape?.placeholder?.type === "TITLE"
    );
    const subEl = firstSlide.pageElements?.find(
      (el) => el.shape?.placeholder?.type === "SUBTITLE"
    );
    if (titleEl) {
      requests.push({ insertText: { objectId: titleEl.objectId, text: title } });
    }
    if (subEl) {
      requests.push({ insertText: { objectId: subEl.objectId, text: subtitle } });
    }
  }

  const summarySlideId = `slide_summary_${Date.now()}`;
  const bodyBoxId = `body_box_${Date.now()}`;
  requests.push(
    {
      createSlide: {
        objectId: summarySlideId,
        slideLayoutReference: { predefinedLayout: "TITLE_AND_BODY" },
        placeholderIdMappings: [
          {
            layoutPlaceholder: { type: "BODY", index: 0 },
            objectId: bodyBoxId,
          },
        ],
      },
    },
    {
      insertText: {
        objectId: bodyBoxId,
        text: bulletSummary,
      },
    }
  );

  await workspaceFetch(
    `https://slides.googleapis.com/v1/presentations/${encodeURIComponent(pres.presentationId)}:batchUpdate`,
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({ requests }),
    }
  );

  return {
    presentationId: pres.presentationId,
    url: `https://docs.google.com/presentation/d/${pres.presentationId}/edit`,
  };
}

// 6. GOOGLE CHAT
export interface ChatSpaceItem {
  name: string;
  displayName?: string;
  spaceType?: string;
}

export async function listChatSpaces(accessToken: string): Promise<ChatSpaceItem[]> {
  const data = await workspaceFetch<{ spaces?: ChatSpaceItem[] }>(
    "https://chat.googleapis.com/v1/spaces?pageSize=10",
    accessToken,
    {},
    true
  );
  return data.spaces ?? [];
}

export async function postChatMessage(
  accessToken: string,
  spaceName: string,
  text: string
): Promise<{ name: string }> {
  const cleanSpace = spaceName.startsWith("spaces/")
    ? `spaces/${encodeURIComponent(spaceName.replace(/^spaces\//, ""))}`
    : `spaces/${encodeURIComponent(spaceName)}`;

  return workspaceFetch<{ name: string }>(
    `https://chat.googleapis.com/v1/${cleanSpace}/messages`,
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({ text }),
    },
    true
  );
}

// 7. GOOGLE MEET
export interface MeetSpaceInfo {
  name: string;
  meetingUri: string;
  meetingCode: string;
}

export async function createMeetSpace(accessToken: string): Promise<MeetSpaceInfo> {
  return workspaceFetch<MeetSpaceInfo>(
    "https://meet.googleapis.com/v2/spaces",
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({}),
    }
  );
}

// 8. GOOGLE FORMS
export interface CreatedFormInfo {
  formId: string;
  responderUri: string;
  editUrl: string;
}

export async function createStudyForm(
  accessToken: string,
  title: string,
  questions: string[]
): Promise<CreatedFormInfo> {
  const form = await workspaceFetch<{ formId: string; responderUri: string }>(
    "https://forms.googleapis.com/v1/forms",
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({
        info: {
          title,
          documentTitle: title,
        },
      }),
    }
  );

  const safeFormId = encodeURIComponent(form.formId.trim());
  const requests = questions.map((q, idx) => ({
    createItem: {
      item: {
        title: q,
        questionItem: {
          question: {
            required: true,
            textQuestion: { paragraph: true },
          },
        },
      },
      location: { index: idx },
    },
  }));

  if (requests.length > 0) {
    await workspaceFetch(
      `https://forms.googleapis.com/v1/forms/${safeFormId}:batchUpdate`,
      accessToken,
      {
        method: "POST",
        body: JSON.stringify({ requests }),
      }
    );
  }

  return {
    formId: form.formId,
    responderUri: form.responderUri,
    editUrl: `https://docs.google.com/forms/d/${safeFormId}/edit`,
  };
}

export async function getFormResponsesCount(
  accessToken: string,
  formId: string
): Promise<{ title: string; responseCount: number }> {
  const safeFormId = encodeURIComponent(formId.trim());
  const [formMeta, respData] = await Promise.all([
    workspaceFetch<{ info?: { title?: string } }>(
      `https://forms.googleapis.com/v1/forms/${safeFormId}`,
      accessToken
    ),
    workspaceFetch<{ responses?: unknown[] }>(
      `https://forms.googleapis.com/v1/forms/${safeFormId}/responses`,
      accessToken
    ),
  ]);

  return {
    title: formMeta.info?.title || "Biểu mẫu học tập",
    responseCount: respData.responses?.length ?? 0,
  };
}
