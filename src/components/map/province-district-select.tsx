"use client";

import { useState } from "react";
import { Field, Select } from "@/components/ui/form";

export type LocationOption = { id: number; name: string; districts: { id: number; name: string }[] };

export function ProvinceDistrictSelect({
  locations,
  defaultProvinceId,
  defaultDistrictId,
  errors,
}: {
  locations: LocationOption[];
  defaultProvinceId?: number;
  defaultDistrictId?: number;
  errors?: { provinceId?: string; districtId?: string };
}) {
  const [provinceId, setProvinceId] = useState<string>(defaultProvinceId ? String(defaultProvinceId) : "");
  const [districtId, setDistrictId] = useState<string>(defaultDistrictId ? String(defaultDistrictId) : "");
  const districts = locations.find((p) => String(p.id) === provinceId)?.districts ?? [];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="İl" name="provinceId" error={errors?.provinceId} required>
        <Select
          id="provinceId"
          name="provinceId"
          value={provinceId}
          onChange={(e) => {
            setProvinceId(e.target.value);
            setDistrictId("");
          }}
          aria-invalid={!!errors?.provinceId}
        >
          <option value="">İl seçin</option>
          {locations.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="İlçe" name="districtId" error={errors?.districtId} required>
        <Select
          id="districtId"
          name="districtId"
          value={districtId}
          onChange={(e) => setDistrictId(e.target.value)}
          disabled={!provinceId}
          aria-invalid={!!errors?.districtId}
        >
          <option value="">{provinceId ? "İlçe seçin" : "Önce il seçin"}</option>
          {districts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}
