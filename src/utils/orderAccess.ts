export const GUEST_ORDER_ACCESS_KEY = 'guestOrderAccess';

type GuestOrderAccessEntry = {
  orderId: number;
  phone: string;
  savedAt: string;
};

const normalizePhone = (phone: string) => phone.replace(/\D/g, '');

const readEntries = (): GuestOrderAccessEntry[] => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(GUEST_ORDER_ACCESS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => ({
        orderId: Number(item?.orderId),
        phone: String(item?.phone || ''),
        savedAt: String(item?.savedAt || ''),
      }))
      .filter((item) => Number.isFinite(item.orderId) && item.orderId > 0 && item.phone);
  } catch {
    return [];
  }
};

const writeEntries = (entries: GuestOrderAccessEntry[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(GUEST_ORDER_ACCESS_KEY, JSON.stringify(entries));
};

export const getGuestOrderAccessPhone = (orderId: number) => {
  if (!orderId) return null;

  const entry = readEntries().find((item) => item.orderId === orderId);
  return entry?.phone || null;
};

export const saveGuestOrderAccess = (orderId: number, phone: string) => {
  if (!orderId || !phone) return;

  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return;

  const entries = readEntries();
  const withoutCurrent = entries.filter((entry) => entry.orderId !== orderId);

  writeEntries([
    {
      orderId,
      phone: normalizedPhone,
      savedAt: new Date().toISOString(),
    },
    ...withoutCurrent,
  ].slice(0, 20));
};

export const hasGuestOrderAccess = (orderId: number, phone: string) => {
  if (!orderId || !phone) return false;
  const normalizedPhone = normalizePhone(phone);
  return readEntries().some((entry) => entry.orderId === orderId && entry.phone === normalizedPhone);
};

export const normalizeOrderPhone = normalizePhone;