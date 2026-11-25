import { createBrowserRouter, Navigate } from "react-router-dom";
import { MainLayout } from "@/layouts/MainLayout";
import { HomePage } from "@/pages/HomePage";
import { LegacyNeighborhoodsRedirect } from "@/pages/LegacyNeighborhoodsRedirect";
import { NeighborhoodInfoPage } from "@/pages/NeighborhoodInfoPage";
import { NewsDetailPage } from "@/pages/NewsDetailPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <MainLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "dich-vu", element: <Navigate to="/" replace /> },
      // Danh bạ cũ đã gộp vào "Thông tin Tổ dân phố" - giữ đường dẫn cũ (kể cả ?q=).
      { path: "to-dan-pho", element: <LegacyNeighborhoodsRedirect /> },
      { path: "thong-tin-to-dan-pho", element: <NeighborhoodInfoPage /> },
      { path: "tin-tuc/:id", element: <NewsDetailPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
