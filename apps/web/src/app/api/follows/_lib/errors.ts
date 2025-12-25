export function isMissingRelation(error?: { message?: string }) {
  if (!error?.message) return false;
  const msg = error.message.toLowerCase();
  return (
    (msg.includes("relation") && msg.includes("does not exist")) ||
    (msg.includes("could not find") &&
      msg.includes("column") &&
      (msg.includes("user_address") || msg.includes("user_wallet") || msg.includes("user_id")))
  );
}

export function isUserIdForeignKeyViolation(error?: { message?: string }) {
  if (!error?.message) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("violates foreign key constraint") && msg.includes("event_follows_user_id_fkey")
  );
}

export function isEventIdForeignKeyViolation(error?: { message?: string }) {
  if (!error?.message) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("violates foreign key constraint") &&
    (msg.includes("event_follows_event_id_fkey") || msg.includes("predictions"))
  );
}

export function isUserIdTypeIntegerError(error?: { message?: string }) {
  if (!error?.message) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("out of range for type integer") ||
    msg.includes("invalid input syntax for type integer")
  );
}

export function isOnConflictNoUniqueConstraint(error?: { message?: string }) {
  if (!error?.message) return false;
  const msg = error.message.toLowerCase();
  return msg.includes("no unique or exclusion constraint") && msg.includes("on conflict");
}
