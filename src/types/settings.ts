export type AppIdentity = {
  name: string;
  ward: string;
  city: string;
  address?: string;
  phone?: string;
  email?: string;
  officeHours?: string;
};

export type EmergencyContact = {
  label: string;
  phone: string;
};

export type PublicSettings = {
  announcement_gate_footer?: {
    unitName: string;
    address: string;
    phone: string;
    email: string;
    officeHours: string;
    content: string;
    copyright: string;
    showEmergencyContacts: boolean;
  };
  app_identity?: AppIdentity;
  emergency_contacts?: EmergencyContact[];
  // Duong dan anh do admin tai len (thuong la duong dan tuong doi
  // /uploads/...) - luon di qua resolveAssetUrl truoc khi dung.
  // Danh sach anh banner (trinh chieu) - focusY 0-100 la vi tri doc cua phan
  // anh duoc giu lai khi man hinh rong cat bot tren/duoi.
  announcement_gate_banners?: AnnouncementGateBanner[];
  // Key cu (1 anh) - backend moi da gop vao announcement_gate_banners, chi con
  // doc de du phong khi backend chua cap nhat.
  announcement_gate_billboard_url?: string | null;
  announcement_gate_logo_url?: string | null;
};

export type AnnouncementGateBanner = {
  id: string;
  url: string;
  focusY: number;
};
