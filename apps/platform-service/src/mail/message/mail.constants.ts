/** Byte values used to reject ASCII header-control characters. */
export const MAIL_CHARACTER = Object.freeze({
  ASCII_CONTROL_MAX: 0x1f,
  ASCII_DELETE: 0x7f,
} as const);

/** Shared mailbox bound for both runtime payloads and configured senders. */
export const MAIL_ADDRESS_MAX_LENGTH = 254;
