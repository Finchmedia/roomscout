import { ConvexError } from "convex/values";
import { contentHash, normalizeText } from "../integrations/contentHash";

export type ActionPayloadField = {
  name: string;
  value: string;
  sensitivity: "public" | "personal" | "sensitive";
};

export type CanonicalActionPayload = {
  actionType: string;
  destination: string;
  connectionKey?: string;
  fields: ActionPayloadField[];
};

export function normalizeActionPayload(
  payload: CanonicalActionPayload,
): CanonicalActionPayload {
  const actionType = payload.actionType.trim().toLowerCase();
  const destination = payload.destination.trim();
  if (actionType.length === 0 || actionType.length > 80) {
    throw new ConvexError({ code: "INVALID_ACTION_TYPE" });
  }
  if (destination.length === 0 || destination.length > 2_000) {
    throw new ConvexError({ code: "INVALID_ACTION_DESTINATION" });
  }
  if (payload.fields.length === 0 || payload.fields.length > 50) {
    throw new ConvexError({ code: "INVALID_ACTION_FIELDS" });
  }

  const names = new Set<string>();
  let totalLength = 0;
  const fields = payload.fields.map((field) => {
    const name = field.name.trim().toLowerCase();
    const value = normalizeText(field.value);
    if (name.length === 0 || name.length > 120 || names.has(name)) {
      throw new ConvexError({ code: "INVALID_ACTION_FIELD_NAME" });
    }
    if (value.length > 20_000) {
      throw new ConvexError({ code: "ACTION_FIELD_TOO_LARGE" });
    }
    names.add(name);
    totalLength += name.length + value.length;
    return { name, value, sensitivity: field.sensitivity };
  });
  if (totalLength > 100_000) {
    throw new ConvexError({ code: "ACTION_PAYLOAD_TOO_LARGE" });
  }

  return {
    actionType,
    destination,
    ...(payload.connectionKey
      ? { connectionKey: payload.connectionKey.trim() }
      : {}),
    fields,
  };
}

export async function actionPayloadHash(
  payload: CanonicalActionPayload,
): Promise<string> {
  const normalized = normalizeActionPayload(payload);
  return await contentHash([
    normalized.actionType,
    normalized.destination,
    normalized.connectionKey ?? "",
    JSON.stringify(normalized.fields),
  ]);
}
