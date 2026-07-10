import type { Brand } from "@/types";
import { apiFetch } from "./client";

export const getBrands = (page: number = 1, perPage: number = 50, search: string = "") =>
  apiFetch<Brand[]>(`/brands?page=${page}&per_page=${perPage}&search=${encodeURIComponent(search)}`);

export const getBrand = (id: string) => apiFetch<Brand>(`/brands/${id}`);

export const createBrand = (name: string, domain: string, competitors: string[] = []) =>
  apiFetch<Brand>("/brands", {
    method: "POST",
    body: JSON.stringify({ name, domain, competitors }),
  });

export const deleteBrand = (id: string) =>
  apiFetch<void>(`/brands/${id}`, { method: "DELETE" });
